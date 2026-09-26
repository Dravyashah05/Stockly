import crypto from "crypto";
import User from "../models/User.js";
import Session from "../models/Session.js";
import LoginCode from "../models/LoginCode.js";
import LoginTicket from "../models/LoginTicket.js";
import { sign, createSession, parseDevice, SESSION_TTL_DAYS } from "../utils/authTokens.js";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../constants/index.js";
import logger from "../utils/logger.js";

// 32-char alphabet with visually ambiguous characters (0/O, 1/I/L) removed.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const PIN_LENGTH = 6;
const CODE_TTL_SECONDS = 120;
const MAX_ATTEMPTS = 5;

function sha256(value){
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeEqualHex(a, b){
  const bufA = Buffer.from(String(a), "hex");
  const bufB = Buffer.from(String(b), "hex");
  if(bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function randomCode(length = CODE_LENGTH){
  let out = "";
  for(let i=0;i<length;i++){
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
}

function randomKey(){
  return crypto.randomBytes(32).toString("base64url");
}

// Accept "abcd-efgh", "ABCDEFGH", " abcd efgh " etc. and normalise to canonical form.
export function normalizeCode(raw){
  if(typeof raw !== "string") return "";
  return raw.toUpperCase().split("").filter(ch => CODE_ALPHABET.includes(ch)).join("");
}

// Build the URL encoded in the QR image. When scanned by a phone's native camera this
// opens the login page with the code pre-filled and ready to submit.
function buildPairingUrl(origin, code, key){
  const base = String(origin || "").replace(/\/+$/, "");
  const url = `${base}/login?code=${encodeURIComponent(code)}&key=${encodeURIComponent(key)}`;
  return url;
}

function resolveOrigin(req){
  const configured = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",").map(s => s.trim()).filter(Boolean);
  const requested = typeof req.body?.origin === "string" ? req.body.origin.replace(/\/+$/, "") : "";
  // only ever emit a link to an origin we already trust, otherwise fall back to config
  if(requested && configured.includes(requested)) return requested;
  return configured[0] || "http://localhost:5173";
}

// ==========================================
// WORKFLOW 1: PAIRING CODE (Logged-in -> New Device)
// ==========================================

// POST /api/auth/pairing/code (authRequired) — issue a one-time pairing code
export async function createPairingCode(req, res, next){
  try{
    const { device } = parseDevice(req.headers["user-agent"] || "");
    const code = randomCode();
    const key = randomKey();

    // only one live code per user — issuing a new one retires the previous
    await LoginCode.deleteMany({ user: req.user._id, usedAt: null }).catch(()=>{});

    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);
    await LoginCode.create({
      user: req.user._id,
      codeHash: sha256(code),
      keyHash: sha256(key),
      sourceDevice: device,
      sourceJti: req.user.jti || "",
      expiresAt,
    });

    res.json({
      success: true,
      data: {
        code,
        key,
        url: buildPairingUrl(resolveOrigin(req), code, key),
        expiresAt,
        expiresIn: CODE_TTL_SECONDS,
      }
    });
  }catch(e){ next(e); }
}

// GET /api/auth/pairing/code/status (authRequired) — check if pending pairing code was claimed
export async function getPairingStatus(req, res, next){
  try{
    const latest = await LoginCode.findOne({ user: req.user._id }).sort({ createdAt: -1 });
    if(!latest){
      return res.json({ success: true, data: { active: false } });
    }
    const isExpired = new Date(latest.expiresAt).getTime() < Date.now();
    const isUsed = !!latest.usedAt;

    res.json({
      success: true,
      data: {
        active: !isExpired && !isUsed,
        claimed: isUsed,
        claimedDevice: latest.claimedDevice || "",
        usedAt: latest.usedAt,
        isExpired,
        expiresAt: latest.expiresAt,
      }
    });
  }catch(e){ next(e); }
}

// DELETE /api/auth/pairing/code (authRequired) — cancel a pending code
export async function cancelPairingCode(req, res, next){
  try{
    const res1 = await LoginCode.deleteMany({ user: req.user._id, usedAt: null });
    res.json({ success: true, message: "Pairing code cancelled", data: { revoked: res1.deletedCount || 0 } });
  }catch(e){ next(e); }
}

// POST /api/auth/pairing/claim (public, rate limited) — redeem a code for a session
export async function claimPairingCode(req, res, next){
  try{
    const code = normalizeCode(req.body?.code);
    if(code.length !== CODE_LENGTH){
      return res.status(400).json({ success: false, message: "Enter the 8-character code" });
    }
    const key = typeof req.body?.key === "string" ? req.body.key : "";

    const record = await LoginCode.findOne({ codeHash: sha256(code) });
    if(!record){
      return res.status(400).json({ success: false, message: "That code is not valid" });
    }
    if(record.usedAt){
      return res.status(410).json({ success: false, message: "That code has already been used" });
    }
    if(new Date(record.expiresAt).getTime() < Date.now()){
      await LoginCode.deleteOne({ _id: record._id }).catch(()=>{});
      return res.status(410).json({ success: false, message: "That code has expired. Generate a new one." });
    }

    // A scanned QR carries the key and must match. A hand-typed code has no key,
    // so the short code plus the attempt cap is the whole security boundary there.
    if(key && !safeEqualHex(record.keyHash, sha256(key))){
      record.attempts = (record.attempts || 0) + 1;
      if(record.attempts >= MAX_ATTEMPTS){
        await LoginCode.deleteOne({ _id: record._id }).catch(()=>{});
        return res.status(410).json({ success: false, message: "Too many attempts. Generate a new code." });
      }
      await record.save().catch(()=>{});
      return res.status(400).json({ success: false, message: "That code is not valid" });
    }

    // burn the code first so two racing requests can never both win
    const claimingDevice = parseDevice(req.headers["user-agent"] || "").device;
    const claimed = await LoginCode.findOneAndUpdate(
      { _id: record._id, usedAt: null },
      { $set: { usedAt: new Date(), claimedDevice: claimingDevice } },
      { new: true }
    );
    if(!claimed){
      return res.status(410).json({ success: false, message: "That code has already been used" });
    }

    const user = await User.findById(claimed.user);
    if(!user){
      return res.status(400).json({ success: false, message: "That code is not valid" });
    }

    const jti = crypto.randomUUID();
    const token = sign(user, jti);
    await createSession(user, req, jti);

    try{
      const { logAudit } = await import("../utils/audit.js");
      await logAudit({
        req: { ...req, user: { _id: user._id, name: user.name, email: user.email } },
        action: AUDIT_ACTIONS.LOGIN,
        entity: AUDIT_ENTITIES.SESSION,
        entityId: jti,
        before: null,
        after: { method: "pairing_code", device: claimed.claimedDevice },
      });
    }catch(e){ logger.error("audit log failed", e.message); }

    res.json({ success: true, data: { token, user: { _id: user._id, name: user.name, email: user.email } } });
  }catch(e){ next(e); }
}

// ==========================================
// WORKFLOW 2: QUICK QR / TICKET LOGIN (New Device -> Mobile Authorizes)
// ==========================================

// POST /api/auth/pairing/ticket (public) — new device initiates QR login request
export async function createLoginTicket(req, res, next){
  try{
    const ua = req.headers["user-agent"] || "";
    const parsed = parseDevice(ua);
    const ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "";

    const ticketId = crypto.randomUUID();
    const pin = randomCode(PIN_LENGTH);
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

    await LoginTicket.create({
      ticketId,
      pin,
      deviceInfo: {
        device: parsed.device,
        browser: parsed.browser,
        os: parsed.os,
        ip,
        isMobile: parsed.isMobile,
        userAgent: ua,
      },
      status: "pending",
      expiresAt,
    });

    const origin = resolveOrigin(req);
    const qrPayload = JSON.stringify({
      type: "stockly_login_ticket",
      ticketId,
      pin,
      origin,
    });

    res.json({
      success: true,
      data: {
        ticketId,
        pin,
        qrPayload,
        expiresIn: CODE_TTL_SECONDS,
        expiresAt,
      }
    });
  }catch(e){ next(e); }
}

// GET /api/auth/pairing/ticket/:ticketId (public) — new device polls for authorization
export async function pollLoginTicket(req, res, next){
  try{
    const { ticketId } = req.params;
    if(!ticketId) return res.status(400).json({ success: false, message: "Ticket ID required" });

    const ticket = await LoginTicket.findOne({ ticketId });
    if(!ticket){
      return res.json({ success: true, data: { status: "expired" } });
    }

    if(new Date(ticket.expiresAt).getTime() < Date.now()){
      return res.json({ success: true, data: { status: "expired" } });
    }

    if(ticket.status === "approved" && ticket.token){
      // Consume the ticket so it can only be redeemed once
      await LoginTicket.updateOne({ _id: ticket._id }, { status: "consumed" });
      return res.json({
        success: true,
        data: {
          status: "approved",
          token: ticket.token,
          user: ticket.userData,
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: ticket.status,
      }
    });
  }catch(e){ next(e); }
}

// GET /api/auth/pairing/ticket/info/:identifier (authRequired) — logged-in user looks up ticket info
export async function getTicketInfo(req, res, next){
  try{
    const identifier = String(req.params.identifier || "").trim();
    if(!identifier) return res.status(400).json({ success: false, message: "Identifier required" });

    const isPin = normalizeCode(identifier).length === PIN_LENGTH;
    const query = isPin ? { pin: normalizeCode(identifier) } : { ticketId: identifier };

    const ticket = await LoginTicket.findOne(query);
    if(!ticket || new Date(ticket.expiresAt).getTime() < Date.now()){
      return res.status(404).json({ success: false, message: "Ticket not found or has expired" });
    }

    if(ticket.status !== "pending"){
      return res.status(400).json({ success: false, message: `Ticket is already ${ticket.status}` });
    }

    res.json({
      success: true,
      data: {
        ticketId: ticket.ticketId,
        pin: ticket.pin,
        deviceInfo: ticket.deviceInfo,
        status: ticket.status,
        expiresAt: ticket.expiresAt,
      }
    });
  }catch(e){ next(e); }
}

// POST /api/auth/pairing/ticket/authorize (authRequired) — logged-in user approves a login request
export async function authorizeLoginTicket(req, res, next){
  try{
    const { ticketId, pin } = req.body;
    if(!ticketId && !pin){
      return res.status(400).json({ success: false, message: "ticketId or pin is required" });
    }

    const query = ticketId ? { ticketId } : { pin: normalizeCode(pin) };
    const ticket = await LoginTicket.findOne(query);

    if(!ticket || new Date(ticket.expiresAt).getTime() < Date.now()){
      return res.status(404).json({ success: false, message: "Ticket not found or has expired" });
    }

    if(ticket.status !== "pending"){
      return res.status(400).json({ success: false, message: `Ticket has already been ${ticket.status}` });
    }

    const user = await User.findById(req.user._id);
    if(!user){
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const jti = crypto.randomUUID();
    const token = sign(user, jti);

    // Create a new session for the requesting device
    const reqDevice = ticket.deviceInfo || {};
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    await Session.create({
      user: user._id,
      jti,
      userAgent: reqDevice.userAgent || "",
      ip: reqDevice.ip || "",
      device: reqDevice.device || "Unknown device",
      browser: reqDevice.browser || "Unknown",
      os: reqDevice.os || "Unknown",
      isMobile: !!reqDevice.isMobile,
      expiresAt,
      lastActiveAt: new Date(),
    }).catch(e => {
      if(e.code !== 11000) logger.error("createSession error on ticket authorization", e);
    });

    const approvingDevice = parseDevice(req.headers["user-agent"] || "").device;

    ticket.status = "approved";
    ticket.user = user._id;
    ticket.token = token;
    ticket.userData = {
      _id: String(user._id),
      name: user.name,
      email: user.email,
    };
    ticket.authorizedByDevice = approvingDevice;
    ticket.approvedAt = new Date();
    await ticket.save();

    try{
      const { logAudit } = await import("../utils/audit.js");
      await logAudit({
        req: { ...req, user: { _id: user._id, name: user.name, email: user.email } },
        action: AUDIT_ACTIONS.LOGIN,
        entity: AUDIT_ENTITIES.SESSION,
        entityId: jti,
        before: null,
        after: { method: "qr_ticket_authorize", device: reqDevice.device, authorizedBy: approvingDevice },
      });
    }catch(e){ logger.error("audit log failed", e.message); }

    res.json({
      success: true,
      message: "Device approved successfully",
      data: {
        ticketId: ticket.ticketId,
        authorizedDevice: reqDevice.device,
      }
    });
  }catch(e){ next(e); }
}

// POST /api/auth/pairing/ticket/reject (authRequired) — logged-in user rejects a login request
export async function rejectLoginTicket(req, res, next){
  try{
    const { ticketId, pin } = req.body;
    const query = ticketId ? { ticketId } : { pin: normalizeCode(pin) };
    const ticket = await LoginTicket.findOne(query);

    if(!ticket){
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    ticket.status = "rejected";
    await ticket.save();

    res.json({ success: true, message: "Device request rejected" });
  }catch(e){ next(e); }
}
