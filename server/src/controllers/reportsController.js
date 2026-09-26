import Product from "../models/Product.js";
import StockTransaction from "../models/StockTransaction.js";
import Category from "../models/Category.js";
import Supplier from "../models/Supplier.js";
import { safeDate, buildDateRangeFilter, isSafeObjectId } from "../utils/security.js";

function dateRangeFilter(startDate, endDate){
  return buildDateRangeFilter(startDate, endDate);
}

export async function dailyStockReport(req,res,next){
  try{
    const { date } = req.query; // YYYY-MM-DD
    const parsed = safeDate(date);
    const d = parsed || new Date();
    const start = new Date(d); start.setHours(0,0,0,0);
    const end = new Date(d); end.setHours(23,59,59,999);
    const tx = await StockTransaction.find({ createdAt:{ $gte:start, $lte:end } }).populate({ path:"productId", select:"name sku category", populate:{ path:"category", select:"name" } }).sort({ createdAt:-1 });
    const inQty = tx.filter(t=> t.type==="IN").reduce((a,b)=> a+Number(b.quantity||0),0);
    const outQty = tx.filter(t=> t.type==="OUT").reduce((a,b)=> a+Number(b.quantity||0),0);
    res.json({ success:true, data:{ date: start.toISOString().slice(0,10), transactions: tx, summary:{ total: tx.length, inQty, outQty, net: inQty-outQty } } });
  }catch(e){ next(e); }
}

export async function stockInReport(req,res,next){
  try{
    const { startDate, endDate, category, supplier, page="1", limit="50" } = req.query;
    const filter={ type:"IN", ...dateRangeFilter(startDate,endDate)};
    let tx = await StockTransaction.find(filter).populate({ path:"productId", select:"name sku category supplier price", populate:[{ path:"category", select:"name" }, { path:"supplier", select:"name" }] }).sort({ createdAt:-1 });
    if(category) tx = tx.filter(t=> String(t.productId?.category?._id||t.productId?.category)===String(category));
    if(supplier) tx = tx.filter(t=> String(t.supplier||t.productId?.supplier)===String(supplier));
    const pg=Math.max(1,parseInt(page)); const lim=Math.min(100,parseInt(limit));
    const total=tx.length;
    const paged=tx.slice((pg-1)*lim, pg*lim);
    const sumQty = tx.reduce((a,b)=> a+Number(b.quantity||0),0);
    const sumValue = tx.reduce((a,b)=> a+ Number(b.quantity||0) * Number(b.productId?.price||0),0);
    res.json({ success:true, data: paged, pagination:{ page:pg, limit:lim, total, pages:Math.ceil(total/lim) }, summary:{ total, sumQty, sumValue } });
  }catch(e){ next(e); }
}

export async function stockOutReport(req,res,next){
  try{
    const { startDate, endDate, category, page="1", limit="50" } = req.query;
    const filter={ type:"OUT", ...dateRangeFilter(startDate,endDate)};
    let tx = await StockTransaction.find(filter).populate({ path:"productId", select:"name sku category price", populate:{ path:"category", select:"name" } }).sort({ createdAt:-1 });
    if(category) tx = tx.filter(t=> String(t.productId?.category?._id||t.productId?.category)===String(category));
    const pg=Math.max(1,parseInt(page)); const lim=Math.min(100,parseInt(limit));
    const total=tx.length;
    const paged=tx.slice((pg-1)*lim, pg*lim);
    const sumQty = tx.reduce((a,b)=> a+Number(b.quantity||0),0);
    res.json({ success:true, data: paged, pagination:{ page:pg, limit:lim, total, pages:Math.ceil(total/lim) }, summary:{ total, sumQty } });
  }catch(e){ next(e); }
}

export async function lowStockReport(req,res,next){
  try{
    const products = await Product.find({ isActive:true }).populate("category","name");
    const low = products.filter(p=> {
      const min = p.minimumStock ?? p.minimumQuantity ?? 5;
      return p.quantity>0 && p.quantity <= min;
    });
    const out = products.filter(p=> p.quantity===0);
    res.json({ success:true, data:{ low, out, totalLow: low.length, totalOut: out.length } });
  }catch(e){ next(e); }
}

export async function categoryWiseInventory(req,res,next){
  try{
    const categories = await Category.find().sort({ name:1 });
    const agg = await Product.aggregate([
      { $match:{ isActive:true } },
      { $group:{ _id:"$category", productCount:{ $sum:1 }, totalStock:{ $sum:"$quantity" }, totalValue:{ $sum:{ $multiply:["$quantity", { $ifNull:["$price",0] }] } } } }
    ]);
    const map=new Map(agg.map(a=>[String(a._id), a]));
    const data=categories.map(c=>{
      const s=map.get(String(c._id))||{ productCount:0, totalStock:0, totalValue:0 };
      return { category:c, productCount:s.productCount, totalStock:s.totalStock, totalValue:s.totalValue };
    });
    const totals = { productCount: data.reduce((a,b)=>a+b.productCount,0), totalStock: data.reduce((a,b)=>a+b.totalStock,0), totalValue: data.reduce((a,b)=>a+b.totalValue,0) };
    res.json({ success:true, data, totals });
  }catch(e){ next(e); }
}

export async function supplierWisePurchases(req,res,next){
  try{
    const { startDate, endDate } = req.query;
    const filter={ type:"IN", ...dateRangeFilter(startDate,endDate)};
    const tx = await StockTransaction.find(filter).populate("supplier","name").populate({ path:"productId", select:"name price" });
    const map=new Map();
    tx.forEach(t=>{
      const sid = t.supplier?._id ? String(t.supplier._id) : (t.supplier ? String(t.supplier) : "Unknown");
      const name = t.supplier?.name || "Unknown / No Supplier";
      const cur = map.get(sid) || { supplier: t.supplier || { _id: sid, name }, totalQty:0, totalValue:0, count:0 };
      cur.totalQty += Number(t.quantity||0);
      cur.totalValue += Number(t.quantity||0) * Number(t.productId?.price||0);
      cur.count +=1;
      map.set(sid, cur);
    });
    const data = Array.from(map.values()).sort((a,b)=> b.totalValue - a.totalValue);
    res.json({ success:true, data });
  }catch(e){ next(e); }
}

export async function productMovement(req,res,next){
  try{
    const { productId, startDate, endDate, page="1", limit="50" } = req.query;
    if(!productId || !isSafeObjectId(productId)) return res.status(400).json({ success:false, message:"Valid productId required" });
    const filter={ productId, ...dateRangeFilter(startDate,endDate)};
    const pg=Math.max(1,parseInt(page)); const lim=Math.min(100,parseInt(limit));
    const total=await StockTransaction.countDocuments(filter);
    const tx=await StockTransaction.find(filter).populate("productId","name sku").populate("supplier","name").sort({ createdAt:-1 }).skip((pg-1)*lim).limit(lim);
    const product=await Product.findById(productId).populate("category","name").select("name sku quantity price unit");
    const summary = await StockTransaction.aggregate([
      { $match: { productId: product?._id } },
      { $group:{ _id:"$type", totalQty:{ $sum:"$quantity" }, count:{ $sum:1 } } }
    ]);
    res.json({ success:true, data: tx, product, pagination:{ page:pg, limit:lim, total, pages:Math.ceil(total/lim) }, summary });
  }catch(e){ next(e); }
}

export async function stockValuation(req,res,next){
  try{
    const products = await Product.find({ isActive:true }).populate("category","name");
    const byCategory = {};
    let grandUnits=0, grandValue=0;
    products.forEach(p=>{
      const cat = p.category?.name || "Uncategorized";
      if(!byCategory[cat]) byCategory[cat]={ category: cat, units:0, value:0, products:0 };
      const val = Number(p.quantity||0) * Number(p.price||0);
      byCategory[cat].units += Number(p.quantity||0);
      byCategory[cat].value += val;
      byCategory[cat].products +=1;
      grandUnits += Number(p.quantity||0);
      grandValue += val;
    });
    const data = Object.values(byCategory).sort((a,b)=> b.value - a.value);
    res.json({ success:true, data, totals:{ grandUnits, grandValue, productCount: products.length } });
  }catch(e){ next(e); }
}

export async function monthlyInventorySummary(req,res,next){
  try{
    const { year } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const start = new Date(y,0,1); const end = new Date(y,11,31,23,59,59,999);
    const tx = await StockTransaction.find({ createdAt:{ $gte:start, $lte:end } });
    const months = Array.from({length:12}, (_,i)=> ({ month:i+1, label: new Date(y,i,1).toLocaleString(undefined,{ month:"short" }), inQty:0, outQty:0, count:0 }));
    tx.forEach(t=>{
      const m = new Date(t.createdAt).getMonth();
      if(t.type==="IN") months[m].inQty += Number(t.quantity||0);
      else months[m].outQty += Number(t.quantity||0);
      months[m].count +=1;
    });
    const productsYearEnd = await Product.countDocuments({ isActive:true });
    res.json({ success:true, data:{ year: y, months, totals:{ totalIn: months.reduce((a,b)=>a+b.inQty,0), totalOut: months.reduce((a,b)=>a+b.outQty,0), totalCount: tx.length, productsYearEnd } } });
  }catch(e){ next(e); }
}
