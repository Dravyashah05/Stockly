import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { logAudit } from "../utils/audit.js";
import { escapeRegex } from "../utils/security.js";

function slugKey(label){
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"").slice(0,30) || "field";
}

function normalizeCustomFields(fields){
  if(!Array.isArray(fields)) return [];
  const seen = new Set();
  return fields.slice(0, 20).map(f=>{
    const label = String(f.label || f.name || "").trim();
    if(!label) return null;
    let key = String(f.key || slugKey(label)).toLowerCase().replace(/[^a-z0-9_]/g,"_");
    if(!key) key = slugKey(label);
    // dedupe key
    let uniq = key; let i=1;
    while(seen.has(uniq)){ uniq = `${key}_${i++}`; }
    seen.add(uniq);
    const type = ["text","number","select","date","checkbox"].includes(f.type) ? f.type : "text";
    let options = [];
    if(type==="select"){
      options = Array.isArray(f.options) ? f.options.map(s=> String(s).trim()).filter(Boolean).slice(0,20) : String(f.options||"").split(",").map(s=> s.trim()).filter(Boolean).slice(0,20);
    }
    return { key: uniq, label: label.slice(0,50), type, options, required: !!f.required };
  }).filter(Boolean);
}

export async function getCategories(req,res,next){
  try{
    const { search="" } = req.query;
    const filter={};
    if(search && typeof search === "string" && search.trim()) {
      filter.name = { $regex: escapeRegex(search.trim()), $options:"i" };
    }
    const categories = await Category.find(filter).sort({ createdAt:-1 });
    res.json({ success:true, data: categories });
  }catch(e){ next(e); }
}

export async function getCategory(req,res,next){
  try{
    const cat = await Category.findById(req.params.id);
    if(!cat) return res.status(404).json({ success:false, message:"Category not found" });
    res.json({ success:true, data: cat });
  }catch(e){ next(e); }
}

export async function getCategoryStats(req,res,next){
  try{
    const categories = await Category.find().sort({ name:1 });
    const stats = await Product.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$category", productCount: { $sum: 1 }, totalStock: { $sum: "$quantity" }, totalValue: { $sum: { $multiply: ["$quantity", { $ifNull: ["$price", 0] }] } } } }
    ]);
    const map = new Map(stats.map(s=> [String(s._id), s]));
    const data = categories.map(c=>{
      const s = map.get(String(c._id)) || { productCount:0, totalStock:0, totalValue:0 };
      return { category: c, productCount: s.productCount, totalStock: s.totalStock, totalValue: s.totalValue };
    });
    // also include uncategorized? not needed
    res.json({ success:true, data });
  }catch(e){ next(e); }
}

export async function createCategory(req,res,next){
  try{
    const { name, description, status, customFields } = req.body;
    if(!name) return res.status(400).json({ success:false, message:"Category name required" });
    const normalized = normalizeCustomFields(customFields);
    const cat = await Category.create({ name: name.trim(), description: description||"", status: status||"active", isActive: (status||"active")==="active", customFields: normalized });
    logAudit({ req, action:"create", entity:"category", entityId: cat._id, before:null, after: cat }).catch(()=>{});
    res.status(201).json({ success:true, data: cat });
  }catch(e){
    if(e.code===11000) return res.status(400).json({ success:false, message:"Category already exists" });
    next(e);
  }
}

export async function updateCategory(req,res,next){
  try{
    const updates={};
    if(req.body.name!==undefined) updates.name = req.body.name.trim();
    if(req.body.description!==undefined) updates.description = req.body.description;
    if(req.body.status!==undefined){ updates.status = req.body.status; updates.isActive = req.body.status==="active"; }
    if(req.body.customFields!==undefined) updates.customFields = normalizeCustomFields(req.body.customFields);
    const before = await Category.findById(req.params.id).lean();
    const cat = await Category.findByIdAndUpdate(req.params.id, updates, { new:true, runValidators:true });
    if(!cat) return res.status(404).json({ success:false, message:"Category not found" });
    logAudit({ req, action:"update", entity:"category", entityId: cat._id, before, after: cat }).catch(()=>{});
    res.json({ success:true, data: cat });
  }catch(e){
    if(e.code===11000) return res.status(400).json({ success:false, message:"Category already exists" });
    next(e);
  }
}

export async function deleteCategory(req,res,next){
  try{
    const cat = await Category.findById(req.params.id);
    if(!cat) return res.status(404).json({ success:false, message:"Category not found" });
    const count = await Product.countDocuments({ category: cat._id, isActive: true });
    if(count>0){
      if(req.query.force!=="true"){
        return res.status(400).json({ success:false, message:`Cannot delete category. ${count} product(s) are using it. Use force or reassign.` });
      }
    }
    const beforeDel = await Category.findById(req.params.id).lean();
    await Category.findByIdAndDelete(req.params.id);
    logAudit({ req, action:"delete", entity:"category", entityId: req.params.id, before: beforeDel, after:null }).catch(()=>{});
    res.json({ success:true, message:"Category deleted" });
  }catch(e){ next(e); }
}
