import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
const AUTH_TABS = {
  UserAuth: ["userId", "email", "name", "passwordHash", "providers", "createdAt", "updatedAt"]
};
const AUTH_SESSION_TTL_MS = 30 * 24 * 3600 * 1e3;
import {
  isValidEmail,
  isValidUserId,
  normalizeEmail,
  validateDisplayName,
  validatePassword
} from "@stockly/shared-validation";
const isValidAuthEmail = isValidEmail;
const isValidAuthUserId = isValidUserId;
const normalizeAuthEmail = normalizeEmail;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 32;
function hashPassword(password) {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$v1$n${SCRYPT_N}$r${SCRYPT_R}$p${SCRYPT_P}$${salt.toString("base64")}$${key.toString("base64")}`;
}
function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split("$");
    if (parts.length !== 7 || parts[0] !== "scrypt" || parts[1] !== "v1") return false;
    const n = Number(parts[2].slice(1));
    const r = Number(parts[3].slice(1));
    const p = Number(parts[4].slice(1));
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const salt = Buffer.from(parts[5], "base64");
    const expected = Buffer.from(parts[6], "base64");
    if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
    const key = scryptSync(String(password), salt, KEY_LEN, { N: n, r, p });
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
function parseProviders(raw) {
  const out = [];
  for (const part of String(raw ?? "").split(",")) {
    const p = part.trim().toLowerCase();
    if ((p === "password" || p === "google") && !out.includes(p)) {
      out.push(p);
    }
  }
  return out;
}
function serializeProviders(providers) {
  return [...new Set(providers)].filter((p) => p === "password" || p === "google").join(",");
}
function b64urlEncode(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}
function b64urlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function newAuthUserId() {
  return `usr_${randomBytes(12).toString("hex")}`;
}
function createAuthSession(userId, secret, ttlMs = AUTH_SESSION_TTL_MS) {
  if (!secret) throw new Error("Auth session secret is not configured.");
  if (!isValidAuthUserId(userId)) throw new Error("Invalid userId.");
  const now = Date.now();
  const payload = { userId, iat: now, exp: now + ttlMs };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyAuthSession(token, secret) {
  try {
    if (typeof token !== "string" || !secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (!payload || !isValidAuthUserId(payload.userId) || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function parseSheetInput(raw) {
  try {
    const text = String(raw ?? "").trim();
    if (!text) return null;
    const u = new URL(text);
    if (u.protocol !== "https:") return null;
    if (u.hostname === "docs.google.com" && u.pathname.startsWith("/spreadsheets/d/")) {
      const id = u.pathname.split("/")[3] ?? "";
      if (/^[A-Za-z0-9_-]{20,}$/.test(id)) return { kind: "sheets", id };
      return null;
    }
    if (u.hostname === "script.google.com" && !u.port && /^\/macros\/s\/[^/]+\/exec\/?$/.test(u.pathname) && !u.username && !u.password && !u.search && !u.hash) {
      return { kind: "exec", id: u.pathname.split("/")[3] ?? "" };
    }
    return null;
  } catch {
    return null;
  }
}
function fingerprint(value) {
  return createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);
}
function createMemoryAuthStore(seed) {
  const byId = /* @__PURE__ */ new Map();
  for (const u of seed ?? []) byId.set(u.userId, { ...u, providers: [...u.providers] });
  return {
    async findByEmail(email) {
      const want = normalizeAuthEmail(email);
      for (const u of byId.values()) {
        if (normalizeAuthEmail(u.email) === want) return { ...u, providers: [...u.providers] };
      }
      return null;
    },
    async findById(userId) {
      const u = byId.get(userId);
      return u ? { ...u, providers: [...u.providers] } : null;
    },
    async create(user) {
      if (byId.has(user.userId)) throw new Error("User already exists.");
      byId.set(user.userId, { ...user, providers: [...user.providers] });
    },
    async update(user) {
      if (!byId.has(user.userId)) throw new Error("User not found.");
      byId.set(user.userId, { ...user, providers: [...user.providers] });
    },
    async count() {
      return byId.size;
    }
  };
}
export {
  AUTH_SESSION_TTL_MS,
  AUTH_TABS,
  createAuthSession,
  createMemoryAuthStore,
  fingerprint,
  hashPassword,
  isValidAuthEmail,
  isValidAuthUserId,
  newAuthUserId,
  normalizeAuthEmail,
  parseProviders,
  parseSheetInput,
  serializeProviders,
  validateDisplayName,
  validatePassword,
  verifyAuthSession,
  verifyPassword
};
