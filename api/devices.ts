// @ts-nocheck


// api/apps-script-client.js
function scriptUrl() {
  return (process.env.ADMIN_SCRIPT_URL || "").trim();
}
function scriptToken() {
  return process.env.ADMIN_SCRIPT_TOKEN || "";
}
function adminScriptConfigured() {
  return Boolean(scriptUrl() && scriptToken());
}
function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}
async function scriptCall(action, payload = {}) {
  const url = scriptUrl();
  const token = scriptToken();
  if (!url || !token) {
    throw httpError("Private admin storage is not configured on the server.", 501);
  }
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token, action, ...payload }),
      redirect: "follow"
    });
  } catch {
    throw httpError("Admin spreadsheet request failed.", 502);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw httpError("Admin spreadsheet returned a non-JSON response.", 502);
  }
  if (!json || json.success !== true) {
    const msg = typeof json?.error === "string" && json.error ? json.error : "Admin spreadsheet request failed.";
    if (/^Unauthorized\.?$/.test(msg)) throw httpError("Unauthorized.", 401);
    if (/Row not found/.test(msg)) throw httpError(msg, 404);
    throw httpError(msg, 502);
  }
  return json.data;
}
async function scriptReadTab(tab) {
  const data = await scriptCall("readTab", { tab });
  const headers = Array.isArray(data.headers) ? data.headers.map((h) => String(h)) : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return rows.map((r) => {
    const o = {};
    headers.forEach((h, i) => {
      o[h] = r[i] === void 0 || r[i] === null ? "" : String(r[i]);
    });
    return o;
  }).filter((r) => Object.values(r).some((v) => v !== ""));
}
async function scriptAppendRow(tab, row) {
  await scriptCall("appendRow", { tab, row });
}
async function scriptUpdateRowById(tab, id, row) {
  await scriptCall("updateRow", { tab, id, row });
}

// api/schema.js
var ensuredAt = 0;
var ENSURE_TTL_MS = 10 * 60 * 1e3;
async function ensureSchemaCached() {
  if (!adminScriptConfigured()) return null;
  if (Date.now() - ensuredAt < ENSURE_TTL_MS) return null;
  const result = await scriptCall("setupSchema");
  ensuredAt = Date.now();
  const created = Array.isArray(result.created) ? result.created.map((t) => String(t)) : [];
  return { created, existing: [] };
}

// api/devices.ts
import { createHmac as createHmac3, timingSafeEqual as timingSafeEqual3 } from "node:crypto";

// packages/shared-validation/dist/index.js
var USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
function isValidUserId(id) {
  return typeof id === "string" && USER_ID_RE.test(id.trim());
}

// api/admin-logic.js
var ADMIN_TABS = {
  AdminUsers: ["adminId", "email", "role", "status", "createdAt", "updatedAt"],
  UserRegistry: ["userId", "name", "email", "accountStatus", "registeredAt", "lastLoginAt", "updatedAt"],
  AdminLogs: ["logId", "adminId", "action", "targetUserId", "previousValue", "newValue", "timestamp"],
  AppSettings: ["key", "value", "updatedAt"]
};
function buildLogEntry(args) {
  return {
    logId: args.logId,
    adminId: String(args.adminId).slice(0, 128),
    action: String(args.action).slice(0, 64),
    targetUserId: String(args.targetUserId ?? "").slice(0, 64),
    previousValue: String(args.previousValue ?? "").slice(0, 500),
    newValue: String(args.newValue ?? "").slice(0, 500),
    timestamp: args.timestamp ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}

// api/device-logic.js
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
var DEVICE_TABS = {
  DeviceLinks: [
    "linkId",
    "userId",
    "tokenHash",
    "method",
    "status",
    "expiresAt",
    "attempts",
    "claimant",
    "createdAt",
    "updatedAt"
  ],
  Devices: [
    "deviceId",
    "userId",
    "name",
    "platform",
    "appInfo",
    "status",
    "linkedAt",
    "lastActiveAt"
  ]
};
var QR_LINK_TTL_MS = 5 * 60 * 1e3;
var CODE_LINK_TTL_MS = 10 * 60 * 1e3;
var MAX_LINK_ATTEMPTS = 5;
var DEVICE_SESSION_TTL_MS = 90 * 24 * 3600 * 1e3;
var LINK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
var DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
var USER_ID_RE2 = /^[A-Za-z0-9_-]{8,64}$/;
var CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function isValidLinkId(id) {
  return typeof id === "string" && LINK_ID_RE.test(id.trim());
}
function isValidDeviceId(id) {
  return typeof id === "string" && DEVICE_ID_RE.test(id.trim());
}
function isValidUserIdRef(id) {
  return typeof id === "string" && USER_ID_RE2.test(id.trim());
}
function isValidLinkMethod(m) {
  return m === "qr" || m === "code";
}
function newLinkToken() {
  return randomBytes(32).toString("hex");
}
function newLinkCode() {
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
function normalizeLinkCode(code) {
  return String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function sha256hex(input) {
  return createHash("sha256").update(input, "utf8").digest("hex");
}
function hashEqual(aHex, bHex) {
  try {
    const a = Buffer.from(String(aHex).trim(), "hex");
    const b = Buffer.from(String(bHex).trim(), "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function newLinkId() {
  return `lnk_${randomBytes(12).toString("hex")}`;
}
function b64urlEncode(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}
function b64urlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function createDeviceSession(userId, deviceId, secret, ttlMs = DEVICE_SESSION_TTL_MS) {
  if (!secret) throw new Error("Device session secret is not configured.");
  if (!isValidUserIdRef(userId) || !isValidDeviceId(deviceId)) throw new Error("Invalid session subject.");
  const now = Date.now();
  const payload = { userId, deviceId, iat: now, exp: now + ttlMs };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyDeviceSessionFormat(token, secret) {
  try {
    if (typeof token !== "string" || !secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (!payload || !isValidUserIdRef(payload.userId) || !isValidDeviceId(payload.deviceId) || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function linkPublicState(link, now = Date.now()) {
  if ((link.status === "pending" || link.status === "claimed") && Date.parse(link.expiresAt) <= now) {
    return "expired";
  }
  return link.status;
}
function createLinkRecord(args) {
  if (!isValidUserIdRef(args.userId)) throw new Error("Invalid userId.");
  if (!isValidLinkMethod(args.method)) throw new Error("Invalid method.");
  const now = args.nowIso ?? (/* @__PURE__ */ new Date()).toISOString();
  return {
    linkId: newLinkId(),
    userId: args.userId,
    tokenHash: args.tokenHash,
    method: args.method,
    status: "pending",
    expiresAt: new Date(Date.parse(now) + args.ttlMs).toISOString(),
    attempts: 0,
    claimant: "",
    createdAt: now,
    updatedAt: now
  };
}
function tryClaimLink(link, token, now = Date.now()) {
  if (!link) return { ok: false, reason: "not-found", link: null };
  if (link.status !== "pending") return { ok: false, reason: "already-used", link };
  if (Date.parse(link.expiresAt) <= now) return { ok: false, reason: "expired", link };
  if (link.attempts >= MAX_LINK_ATTEMPTS) return { ok: false, reason: "locked", link };
  if (!hashEqual(sha256hex(token), link.tokenHash)) {
    return { ok: false, reason: "invalid-token", link };
  }
  return {
    ok: true,
    link: { ...link, status: "claimed", updatedAt: new Date(now).toISOString() }
  };
}
function sanitizeDeviceMeta(input) {
  const clean = (v, fallback, max) => {
    const s = String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
    return s || fallback;
  };
  return {
    name: clean(input.name, "Linked device", 60),
    platform: clean(input.platform, "unknown", 40),
    appInfo: clean(input.appInfo, "", 120)
  };
}
var RateLimiter = class {
  hits = /* @__PURE__ */ new Map();
  maxHits;
  windowMs;
  constructor(maxHits, windowMs) {
    this.maxHits = maxHits;
    this.windowMs = windowMs;
  }
  take(key, now = Date.now()) {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this.maxHits) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5e3) {
      const oldest = [...this.hits.keys()][0];
      this.hits.delete(oldest);
    }
    return true;
  }
};
function createMemoryDeviceStore(seed) {
  const links = /* @__PURE__ */ new Map();
  const devices = /* @__PURE__ */ new Map();
  for (const l of seed?.links ?? []) links.set(l.linkId, { ...l });
  for (const d of seed?.devices ?? []) devices.set(d.deviceId, { ...d });
  return {
    async createLink(link) {
      if (links.has(link.linkId)) throw new Error("Link already exists.");
      links.set(link.linkId, { ...link });
    },
    async getLink(linkId) {
      return links.get(linkId) ?? null;
    },
    async findLinkByCodeHash(codeHash) {
      for (const l of links.values()) {
        if (l.tokenHash === codeHash) return { ...l };
      }
      return null;
    },
    async updateLink(link) {
      if (!links.has(link.linkId)) throw new Error("Link not found.");
      links.set(link.linkId, { ...link });
    },
    async listLinksForUser(userId) {
      return [...links.values()].filter((l) => l.userId === userId).map((l) => ({ ...l }));
    },
    async upsertDevice(d) {
      devices.set(d.deviceId, { ...d });
    },
    async getDevice(deviceId) {
      return devices.get(deviceId) ?? null;
    },
    async listDevicesForUser(userId) {
      return [...devices.values()].filter((d) => d.userId === userId).map((d) => ({ ...d }));
    }
  };
}

// api/auth-logic.js
import { createHash as createHash2, createHmac as createHmac2, randomBytes as randomBytes2, scryptSync, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var AUTH_SESSION_TTL_MS = 30 * 24 * 3600 * 1e3;
var isValidAuthUserId = isValidUserId;
function b64urlDecode2(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function verifyAuthSession(token, secret) {
  try {
    if (typeof token !== "string" || !secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac2("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expect.length || !timingSafeEqual2(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode2(body));
    if (!payload || !isValidAuthUserId(payload.userId) || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// api/devices.ts
function readBody(req) {
  const b = req.body;
  if (typeof b === "string") {
    try {
      const parsed = JSON.parse(b || "{}");
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  if (typeof b === "object" && b !== null) return b;
  return {};
}
function header(req, name) {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim();
}
function bearerToken(req) {
  const value = header(req, "authorization");
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : null;
}
function clientIp(req) {
  const fwd = header(req, "x-forwarded-for");
  return (fwd.split(",")[0] ?? "").trim() || "unknown";
}
function httpError2(message, status) {
  return Object.assign(new Error(message), { status });
}
function toLink(r) {
  return {
    linkId: r.linkId,
    userId: r.userId,
    tokenHash: r.tokenHash,
    method: r.method === "code" ? "code" : "qr",
    status: ["pending", "claimed", "approved", "rejected", "expired", "cancelled"].includes(r.status) ? r.status : "pending",
    expiresAt: r.expiresAt,
    attempts: Number(r.attempts) || 0,
    claimant: r.claimant ?? "",
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}
function toDevice(r) {
  return {
    deviceId: r.deviceId,
    userId: r.userId,
    name: r.name,
    platform: r.platform,
    appInfo: r.appInfo ?? "",
    status: r.status === "revoked" ? "revoked" : "active",
    linkedAt: r.linkedAt,
    lastActiveAt: r.lastActiveAt
  };
}
var linkRow = (l) => DEVICE_TABS.DeviceLinks.map((h) => l[h] ?? "");
var deviceRow = (d) => DEVICE_TABS.Devices.map((h) => d[h] ?? "");
function createScriptDeviceStore() {
  return {
    async createLink(link) {
      await scriptAppendRow("DeviceLinks", linkRow(link));
    },
    async getLink(linkId) {
      const rows = await scriptReadTab("DeviceLinks");
      const hit = rows.map(toLink).find((l) => l.linkId === linkId);
      return hit ?? null;
    },
    async findLinkByCodeHash(codeHash) {
      const rows = await scriptReadTab("DeviceLinks");
      const hit = rows.map(toLink).find((l) => hashEqual(l.tokenHash, codeHash));
      return hit ?? null;
    },
    async updateLink(link) {
      await scriptUpdateRowById("DeviceLinks", link.linkId, linkRow(link));
    },
    async listLinksForUser(userId) {
      const rows = await scriptReadTab("DeviceLinks");
      return rows.map(toLink).filter((l) => l.userId === userId);
    },
    async upsertDevice(d) {
      const rows = await scriptReadTab("Devices");
      if (rows.some((r) => r.deviceId === d.deviceId)) {
        await scriptUpdateRowById("Devices", d.deviceId, deviceRow(d));
        return;
      }
      await scriptAppendRow("Devices", deviceRow(d));
    },
    async getDevice(deviceId) {
      const rows = await scriptReadTab("Devices");
      const hit = rows.map(toDevice).find((d) => d.deviceId === deviceId);
      return hit ?? null;
    },
    async listDevicesForUser(userId) {
      const rows = await scriptReadTab("Devices");
      return rows.map(toDevice).filter((d) => d.userId === userId);
    }
  };
}
async function readRegistryUser(userId) {
  const rows = await scriptReadTab("UserRegistry");
  const hit = rows.find((r) => r.userId === userId);
  if (!hit) return null;
  return { userId, name: hit.name ?? "", email: hit.email ?? "", accountStatus: hit.accountStatus ?? "active" };
}
async function auditLog(entry) {
  try {
    const row = ADMIN_TABS.AdminLogs.map(
      (h) => buildLogEntry({
        logId: entry.logId ?? newLinkId().replace("lnk_", "log_"),
        adminId: entry.adminId,
        action: entry.action,
        targetUserId: entry.targetUserId,
        previousValue: entry.previousValue,
        newValue: entry.newValue
      })[h] ?? ""
    );
    await scriptAppendRow("AdminLogs", row);
  } catch {
  }
}
function getStore() {
  if (!adminScriptConfigured()) {
    throw httpError2("Device storage is not configured on the server.", 501);
  }
  return { store: createScriptDeviceStore() };
}
function getDeviceTestStore() {
  return createMemoryDeviceStore();
}
function deviceSecret() {
  return process.env.DEVICE_SESSION_SECRET || "";
}
function requireDeviceSession(req) {
  const session = verifyDeviceSessionFormat(bearerToken(req), deviceSecret());
  if (!session) throw httpError2("Device authentication required.", 401);
  return session;
}
function requireAdminSession(req) {
  const token = bearerToken(req);
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  if (!token || !secret) throw httpError2("Admin authentication required.", 401);
  const parts = token.split(".");
  if (parts.length !== 2) throw httpError2("Admin authentication required.", 401);
  const expect = createHmac3("sha256", secret).update(parts[0]).digest();
  let got;
  try {
    got = Buffer.from(parts[1], "base64url");
  } catch {
    throw httpError2("Admin authentication required.", 401);
  }
  if (got.length !== expect.length || !timingSafeEqual3(got, expect)) {
    throw httpError2("Admin authentication required.", 401);
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (typeof payload.adminId !== "string" || payload.role !== "owner" && payload.role !== "admin" || typeof payload.exp !== "number" || Date.now() > payload.exp) {
      throw httpError2("Admin authentication required.", 401);
    }
    return { adminId: payload.adminId, email: String(payload.email ?? ""), role: payload.role };
  } catch (e) {
    if (e && typeof e === "object" && "status" in e) throw e;
    throw httpError2("Admin authentication required.", 401);
  }
}
var claimLimiter = new RateLimiter(20, 6e4);
var pollLimiter = new RateLimiter(60, 6e4);
var createLimiter = new RateLimiter(30, 6e4);
function setupHelp() {
  return {
    steps: [
      "Tabs are created automatically in the PRIVATE admin spreadsheet on first contact (see README.md).",
      "Set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN and DEVICE_SESSION_SECRET in Vercel environment variables and redeploy.",
      "For inventory-path revocation checks, run setDeviceSecrets(...) once in the user-sheet Apps Script (see README.md)."
    ]
  };
}
async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Session");
  if (req.method === 'OPTIONS') {
    res.status(200).json({ success: true });
    return;
  }
  if (req.method !== "POST" && req.method !== "GET") {
    res.status(405).json({ success: false, error: "Method not allowed." });
    return;
  }
  const body = req.method === "POST" ? readBody(req) : {};
  const queryAction = req.query && typeof req.query.action === "string" ? req.query.action : void 0;
  const action = String(body.action ?? queryAction ?? "").trim();
  try {
    try {
      await ensureSchemaCached();
    } catch {
    }
    if (!action || action === "status") {
      const configured = Boolean(adminScriptConfigured() && deviceSecret());
      res.status(200).json({ success: true, data: { configured } });
      return;
    }
    if (action === "claimLink") {
      if (!claimLimiter.take(`claim:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: "Too many attempts. Wait a minute and try again." });
        return;
      }
      const { store: store2 } = getStore();
      const rawCode = typeof body.code === "string" && body.code.trim() ? body.code : null;
      let link = null;
      let token = "";
      if (rawCode) {
        const code = normalizeLinkCode(rawCode);
        if (code.length < 6) {
          res.status(400).json({ success: false, error: "Enter the complete linking code." });
          return;
        }
        link = await store2.findLinkByCodeHash(sha256hex(code));
        token = code;
      } else {
        const linkId = String(body.linkId ?? "").trim();
        token = String(body.token ?? "").trim();
        if (!isValidLinkId(linkId) || !token) {
          res.status(400).json({ success: false, error: "Invalid linking request." });
          return;
        }
        link = await store2.getLink(linkId);
      }
      const outcome = tryClaimLink(link, token);
      if (outcome.ok === false) {
        if (outcome.link && (outcome.reason === "invalid-token" || outcome.reason === "locked")) {
          try {
            const attempts = outcome.link.attempts + (outcome.reason === "invalid-token" ? 1 : 0);
            await store2.updateLink({ ...outcome.link, attempts, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
          } catch {
          }
        } else if (outcome.link && outcome.reason === "expired" && outcome.link.status === "pending") {
          try {
            await store2.updateLink({ ...outcome.link, status: "expired", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
          } catch {
          }
        }
        const messages = {
          "not-found": "Link not found. Ask the primary device for a fresh code.",
          expired: "This code has expired. Ask the primary device for a fresh one.",
          locked: "Too many wrong attempts. Ask the primary device for a fresh code.",
          "already-used": "This code was already used. Ask the primary device for a fresh one.",
          "invalid-token": "Incorrect code. Check and try again."
        };
        const status = outcome.reason === "not-found" ? 404 : outcome.reason === "invalid-token" ? 401 : 410;
        res.status(status).json({ success: false, error: messages[outcome.reason], reason: outcome.reason });
        return;
      }
      const meta = sanitizeDeviceMeta({ name: body.deviceName, platform: body.platform, appInfo: body.appInfo });
      const claimantDeviceId = String(body.deviceId ?? "").trim();
      if (!isValidDeviceId(claimantDeviceId)) {
        res.status(400).json({ success: false, error: "Invalid device." });
        return;
      }
      const claimed = {
        ...outcome.link,
        claimant: JSON.stringify({ deviceId: claimantDeviceId, ...meta }),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await store2.updateLink(claimed);
      res.status(200).json({
        success: true,
        data: { linkId: claimed.linkId, status: "claimed", expiresAt: claimed.expiresAt }
      });
      return;
    }
    if (action === "pollLink") {
      if (!pollLimiter.take(`poll:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: "Too many attempts. Wait a moment and try again." });
        return;
      }
      const { store: store2 } = getStore();
      const linkId = String(body.linkId ?? "").trim();
      const token = String(body.token ?? body.code ?? "").trim();
      if (!isValidLinkId(linkId) || !token) {
        res.status(400).json({ success: false, error: "Invalid linking request." });
        return;
      }
      const link = await store2.getLink(linkId);
      const presented = token.trim();
      const matches = !!link && (hashEqual(sha256hex(presented), link.tokenHash) || hashEqual(sha256hex(normalizeLinkCode(presented)), link.tokenHash));
      if (!link || !matches) {
        res.status(404).json({ success: false, error: "Link not found.", reason: "not-found" });
        return;
      }
      const state = linkPublicState(link);
      if (state === "approved") {
        let claimantDeviceId = "";
        try {
          claimantDeviceId = String(JSON.parse(link.claimant).deviceId ?? "");
        } catch {
          claimantDeviceId = "";
        }
        if (!isValidDeviceId(claimantDeviceId)) {
          res.status(410).json({ success: false, error: "Link is no longer valid.", reason: "already-used" });
          return;
        }
        const profile = await readRegistryUser(link.userId);
        const session2 = createDeviceSession(link.userId, claimantDeviceId, deviceSecret(), DEVICE_SESSION_TTL_MS);
        res.status(200).json({
          success: true,
          data: {
            status: "approved",
            deviceSession: session2,
            userId: link.userId,
            deviceId: claimantDeviceId,
            profile: profile ? { name: profile.name, email: profile.email } : null
          }
        });
        return;
      }
      if (state === "pending" || state === "claimed") {
        res.status(200).json({ success: true, data: { status: state, expiresAt: link.expiresAt } });
        return;
      }
      res.status(200).json({ success: true, data: { status: state } });
      return;
    }
    if (action === "validateDevice") {
      const userId = String(body.userId ?? "").trim();
      const deviceId = String(body.deviceId ?? "").trim();
      const sessionToken = String(body.sessionToken ?? "").trim();
      const parsed = verifyDeviceSessionFormat(sessionToken, deviceSecret());
      if (!parsed || parsed.userId !== userId || parsed.deviceId !== deviceId) {
        res.status(200).json({ success: true, data: { valid: false, reason: "invalid-session" } });
        return;
      }
      const { store: store2 } = getStore();
      const device = await store2.getDevice(deviceId);
      if (!device || device.userId !== userId || device.status !== "active") {
        res.status(200).json({ success: true, data: { valid: false, reason: "revoked" } });
        return;
      }
      const reg2 = await readRegistryUser(userId);
      if (!reg2 || reg2.accountStatus !== "active") {
        res.status(200).json({ success: true, data: { valid: false, reason: "suspended" } });
        return;
      }
      res.status(200).json({ success: true, data: { valid: true } });
      return;
    }
    if (action === "enrollPrimary") {
      const authSession = verifyAuthSession(bearerToken(req), process.env.AUTH_SESSION_SECRET || "");
      if (!authSession) {
        res.status(401).json({ success: false, error: "Sign-in required to enroll this device." });
        return;
      }
      const deviceId = String(body.deviceId ?? "").trim();
      if (!isValidUserIdRef(body.userId) || String(body.userId) !== authSession.userId || !isValidDeviceId(deviceId)) {
        res.status(400).json({ success: false, error: "Invalid enrollment request." });
        return;
      }
      const userId = authSession.userId;
      const { store: store2 } = getStore();
      const reg2 = await readRegistryUser(userId);
      if (!reg2) {
        res.status(404).json({ success: false, error: "Account not found. Register first, then try again." });
        return;
      }
      if (reg2.accountStatus !== "active") {
        res.status(403).json({ success: false, error: "This account is not active. Contact the owner." });
        return;
      }
      const existing = (await store2.listDevicesForUser(userId)).filter((d) => d.status === "active");
      if (existing.length > 0 && !existing.some((d) => d.deviceId === deviceId)) {
        res.status(409).json({
          success: false,
          error: "This account already has linked devices. Use Link Existing Account on the new device.",
          reason: "link-required"
        });
        return;
      }
      const meta = sanitizeDeviceMeta({ name: body.deviceName, platform: body.platform, appInfo: body.appInfo });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const prior = await store2.getDevice(deviceId);
      await store2.upsertDevice({
        deviceId,
        userId,
        name: meta.name,
        platform: meta.platform,
        appInfo: meta.appInfo,
        status: "active",
        linkedAt: prior?.linkedAt ?? now,
        lastActiveAt: now
      });
      await auditLog({
        adminId: `device:${deviceId}`,
        action: "device.enrollPrimary",
        targetUserId: userId,
        newValue: meta.name
      });
      const session2 = createDeviceSession(userId, deviceId, deviceSecret(), DEVICE_SESSION_TTL_MS);
      res.status(200).json({ success: true, data: { deviceSession: session2, deviceId, userId } });
      return;
    }
    const adminAct = action === "adminListDevices" || action === "adminRevokeDevice" || action === "adminDeviceStats";
    let session = null;
    let admin = null;
    if (adminAct) {
      try {
        session = requireDeviceSession(req);
      } catch {
        session = null;
      }
      if (!session) admin = requireAdminSession(req);
    } else {
      session = requireDeviceSession(req);
    }
    if (adminAct && admin) {
      const { store: store2 } = getStore();
      if (action === "adminDeviceStats") {
        const rows = await scriptReadTab("Devices");
        const perUser = /* @__PURE__ */ new Map();
        let totalActive = 0;
        for (const r of rows) {
          if (r.status !== "active") continue;
          totalActive += 1;
          perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + 1);
        }
        res.status(200).json({
          success: true,
          data: { totalActive, usersWithDevices: perUser.size, perUser: [...perUser.entries()].map(([userId, count]) => ({ userId, count })) }
        });
        return;
      }
      if (action === "adminListDevices") {
        const userId = String(body.userId ?? "").trim();
        if (!isValidUserIdRef(userId)) {
          res.status(400).json({ success: false, error: "Invalid userId." });
          return;
        }
        const devices = await store2.listDevicesForUser(userId);
        res.status(200).json({ success: true, data: { devices } });
        return;
      }
      const deviceId = String(body.deviceId ?? "").trim();
      if (!isValidDeviceId(deviceId)) {
        res.status(400).json({ success: false, error: "Invalid deviceId." });
        return;
      }
      const device = await store2.getDevice(deviceId);
      if (!device) {
        res.status(404).json({ success: false, error: "Device not found." });
        return;
      }
      if (device.status === "revoked") {
        res.status(200).json({ success: true, data: { device, replayed: true } });
        return;
      }
      const next = { ...device, status: "revoked" };
      await store2.upsertDevice(next);
      await auditLog({
        adminId: admin.adminId,
        action: "device.revoke",
        targetUserId: device.userId,
        previousValue: "active",
        newValue: `revoked:${deviceId}`
      });
      console.info("[stockly-devices] admin revoked device");
      res.status(200).json({ success: true, data: { device: next, replayed: false } });
      return;
    }
    if (!session) throw httpError2("Device authentication required.", 401);
    const { store } = getStore();
    const caller = await store.getDevice(session.deviceId);
    if (!caller || caller.userId !== session.userId || caller.status !== "active") {
      res.status(401).json({ success: false, error: "This device is no longer linked. Link it again to continue." });
      return;
    }
    const reg = await readRegistryUser(session.userId);
    if (!reg || reg.accountStatus !== "active") {
      res.status(403).json({ success: false, error: "This account is not active. Contact the owner." });
      return;
    }
    switch (action) {
      case "createLink": {
        if (!createLimiter.take(`create:${session.deviceId}`)) {
          res.status(429).json({ success: false, error: "Too many codes. Wait a minute and try again." });
          return;
        }
        const method = body.method === "code" ? "code" : "qr";
        if (body.method !== void 0 && !isValidLinkMethod(body.method)) {
          res.status(400).json({ success: false, error: "Invalid method." });
          return;
        }
        const mine = await store.listLinksForUser(session.userId);
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        for (const l of mine) {
          if (l.status === "pending" || l.status === "claimed") {
            try {
              await store.updateLink({ ...l, status: "cancelled", updatedAt: nowIso });
            } catch {
            }
          }
        }
        const secret = method === "code" ? newLinkCode() : newLinkToken();
        const record = createLinkRecord({
          userId: session.userId,
          method,
          tokenHash: sha256hex(method === "code" ? normalizeLinkCode(secret) : secret),
          ttlMs: method === "code" ? CODE_LINK_TTL_MS : QR_LINK_TTL_MS,
          nowIso
        });
        await store.createLink(record);
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: "device.linkCreate",
          targetUserId: session.userId,
          newValue: `${method}:${record.linkId}`
        });
        res.status(200).json({
          success: true,
          data: {
            linkId: record.linkId,
            method,
            token: secret,
            code: method === "code" ? secret : void 0,
            expiresAt: record.expiresAt
          }
        });
        return;
      }
      case "getLink": {
        const linkId = String(body.linkId ?? "").trim();
        if (!isValidLinkId(linkId)) {
          res.status(400).json({ success: false, error: "Invalid linkId." });
          return;
        }
        const link = await store.getLink(linkId);
        if (!link || link.userId !== session.userId) {
          res.status(404).json({ success: false, error: "Link not found." });
          return;
        }
        const state = linkPublicState(link);
        if (state === "expired" && link.status !== "expired") {
          try {
            await store.updateLink({ ...link, status: "expired", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
          } catch {
          }
        }
        let claimantName = "";
        try {
          claimantName = String(JSON.parse(link.claimant).name ?? "");
        } catch {
          claimantName = "";
        }
        res.status(200).json({
          success: true,
          data: { linkId, method: link.method, status: state, expiresAt: link.expiresAt, attempts: link.attempts, claimantName }
        });
        return;
      }
      case "cancelLink":
      case "refreshLink": {
        const linkId = String(body.linkId ?? "").trim();
        if (!isValidLinkId(linkId)) {
          res.status(400).json({ success: false, error: "Invalid linkId." });
          return;
        }
        const link = await store.getLink(linkId);
        if (!link || link.userId !== session.userId) {
          res.status(404).json({ success: false, error: "Link not found." });
          return;
        }
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        if (link.status === "pending" || link.status === "claimed") {
          await store.updateLink({ ...link, status: "cancelled", updatedAt: nowIso });
        }
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: action === "cancelLink" ? "device.linkCancel" : "device.linkRefresh",
          targetUserId: session.userId,
          newValue: linkId
        });
        if (action === "cancelLink") {
          res.status(200).json({ success: true, data: { linkId, status: "cancelled" } });
          return;
        }
        const method = link.method;
        const secret = method === "code" ? newLinkCode() : newLinkToken();
        const record = createLinkRecord({
          userId: session.userId,
          method,
          tokenHash: sha256hex(method === "code" ? normalizeLinkCode(secret) : secret),
          ttlMs: method === "code" ? CODE_LINK_TTL_MS : QR_LINK_TTL_MS,
          nowIso
        });
        await store.createLink(record);
        res.status(200).json({
          success: true,
          data: {
            linkId: record.linkId,
            method,
            token: secret,
            code: method === "code" ? secret : void 0,
            expiresAt: record.expiresAt
          }
        });
        return;
      }
      case "approveLink":
      case "rejectLink": {
        const linkId = String(body.linkId ?? "").trim();
        if (!isValidLinkId(linkId)) {
          res.status(400).json({ success: false, error: "Invalid linkId." });
          return;
        }
        const link = await store.getLink(linkId);
        if (!link || link.userId !== session.userId) {
          res.status(404).json({ success: false, error: "Link not found." });
          return;
        }
        const state = linkPublicState(link);
        if (state !== "claimed") {
          res.status(409).json({ success: false, error: `This request is ${state}. Nothing to approve.` });
          return;
        }
        let claimantDeviceId = "";
        let claimantMeta = { name: "Linked device", platform: "unknown", appInfo: "" };
        try {
          const c = JSON.parse(link.claimant);
          claimantDeviceId = String(c.deviceId ?? "");
          claimantMeta = sanitizeDeviceMeta(c);
        } catch {
          res.status(410).json({ success: false, error: "Claim data is invalid. Ask for a fresh code." });
          return;
        }
        if (!isValidDeviceId(claimantDeviceId) || claimantDeviceId === session.deviceId) {
          res.status(400).json({ success: false, error: "Invalid claimant device." });
          return;
        }
        const nowIso = (/* @__PURE__ */ new Date()).toISOString();
        if (action === "rejectLink") {
          await store.updateLink({ ...link, status: "rejected", updatedAt: nowIso });
          await auditLog({
            adminId: `device:${session.deviceId}`,
            action: "device.linkReject",
            targetUserId: session.userId,
            newValue: linkId
          });
          res.status(200).json({ success: true, data: { linkId, status: "rejected" } });
          return;
        }
        const dup = await store.getLink(linkId);
        if (!dup || dup.status !== "claimed") {
          res.status(409).json({ success: false, error: "This request was already handled." });
          return;
        }
        await store.upsertDevice({
          deviceId: claimantDeviceId,
          userId: session.userId,
          name: claimantMeta.name,
          platform: claimantMeta.platform,
          appInfo: claimantMeta.appInfo,
          status: "active",
          linkedAt: nowIso,
          lastActiveAt: nowIso
        });
        await store.updateLink({ ...link, status: "approved", updatedAt: nowIso });
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: "device.linkApprove",
          targetUserId: session.userId,
          newValue: `${linkId}->${claimantDeviceId}`
        });
        console.info("[stockly-devices] link approved");
        res.status(200).json({ success: true, data: { linkId, status: "approved", deviceId: claimantDeviceId } });
        return;
      }
      case "listDevices": {
        const devices = await store.listDevicesForUser(session.userId);
        devices.sort((a, b) => a.linkedAt < b.linkedAt ? 1 : -1);
        res.status(200).json({
          success: true,
          data: { devices, currentDeviceId: session.deviceId }
        });
        return;
      }
      case "revokeDevice": {
        const deviceId = String(body.deviceId ?? "").trim();
        if (!isValidDeviceId(deviceId)) {
          res.status(400).json({ success: false, error: "Invalid deviceId." });
          return;
        }
        if (deviceId === session.deviceId) {
          res.status(400).json({ success: false, error: "Use sign-out to remove this device." });
          return;
        }
        const device = await store.getDevice(deviceId);
        if (!device || device.userId !== session.userId) {
          res.status(404).json({ success: false, error: "Device not found." });
          return;
        }
        if (device.status === "revoked") {
          res.status(200).json({ success: true, data: { device, replayed: true } });
          return;
        }
        const next = { ...device, status: "revoked" };
        await store.upsertDevice(next);
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: "device.revoke",
          targetUserId: session.userId,
          previousValue: "active",
          newValue: `revoked:${deviceId}`
        });
        console.info("[stockly-devices] device revoked");
        res.status(200).json({ success: true, data: { device: next, replayed: false } });
        return;
      }
      case "revokeOthers": {
        const devices = await store.listDevicesForUser(session.userId);
        let revoked = 0;
        for (const d of devices) {
          if (d.deviceId !== session.deviceId && d.status === "active") {
            await store.upsertDevice({ ...d, status: "revoked" });
            revoked += 1;
          }
        }
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: "device.revokeOthers",
          targetUserId: session.userId,
          newValue: `revoked=${revoked}`
        });
        res.status(200).json({ success: true, data: { revoked } });
        return;
      }
      case "touchDevice": {
        const device = await store.getDevice(session.deviceId);
        if (device) {
          await store.upsertDevice({ ...device, lastActiveAt: (/* @__PURE__ */ new Date()).toISOString() });
        }
        res.status(200).json({ success: true, data: { ok: true } });
        return;
      }
      case "unlinkSelf": {
        const device = await store.getDevice(session.deviceId);
        if (device && device.status === "active") {
          await store.upsertDevice({ ...device, status: "revoked" });
        }
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: "device.unlinkSelf",
          targetUserId: session.userId,
          newValue: session.deviceId
        });
        res.status(200).json({ success: true, data: { ok: true } });
        return;
      }
      default: {
        res.status(400).json({ success: false, error: `Unknown action: ${action}` });
        return;
      }
    }
  } catch (e) {
    const status = typeof e.status === "number" ? e.status : 500;
    if (status === 501) {
      res.status(501).json({ success: false, error: "Device storage is not configured on the server.", ...setupHelp() });
      return;
    }
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 410 || status === 429) {
      res.status(status).json({
        success: false,
        error: e instanceof Error ? e.message : "Request failed."
      });
      return;
    }
    console.error("[stockly-devices] request failed");
    res.status(500).json({ success: false, error: "Device request failed. Check server logs and try again." });
  }
}
export {
  handler as default,
  getDeviceTestStore
};
