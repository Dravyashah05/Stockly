import mongoose from "mongoose";

const schema = new mongoose.Schema({
  name: { type: String, required: [true, "Supplier name required"], trim: true, maxlength: 100, unique: true },
  contact: { type: String, default: "", trim: true },
  email: { type: String, default: "", trim: true, lowercase: true },
  address: { type: String, default: "", maxlength: 500 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default mongoose.model("Supplier", schema);
