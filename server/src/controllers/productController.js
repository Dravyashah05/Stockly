import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { logAudit } from "../utils/audit.js";
import { escapeRegex, isSafeObjectId } from "../utils/security.js";
import { v2 as cloudinary } from "cloudinary";

export async function getProducts(req, res, next) {
  try {
    const { search = "", category, lowStock, stockStatus, sort="createdAt", order="desc", page="1", limit="50", inStock } = req.query;
    const filter = { isActive: true };

    if (category && isSafeObjectId(category)) {
      filter.category = category;
    }

    if (search && typeof search === "string" && search.trim()) {
      const escaped = escapeRegex(search.trim());
      filter.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { sku: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ];
    }

    let query = Product.find(filter).populate("category", "name customFields").populate("supplier", "name");

    const sortOrder = order === "asc" ? 1 : -1;
    const allowedSort = ["name","quantity","createdAt","sku","price"];
    if(allowedSort.includes(sort)){
      query = query.sort({ [sort]: sortOrder });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pg-1)*lim;
    const total = await Product.countDocuments(filter);
    query = query.skip(skip).limit(lim);

    let products = await query;

    if (lowStock === "true" || stockStatus === "low") {
      products = products.filter((p) => p.quantity >0 && p.quantity <= (p.minimumStock ?? p.minimumQuantity ?? 5));
    } else if (stockStatus === "out") {
      products = products.filter(p=> p.quantity===0);
    } else if (stockStatus === "in") {
      products = products.filter(p=> p.quantity > (p.minimumStock ?? p.minimumQuantity ?? 5));
    }

    res.json({ success: true, data: products, pagination: { page: pg, limit: lim, total, pages: Math.ceil(total/lim) } });
  } catch (error) {
    next(error);
  }
}

export async function getProduct(req, res, next) {
  try {
    const product = await Product.findOne({ _id: req.params.id, isActive: true })
      .populate("category", "name customFields").populate("supplier", "name");

    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    res.json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
}

function generateSKU(name){
  const clean = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = (clean.substring(0,3).padEnd(3,'X')).substring(0,3);
  const time = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = Math.floor(1000 + Math.random()*9000);
  return `${prefix}-${time}${rand}`;
}
async function getUniqueSKU(name){
  for(let i=0;i<10;i++){
    const sku = generateSKU(name);
    const exists = await Product.findOne({ sku });
    if(!exists) return sku;
  }
  return `SKU-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random()*100000)}`;
}

function normalizeCustomData(customData, category){
  if(!customData || typeof customData !== "object") return {};
  if(!category || !Array.isArray(category.customFields) || !category.customFields.length) return customData;
  const allowed = new Map(category.customFields.map(f=> [f.key, f]));
  const out = {};
  for(const [k,v] of Object.entries(customData)){
    const def = allowed.get(k);
    if(!def) continue; // ignore unknown field
    if(def.type==="number"){
      const n = Number(v);
      if(!Number.isFinite(n)) continue;
      out[k]= n;
    } else if(def.type==="checkbox"){
      out[k]= !!v;
    } else {
      out[k]= String(v).slice(0,500);
      if(def.type==="select" && def.options.length && !def.options.includes(out[k])){
        // allow but keep as is; or skip validation
      }
    }
  }
  // check required
  for(const f of category.customFields){
    if(f.required && (out[f.key]===undefined || out[f.key]==="")){
      throw new Error(`Custom field "${f.label}" is required`);
    }
  }
  return out;
}

export async function createProduct(req, res, next) {
  try {
    let { name, sku, image, category, description, quantity, unit, minimumStock, minimumQuantity, price, customData } = req.body;
    if(!name) return res.status(400).json({ success:false, message:"Product name required" });
    if(!category) return res.status(400).json({ success:false, message:"Category required" });
    if(!unit) return res.status(400).json({ success:false, message:"Unit required" });
    if(quantity !== undefined && Number(quantity) <0) return res.status(400).json({ success:false, message:"Quantity cannot be negative" });
    if(price !== undefined && Number(price) <0) return res.status(400).json({ success:false, message:"Price cannot be negative" });

    const catExists = await Category.findById(category);
    if(!catExists) return res.status(400).json({ success:false, message:"Category not found" });

    if(sku && sku.trim()){
      sku = sku.trim().toUpperCase();
      const exists = await Product.findOne({ sku });
      if(exists) return res.status(400).json({ success:false, message:"SKU already exists" });
    } else {
      sku = await getUniqueSKU(name);
    }

    let normalizedCustom = {};
    try{
      normalizedCustom = normalizeCustomData(customData, catExists);
    }catch(e){
      return res.status(400).json({ success:false, message: e.message });
    }

    const product = await Product.create({
      name: name.trim(),
      sku,
      image: image || "",
      category,
      description: description || "",
      quantity: Number(quantity || 0),
      unit,
      minimumStock: minimumStock !== undefined ? Number(minimumStock) : (minimumQuantity !== undefined ? Number(minimumQuantity) : 5),
      minimumQuantity: minimumQuantity !== undefined ? Number(minimumQuantity) : undefined,
      price: price !== undefined ? Number(price) : 0,
      customData: normalizedCustom,
    });

    const populated = await product.populate("category","name customFields");
    logAudit({ req, action:"create", entity:"product", entityId: product._id, before:null, after: populated }).catch(()=>{});
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if(error.code===11000) return res.status(400).json({ success:false, message:"SKU must be unique" });
    next(error);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const fields = ["name", "sku", "image", "category", "description", "unit", "minimumStock", "minimumQuantity", "price", "customData"];
    const updates = {};

    for (const field of fields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if(updates.sku) updates.sku = updates.sku.toUpperCase();
    if(updates.minimumStock !== undefined) updates.minimumStock = Number(updates.minimumStock);
    if(updates.minimumQuantity !== undefined) updates.minimumQuantity = Number(updates.minimumQuantity);
    if(updates.price !== undefined) updates.price = Number(updates.price);
    if(updates.name) updates.name = updates.name.trim();
    if(updates.category){
      const catExists = await Category.findById(updates.category);
      if(!catExists) return res.status(400).json({ success:false, message:"Category not found" });
      // validate customData against new category if provided, else keep existing customData filtered
      if(updates.customData !== undefined){
        try{
          updates.customData = normalizeCustomData(updates.customData, catExists);
        }catch(e){ return res.status(400).json({ success:false, message: e.message }); }
      }
    } else if(updates.customData !== undefined){
      // need category to validate; fetch existing product's category
      const existing = await Product.findById(req.params.id).populate("category");
      const cat = existing?.category;
      if(cat){
        try{
          updates.customData = normalizeCustomData(updates.customData, cat);
        }catch(e){ return res.status(400).json({ success:false, message: e.message }); }
      }
    }

    if(updates.sku){
      const dup = await Product.findOne({ sku: updates.sku, _id: { $ne: req.params.id } });
      if(dup) return res.status(400).json({ success:false, message:"SKU already exists" });
    }

    const before = await Product.findOne({ _id: req.params.id, isActive:true }).lean();
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      updates,
      { new: true, runValidators: true }
    ).populate("category","name customFields");

    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    if(updates.minimumStock !== undefined && product.minimumQuantity !== product.minimumStock){
      product.minimumQuantity = product.minimumStock;
      await product.save();
    }

    logAudit({ req, action:"update", entity:"product", entityId: product._id, before, after: product }).catch(()=>{});
    res.json({ success: true, data: product });
  } catch (error) {
    if(error.code===11000) return res.status(400).json({ success:false, message:"SKU must be unique" });
    next(error);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { isActive: false },
      { new: true }
    );

    if (!product) return res.status(404).json({ success: false, message: "Product not found" });

    logAudit({ req, action:"delete", entity:"product", entityId: product._id, before: product, after:null }).catch(()=>{});
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    next(error);
  }
}

export async function bulkDeleteProducts(req, res, next) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: "Product IDs array is required" });
    }
    const result = await Product.updateMany(
      { _id: { $in: ids }, isActive: true },
      { $set: { isActive: false } }
    );
    logAudit({
      req,
      action: "delete",
      entity: "product",
      entityId: null,
      before: { count: ids.length, ids },
      after: { modifiedCount: result.modifiedCount }
    }).catch(() => {});
    res.json({
      success: true,
      message: `Deleted ${result.modifiedCount} products`,
      count: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdateProducts(req, res, next) {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: "Product IDs array is required" });
    }
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ success: false, message: "Updates object is required" });
    }
    const allowed = {};
    if (updates.category) {
      const catExists = await Category.findById(updates.category);
      if (!catExists) return res.status(400).json({ success: false, message: "Category not found" });
      allowed.category = updates.category;
    }
    if (updates.supplier !== undefined) allowed.supplier = updates.supplier || null;
    if (updates.unit) allowed.unit = String(updates.unit).trim();
    if (updates.minimumStock !== undefined && Number(updates.minimumStock) >= 0) {
      allowed.minimumStock = Number(updates.minimumStock);
      allowed.minimumQuantity = Number(updates.minimumStock);
    }

    if (!Object.keys(allowed).length) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    const result = await Product.updateMany(
      { _id: { $in: ids }, isActive: true },
      { $set: allowed }
    );

    logAudit({
      req,
      action: "update",
      entity: "product",
      entityId: null,
      before: { count: ids.length, ids },
      after: { updates: allowed, modifiedCount: result.modifiedCount }
    }).catch(() => {});

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} products`,
      count: result.modifiedCount
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image file provided" });
    }

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const uploadResult = await cloudinary.uploader.upload(dataURI, {
        folder: "stockly/products",
        resource_type: "image",
        transformation: [{ width: 800, height: 800, crop: "limit", quality: "auto" }]
      });
      return res.json({ success: true, url: uploadResult.secure_url });
    }

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    res.json({ success: true, url: dataURI });
  } catch (error) {
    next(error);
  }
}
