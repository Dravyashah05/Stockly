import Supplier from "../models/Supplier.js";
import { logAudit } from "../utils/audit.js";
import { escapeRegex, isSafeObjectId } from "../utils/security.js";

export async function getSuppliers(req,res,next){
  try{
    const { search="" } = req.query;
    const filter={};
    if(search && typeof search === "string" && search.trim()) {
      filter.name = { $regex: escapeRegex(search.trim()), $options:"i" };
    }
    const list = await Supplier.find(filter).sort({ createdAt:-1 });
    res.json({ success:true, data: list });
  }catch(e){ next(e); }
}
export async function createSupplier(req,res,next){
  try{
    const { name, contact, email, address } = req.body;
    if(!name) return res.status(400).json({ success:false, message:"Name required" });
    const s = await Supplier.create({ name: name.trim(), contact: contact||"", email: (email||"").toLowerCase(), address: address||"" });
    logAudit({ req, action:"create", entity:"supplier", entityId: s._id, before:null, after:s }).catch(()=>{});
    res.status(201).json({ success:true, data: s });
  }catch(e){
    if(e.code===11000) return res.status(400).json({ success:false, message:"Supplier already exists" });
    next(e);
  }
}
export async function updateSupplier(req,res,next){
  try{
    if(!isSafeObjectId(req.params.id)) return res.status(400).json({ success:false, message:"Invalid supplier ID" });
    const updates={};
    if(req.body.name!==undefined) updates.name=req.body.name.trim();
    if(req.body.contact!==undefined) updates.contact=req.body.contact;
    if(req.body.email!==undefined) updates.email=req.body.email.toLowerCase();
    if(req.body.address!==undefined) updates.address=req.body.address;
    const before = await Supplier.findById(req.params.id).lean();
    const s = await Supplier.findByIdAndUpdate(req.params.id, updates, { new:true, runValidators:true });
    if(!s) return res.status(404).json({ success:false, message:"Supplier not found" });
    logAudit({ req, action:"update", entity:"supplier", entityId: s._id, before, after:s }).catch(()=>{});
    res.json({ success:true, data: s });
  }catch(e){ next(e); }
}
export async function deleteSupplier(req,res,next){
  try{
    if(!isSafeObjectId(req.params.id)) return res.status(400).json({ success:false, message:"Invalid supplier ID" });
    const beforeDel = await Supplier.findById(req.params.id).lean();
    const s = await Supplier.findByIdAndDelete(req.params.id);
    if(!s) return res.status(404).json({ success:false, message:"Supplier not found" });
    logAudit({ req, action:"delete", entity:"supplier", entityId: req.params.id, before: beforeDel, after:null }).catch(()=>{});
    res.json({ success:true, message:"Supplier deleted" });
  }catch(e){ next(e); }
}
