import mongoose from "mongoose";
import { CUSTOM_FIELD_TYPE_OPTIONS, CATEGORY_STATUS_OPTIONS } from "../constants/index.js";

const customFieldSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, lowercase: true, match: [/^[a-z0-9_]+$/, "key must be alphanumeric/underscore"] },
  label: { type: String, required: true, trim: true, maxlength: 50 },
  type: { type: String, enum: CUSTOM_FIELD_TYPE_OPTIONS, default: "text" },
  options: { type: [String], default: [] }, // for select
  required: { type: Boolean, default: false },
}, { _id: false });

const schema = new mongoose.Schema({
  name: { type: String, required: [true, "Category name is required"], unique: true, trim: true, maxlength: 100 },
  description: { type: String, default: "", maxlength: 500 },
  status: { type: String, enum: CATEGORY_STATUS_OPTIONS, default: "active" },
  isActive: { type: Boolean, default: true },
  customFields: { type: [customFieldSchema], default: [] },
}, { timestamps: true });

export default mongoose.model("Category", schema);
