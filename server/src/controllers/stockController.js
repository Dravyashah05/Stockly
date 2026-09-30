import mongoose from "mongoose";
import StockTransaction from "../models/StockTransaction.js";
import Product from "../models/Product.js";
import { changeStock } from "../services/inventoryService.js";
import { logAudit } from "../utils/audit.js";
import { buildDateRangeFilter, escapeRegex, isSafeObjectId } from "../utils/security.js";

export async function stockIn(req, res, next) {
  try {
    const { productId, quantity, reason, notes } = req.body;
    if(!productId) return res.status(400).json({ success:false, message:"productId required" });
    const result = await changeStock({
      productId,
      type: "IN",
      quantity: Number(quantity),
      reason: reason || "Purchase",
      notes: notes || "",
      supplier: req.body.supplier || null,
      createdBy: req.user?._id || null
    });
    logAudit({ req, action:"stock_in", entity:"stock", entityId: result.transaction._id, before:null, after: result.transaction }).catch(()=>{});
    res.json({ success: true, data: result.product, transaction: result.transaction });
  } catch (error) {
    if(error.status) return res.status(error.status).json({ success:false, message:error.message });
    next(error);
  }
}

export async function stockOut(req, res, next) {
  try {
    const { productId, quantity, reason, notes } = req.body;
    if(!productId) return res.status(400).json({ success:false, message:"productId required" });
    const result = await changeStock({
      productId,
      type: "OUT",
      quantity: Number(quantity),
      reason: reason || "Sale",
      notes: notes || "",
      supplier: req.body.supplier || null,
      createdBy: req.user?._id || null
    });
    logAudit({ req, action:"stock_out", entity:"stock", entityId: result.transaction._id, before:null, after: result.transaction }).catch(()=>{});
    res.json({ success: true, data: result.product, transaction: result.transaction });
  } catch (error) {
    if(error.status) return res.status(error.status).json({ success:false, message:error.message });
    next(error);
  }
}

export async function getStockHistory(req, res, next) {
  try {
    // supports both /history/:productId legacy and /history with filters
    const { productId } = req.params;
    const { product, type, startDate, endDate, category, search, page="1", limit="20" } = req.query;
    const filter={ ...buildDateRangeFilter(startDate, endDate) };
    if(productId && isSafeObjectId(productId)) filter.productId = productId;
    if(product && isSafeObjectId(product)) filter.productId = product;
    if(type && ["IN","OUT"].includes(type)) filter.type = type;
    // Resolve category/search to DB-level conditions FIRST so pagination
    // totals stay honest (post-filtering after skip/limit returned wrong
    // totals and hollow pages).
    let categoryIds = null;
    // Category + search product-id lookups are independent — run together.
    const needCategoryIds = category && isSafeObjectId(category);
    const trimmedSearch = search && typeof search === "string" && search.trim() ? search.trim() : "";
    const escaped = trimmedSearch ? escapeRegex(trimmedSearch) : null;
    const [categoryRows, matchedRows] = await Promise.all([
      needCategoryIds
        ? Product.find({ category, isActive: true }).select("_id").lean()
        : Promise.resolve(null),
      escaped
        ? Product.find({
            $or: [
              { name: { $regex: escaped, $options: "i" } },
              { sku: { $regex: escaped, $options: "i" } },
            ],
          }).select("_id").lean()
        : Promise.resolve(null),
    ]);
    if (categoryRows) {
      categoryIds = categoryRows.map((p) => p._id);
      filter.productId = { $in: categoryIds };
    }
    if (matchedRows) {
      let matchedIds = matchedRows.map((p) => p._id);
      // Honor product/category constraints already in the filter.
      let scalarProductId = null;
      if (filter.productId && filter.productId.$in) {
        const allowed = new Set(filter.productId.$in.map(String));
        matchedIds = matchedIds.filter((id) => allowed.has(String(id)));
      } else if (filter.productId) {
        scalarProductId = filter.productId;
        matchedIds = matchedIds.filter((id) => String(id) === String(scalarProductId));
      }
      let reasonCond = { reason: { $regex: escaped, $options: "i" } };
      if (scalarProductId) reasonCond = { $and: [reasonCond, { productId: scalarProductId }] };
      // (product name/sku match) OR (reason match). When a category filter
      // is active, reason-matched rows must still belong to that category.
      delete filter.productId;
      const productBranch = { productId: { $in: matchedIds } };
      filter.$and = [...(filter.$and || []), categoryIds
        ? { $or: [productBranch, { $and: [reasonCond, { productId: { $in: categoryIds } }] }] }
        : { $or: [productBranch, reasonCond] }];
    }
    const pg = Math.max(1, parseInt(page));
    const lim = Math.min(100, Math.max(1, parseInt(limit)));
    // Count + page fetch in parallel (one RTT instead of two).
    const [total, transactions] = await Promise.all([
      StockTransaction.countDocuments(filter),
      StockTransaction.find(filter).populate({ path:"productId", select:"name sku unit image category supplier", populate:[{ path:"category", select:"name" }, { path:"supplier", select:"name" }] }).populate("supplier","name").sort({ createdAt:-1 }).skip((pg-1)*lim).limit(lim).lean(),
    ]);

    res.json({ success: true, data: transactions, pagination:{ page:pg, limit:lim, total, pages: Math.ceil(total/lim) } });
  } catch (error) { next(error); }
}

export async function getRecentTransactions(req,res,next){
  try{
    const { limit="10" } = req.query;
    const tx = await StockTransaction.find().populate({ path:"productId", select:"name sku unit image supplier", populate:{ path:"supplier", select:"name" } }).populate("supplier","name").sort({ createdAt:-1 }).limit(Math.min(50,parseInt(limit))).lean();
    res.json({ success:true, data: tx });
  }catch(e){ next(e); }
}

export async function updateStockTransaction(req,res,next){
  try{
    const { id } = req.params;
    const { reason, notes, quantity, type } = req.body;
    const tx = await StockTransaction.findById(id);
    if(!tx) return res.status(404).json({ success:false, message:"Transaction not found" });

    // If quantity/type is being changed, we need to revert and re-apply stock atomically
    const newQuantity = quantity !== undefined ? Number(quantity) : tx.quantity;
    const newType = type || tx.type;
    const newReason = reason !== undefined ? reason : tx.reason;
    const newNotes = notes !== undefined ? notes : tx.notes;

    if(!Number.isFinite(newQuantity) || newQuantity <= 0) return res.status(400).json({ success:false, message:"Quantity must be >0" });
    if(!["IN","OUT"].includes(newType)) return res.status(400).json({ success:false, message:"Type must be IN or OUT" });

    const before = { ...tx.toObject() };
    // If quantity or type unchanged, simple update of reason/notes
    if(newQuantity === tx.quantity && newType === tx.type){
      tx.reason = newReason;
      tx.notes = newNotes;
      await tx.save();
      const populated = await tx.populate({ path:"productId", select:"name sku unit image category", populate:{ path:"category", select:"name" } });
      logAudit({ req, action:"update", entity:"stock", entityId: tx._id, before, after: populated }).catch(()=>{});
      return res.json({ success:true, data: populated });
    }

    // Need atomic stock adjustment
    const session = await mongoose.startSession();
    try{
      session.startTransaction();
      const product = await Product.findById(tx.productId).session(session);
      if(!product) { await session.abortTransaction(); return res.status(404).json({ success:false, message:"Product not found" }); }

      // Revert old transaction effect
      if(tx.type === "IN") product.quantity -= tx.quantity;
      else product.quantity += tx.quantity;

      if(product.quantity < 0) product.quantity = 0;

      // Apply new effect
      if(newType === "IN") product.quantity += newQuantity;
      else {
        if(product.quantity < newQuantity){
          await session.abortTransaction();
          return res.status(400).json({ success:false, message:`Insufficient stock. Available: ${product.quantity}` });
        }
        product.quantity -= newQuantity;
      }

      await product.save({ session });

      tx.quantity = newQuantity;
      tx.type = newType;
      tx.reason = newReason;
      tx.notes = newNotes;
      // recalc previous/new quantities based on final product state (approx)
      // previous was before new effect, new is after
      const newPrev = newType === "IN" ? product.quantity - newQuantity : product.quantity + newQuantity;
      tx.previousQuantity = newPrev;
      tx.newQuantity = product.quantity;

      await tx.save({ session });
      await session.commitTransaction();
      const populated = await StockTransaction.findById(tx._id).populate({ path:"productId", select:"name sku unit image category", populate:{ path:"category", select:"name" } });
      logAudit({ req, action:"update", entity:"stock", entityId: tx._id, before, after: populated }).catch(()=>{});
      res.json({ success:true, data: populated });
    } catch(e){
      await session.abortTransaction();
      throw e;
    } finally{
      await session.endSession();
    }
  }catch(e){ next(e); }
}

export async function deleteStockTransaction(req,res,next){
  try{
    const { id } = req.params;
    const tx = await StockTransaction.findById(id);
    if(!tx) return res.status(404).json({ success:false, message:"Transaction not found" });

    const session = await mongoose.startSession();
    try{
      session.startTransaction();
      const product = await Product.findById(tx.productId).session(session);
      if(!product){ await session.abortTransaction(); return res.status(404).json({ success:false, message:"Product not found" }); }

      // Revert stock
      if(tx.type === "IN"){
        product.quantity -= tx.quantity;
        if(product.quantity < 0) product.quantity = 0;
      } else {
        product.quantity += tx.quantity;
      }
      await product.save({ session });
      const beforeDel = { ...tx.toObject() };
      await StockTransaction.findByIdAndDelete(id).session(session);
      await session.commitTransaction();
      logAudit({ req, action:"delete", entity:"stock", entityId: id, before: beforeDel, after:null }).catch(()=>{});
      res.json({ success:true, message:"Transaction deleted and stock reverted", data: product });
    } catch(e){
      await session.abortTransaction();
      throw e;
    } finally{
      await session.endSession();
    }
  }catch(e){ next(e); }
}
