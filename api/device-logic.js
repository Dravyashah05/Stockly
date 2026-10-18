import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
const DEVICE_TABS = {
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
const QR_LINK_TTL_MS = 5 * 60 * 1e3;
const CODE_LINK_TTL_MS = 10 * 60 * 1e3;
const MAX_LINK_ATTEMPTS = 5;
const DEVICE_SESSION_TTL_MS = 90 * 24 * 3600 * 1e3;
const LINK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function isValidLinkId(id) {
  return typeof id === "string" && LINK_ID_RE.test(id.trim());
}
function isValidDeviceId(id) {
  return typeof id === "string" && DEVICE_ID_RE.test(id.trim());
}
function isValidUserIdRef(id) {
  return typeof id === "string" && USER_ID_RE.test(id.trim());
}
function isValidLinkMethod(m) {
  return m === "qr" || m === "code";
}
function isValidLinkStatus(s) {
  return s === "pending" || s === "claimed" || s === "approved" || s === "rejected" || s === "expired" || s === "cancelled";
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
function newDeviceId() {
  return `dev_${randomBytes(12).toString("hex")}`;
}
function newLinkId() {
  return `lnk_${randomBytes(12).toString("hex")}`;
}
function buildQrPayload(linkId, token) {
  const payload = { v: 1, app: "stockly", linkId, token };
  return JSON.stringify(payload);
}
function parseQrPayload(raw) {
  try {
    if (typeof raw !== "string") return null;
    const text = raw.trim();
    if (!text || text.length > 512) return null;
    const p = JSON.parse(text);
    if (p.v !== 1 || p.app !== "stockly" || !isValidLinkId(p.linkId) || typeof p.token !== "string" || !/^[0-9a-f]{32,128}$/i.test(p.token)) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
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
class RateLimiter {
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
}
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
export {
  CODE_LINK_TTL_MS,
  DEVICE_SESSION_TTL_MS,
  DEVICE_TABS,
  MAX_LINK_ATTEMPTS,
  QR_LINK_TTL_MS,
  RateLimiter,
  buildQrPayload,
  createDeviceSession,
  createLinkRecord,
  createMemoryDeviceStore,
  hashEqual,
  isValidDeviceId,
  isValidLinkId,
  isValidLinkMethod,
  isValidLinkStatus,
  isValidUserIdRef,
  linkPublicState,
  newDeviceId,
  newLinkCode,
  newLinkId,
  newLinkToken,
  normalizeLinkCode,
  parseQrPayload,
  sanitizeDeviceMeta,
  sha256hex,
  tryClaimLink,
  verifyDeviceSessionFormat
};
