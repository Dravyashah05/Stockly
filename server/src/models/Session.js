import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jti: { type: String, required: true, unique: true, index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    device: { type: String, default: "Unknown device" },
    browser: { type: String, default: "Unknown" },
    os: { type: String, default: "Unknown" },
    isMobile: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

// auto-delete expired sessions (TTL). mongod requires expireAfterSeconds on a date field.
// Use expiresAt with 0 seconds after expiry.
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Session", schema);
