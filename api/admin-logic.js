import { createHmac, timingSafeEqual } from "node:crypto";
const ADMIN_TABS = {
  AdminUsers: ["adminId", "email", "role", "status", "createdAt", "updatedAt"],
  UserRegistry: ["userId", "name", "email", "accountStatus", "registeredAt", "lastLoginAt", "updatedAt"],
  AdminLogs: ["logId", "adminId", "action", "targetUserId", "previousValue", "newValue", "timestamp"],
  AppSettings: ["key", "value", "updatedAt"]
};
const ADMIN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SETTING_KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
import { isValidEmail, isValidUserId, normalizeEmail } from "@stockly/shared-validation";
function isValidAdminId(id) {
  return typeof id === "string" && ADMIN_ID_RE.test(id.trim());
}
function isValidRole(role) {
  return role === "owner" || role === "admin";
}
function isValidAccountStatus(s) {
  return s === "active" || s === "suspended" || s === "deactivated";
}
function isValidAdminStatus(s) {
  return s === "active" || s === "suspended";
}
function isValidSettingKey(key) {
  return typeof key === "string" && SETTING_KEY_RE.test(key.trim());
}
function validateRegistryInput(input) {
  const userId = String(input.userId ?? "").trim();
  if (!isValidUserId(userId)) throw new Error("Invalid userId.");
  const name = String(input.name ?? "").trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Name is required.");
  if (name.length > 80) throw new Error("Name is too long (max 80 characters).");
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  const iso = (v, field) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    const t = Date.parse(s);
    if (Number.isNaN(t)) throw new Error(`Invalid ${field}.`);
    return new Date(t).toISOString();
  };
  return {
    userId,
    name,
    email,
    registeredAt: iso(input.registeredAt, "registeredAt"),
    lastLoginAt: iso(input.lastLoginAt, "lastLoginAt")
  };
}
function mergeRegistryUser(existing, incoming, nowIso) {
  if (!existing) {
    return {
      created: true,
      record: {
        userId: incoming.userId,
        name: incoming.name,
        email: incoming.email,
        accountStatus: "active",
        registeredAt: incoming.registeredAt || nowIso,
        lastLoginAt: incoming.lastLoginAt || nowIso,
        updatedAt: nowIso
      }
    };
  }
  return {
    created: false,
    record: {
      ...existing,
      name: incoming.name,
      email: incoming.email,
      registeredAt: incoming.registeredAt || existing.registeredAt,
      lastLoginAt: incoming.lastLoginAt || existing.lastLoginAt,
      updatedAt: nowIso
    }
  };
}
function computeUserStats(users) {
  let active = 0;
  let suspended = 0;
  let deactivated = 0;
  for (const u of users) {
    if (u.accountStatus === "suspended") suspended += 1;
    else if (u.accountStatus === "deactivated") deactivated += 1;
    else active += 1;
  }
  return { total: users.length, active, suspended, deactivated };
}
function filterRegistry(users, opts) {
  const q = String(opts.search ?? "").trim().toLowerCase();
  const status = String(opts.status ?? "").trim();
  const filtered = users.filter((u) => {
    if (status && status !== "all" && u.accountStatus !== status) return false;
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.userId.toLowerCase().includes(q);
  });
  const total = filtered.length;
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  return { users: filtered.slice(offset, offset + limit), total };
}
function b64urlEncode(input) {
  return Buffer.from(input, "utf8").toString("base64url");
}
function b64urlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function createSessionToken(session, secret, ttlMs = 12 * 3600 * 1e3) {
  if (!secret) throw new Error("Session secret is not configured.");
  const now = Date.now();
  const payload = {
    adminId: session.adminId,
    email: normalizeEmail(session.email),
    role: session.role,
    iat: now,
    exp: now + ttlMs
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifySessionToken(token, secret) {
  try {
    if (typeof token !== "string" || !secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (!payload || !isValidAdminId(payload.adminId) || !isValidEmail(payload.email) || !isValidRole(payload.role) || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
function secretsEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}
function signStatusEnvelope(userId, accountStatus, mirrorSecret, issuedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  if (!mirrorSecret) throw new Error("Mirror secret is not configured.");
  if (!isValidUserId(userId)) throw new Error("Invalid userId.");
  if (!isValidAccountStatus(accountStatus)) throw new Error("Invalid account status.");
  const msg = `${userId}|${accountStatus}|${issuedAt}`;
  const signature = createHmac("sha256", mirrorSecret).update(msg).digest("hex");
  return { userId, accountStatus, issuedAt, signature };
}
function verifyStatusEnvelope(env, mirrorSecret) {
  try {
    if (!mirrorSecret) return false;
    const msg = `${env.userId}|${env.accountStatus}|${env.issuedAt}`;
    const expect = createHmac("sha256", mirrorSecret).update(msg).digest();
    const got = Buffer.from(String(env.signature || "").trim(), "hex");
    if (got.length !== expect.length) return false;
    return timingSafeEqual(got, expect);
  } catch {
    return false;
  }
}
function sanitizeLogIdPart(part) {
  return String(part || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
}
function logIdFor(idempotencyKey, fallbackId) {
  const clean = sanitizeLogIdPart(String(idempotencyKey ?? ""));
  if (clean.length >= 8) return `log_${clean}`;
  return fallbackId;
}
function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}
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
function createMemoryStore(seed) {
  const admins = /* @__PURE__ */ new Map();
  const registry = /* @__PURE__ */ new Map();
  const logs = /* @__PURE__ */ new Map();
  const settings = /* @__PURE__ */ new Map();
  for (const a of seed?.admins ?? []) admins.set(a.adminId, { ...a });
  for (const u of seed?.registry ?? []) registry.set(u.userId, { ...u });
  for (const l of seed?.logs ?? []) logs.set(l.logId, { ...l });
  for (const [k, v] of Object.entries(seed?.settings ?? {})) {
    settings.set(k, { value: v, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  return {
    async listAdmins() {
      return [...admins.values()];
    },
    async createAdmin(a) {
      if (admins.has(a.adminId)) throw new Error("Admin already exists.");
      admins.set(a.adminId, { ...a });
    },
    async updateAdmin(adminId, patch) {
      const cur = admins.get(adminId);
      if (!cur) return null;
      const next = { ...cur, ...patch, adminId: cur.adminId, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      admins.set(adminId, next);
      return next;
    },
    async listRegistry() {
      return [...registry.values()];
    },
    async getRegistry(userId) {
      return registry.get(userId) ?? null;
    },
    async upsertRegistry(u) {
      const created = !registry.has(u.userId);
      registry.set(u.userId, { ...u });
      return { record: { ...u }, created };
    },
    async findLog(logId) {
      return logs.get(logId) ?? null;
    },
    async appendLog(entry) {
      if (logs.has(entry.logId)) throw new Error("Duplicate log entry.");
      logs.set(entry.logId, { ...entry });
    },
    async listLogs(limit) {
      const all = [...logs.values()].sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
      return all.slice(0, Math.min(Math.max(limit || 100, 1), 500));
    },
    async getSetting(key) {
      return settings.get(key)?.value ?? null;
    },
    async setSetting(key, value) {
      settings.set(key, { value, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    },
    async listSettings() {
      return [...settings.entries()].map(([key, v]) => ({ key, value: v.value, updatedAt: v.updatedAt }));
    },
    async getAuthProviders(userId) {
      return [...seed?.providers?.[userId] ?? []];
    },
    async getSheetInfo(userId) {
      return seed?.sheets?.[userId] ?? null;
    }
  };
}
export {
  ADMIN_TABS,
  buildLogEntry,
  computeUserStats,
  createMemoryStore,
  createSessionToken,
  filterRegistry,
  isValidAccountStatus,
  isValidAdminId,
  isValidAdminStatus,
  isValidEmail,
  isValidRole,
  isValidSettingKey,
  isValidUserId,
  logIdFor,
  mergeRegistryUser,
  newId,
  normalizeEmail,
  sanitizeLogIdPart,
  secretsEqual,
  signStatusEnvelope,
  validateRegistryInput,
  verifySessionToken,
  verifyStatusEnvelope
};
