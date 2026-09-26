import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true, index: true },
    pin: { type: String, required: true, index: true },
    deviceInfo: {
      device: { type: String, default: "Unknown device" },
      browser: { type: String, default: "Unknown" },
      os: { type: String, default: "Unknown" },
      ip: { type: String, default: "" },
      isMobile: { type: Boolean, default: false },
      userAgent: { type: String, default: "" },
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "consumed", "expired"],
      default: "pending",
      index: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    token: { type: String, default: null },
    userData: {
      _id: { type: String, default: null },
      name: { type: String, default: null },
      email: { type: String, default: null },
    },
    authorizedByDevice: { type: String, default: "" },
    approvedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// auto-delete expired tickets (TTL)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("LoginTicket", schema);
