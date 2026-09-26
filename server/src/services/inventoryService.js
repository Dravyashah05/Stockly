import mongoose from "mongoose";
import Product from "../models/Product.js";
import StockTransaction from "../models/StockTransaction.js";

export async function changeStock({ productId, type, quantity, reason="Adjustment", notes = "", supplier=null, createdBy=null }) {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const err = new Error("Quantity must be greater than zero");
    err.status = 400;
    throw err;
  }
  if(!["IN","OUT"].includes(type)){
    const err = new Error("Type must be IN or OUT");
    err.status = 400;
    throw err;
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const product = await Product.findById(productId).session(session);
    if (!product) {
      const err = new Error("Product not found");
      err.status = 404;
      throw err;
    }

    const previousQuantity = product.quantity;

    if (type === "OUT") {
      if (product.quantity < quantity) {
        const err = new Error(`Insufficient stock. Available: ${product.quantity} ${product.unit}`);
        err.status = 400;
        throw err;
      }
      product.quantity -= quantity;
    } else {
      product.quantity += quantity;
    }

    await product.save({ session });

    const [tx] = await StockTransaction.create([{
      productId,
      product: productId,
      type,
      quantity,
      previousQuantity,
      newQuantity: product.quantity,
      reason,
      notes,
      supplier: supplier || null,
      createdBy
    }], { session });

    await session.commitTransaction();
    return { product, transaction: tx };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
