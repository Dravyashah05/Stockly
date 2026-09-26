import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    codeHash: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, index: true },
    // device that generated the code, so the user can tell which pairing is pending
    sourceDevice: { type: String, default: "Unknown device" },
    sourceJti: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
    usedAt: { type: Date, default: null },
    claimedDevice: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// auto-delete expired codes (TTL)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("LoginCode", schema);
