import mongoose from "mongoose";
import { AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_OPTIONS } from "../constants/index.js";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  userName: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  action: { type: String, required: true, enum: AUDIT_ACTION_OPTIONS },
  entity: { type: String, required: true, enum: AUDIT_ENTITY_OPTIONS },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
}, { timestamps: true });

schema.index({ createdAt: -1 });
schema.index({ entity: 1, entityId: 1 });
schema.index({ user: 1, createdAt: -1 });

export default mongoose.model("AuditLog", schema);
