import mongoose from "mongoose";
import { TRANSACTION_TYPE_OPTIONS } from "../constants/index.js";

const schema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, // alias for populate compat
  type: { type: String, enum: TRANSACTION_TYPE_OPTIONS, required: true },
  quantity: { type: Number, required: true, min: 0.000001 },
  previousQuantity: { type: Number, default: 0 },
  newQuantity: { type: Number, default: 0 },
  reason: { type: String, required: true, trim: true, default: "Adjustment" },
  notes: { type: String, default: "" },
  supplier: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
  referenceId: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

schema.index({ productId: 1, createdAt: -1 });
schema.index({ type: 1 });
schema.index({ createdAt: -1 });

export default mongoose.model("StockTransaction", schema);
