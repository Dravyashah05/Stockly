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

// api/admin-logic.js
import { createHmac, timingSafeEqual } from "node:crypto";

// packages/shared-validation/dist/index.js
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
var USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}
function isValidEmail(email) {
  const e = normalizeEmail(email);
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e);
}
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
var ADMIN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
var SETTING_KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;
function isValidAdminId(id) {
  return typeof id === "string" && ADMIN_ID_RE.test(id.trim());
}
function isValidRole(role) {
  return role === "owner" || role === "admin";
}
function isValidAccountStatus(s) {
  return s === "active" || s === "suspended" || s === "deactivated";
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

// api/admin.ts
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
function bearerToken(req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}
function setupHelp() {
  return {
    steps: [
      "Create a NEW Google spreadsheet (it may be empty) for private admin data.",
      'Open Extensions \u2192 Apps Script, paste apps-script/Admin.gs, save, run setAdminScriptToken("...") once, then Deploy \u2192 Web app (execute as Me, access Anyone).',
      "In Vercel \u2192 Project \u2192 Settings \u2192 Environment Variables set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN, ADMIN_SETUP_KEY, ADMIN_SESSION_SECRET, and ADMIN_MIRROR_SECRET. Redeploy. Tabs are created automatically on first contact."
    ]
  };
}
var toAdmin = (r) => ({
  adminId: r.adminId,
  email: r.email,
  role: r.role === "owner" ? "owner" : "admin",
  status: r.status === "suspended" ? "suspended" : "active",
  createdAt: r.createdAt,
  updatedAt: r.updatedAt
});
var toRegistry = (r) => ({
  userId: r.userId,
  name: r.name,
  email: r.email,
  accountStatus: r.accountStatus === "suspended" || r.accountStatus === "deactivated" ? r.accountStatus : "active",
  registeredAt: r.registeredAt,
  lastLoginAt: r.lastLoginAt,
  updatedAt: r.updatedAt
});
var adminRow = (a) => ADMIN_TABS.AdminUsers.map((h) => a[h] ?? "");
var registryRow = (u) => ADMIN_TABS.UserRegistry.map((h) => u[h] ?? "");
function createScriptStore() {
  async function readAdmins() {
    return (await scriptReadTab("AdminUsers")).map(toAdmin);
  }
  async function readRegistry() {
    return (await scriptReadTab("UserRegistry")).map(toRegistry);
  }
  return {
    async listAdmins() {
      return readAdmins();
    },
    async createAdmin(a) {
      await scriptAppendRow("AdminUsers", adminRow(a));
    },
    async updateAdmin(adminId, patch) {
      const cur = (await readAdmins()).find((a) => a.adminId === adminId);
      if (!cur) return null;
      const next = { ...cur, ...patch, adminId: cur.adminId, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      await scriptUpdateRowById("AdminUsers", adminId, adminRow(next));
      return next;
    },
    async listRegistry() {
      return readRegistry();
    },
    async getRegistry(userId) {
      return (await readRegistry()).find((u) => u.userId === userId) ?? null;
    },
    async upsertRegistry(u) {
      const existing = (await readRegistry()).find((x) => x.userId === u.userId) ?? null;
      if (!existing) {
        await scriptAppendRow("UserRegistry", registryRow(u));
        return { record: u, created: true };
      }
      await scriptUpdateRowById("UserRegistry", u.userId, registryRow(u));
      return { record: u, created: false };
    },
    async findLog(logId) {
      const rows = await scriptReadTab("AdminLogs");
      const hit = rows.find((r) => r.logId === logId);
      return hit ? {
        logId: hit.logId,
        adminId: hit.adminId,
        action: hit.action,
        targetUserId: hit.targetUserId,
        previousValue: hit.previousValue,
        newValue: hit.newValue,
        timestamp: hit.timestamp
      } : null;
    },
    async appendLog(entry) {
      const row = ADMIN_TABS.AdminLogs.map(
        (h) => entry[h] ?? ""
      );
      await scriptAppendRow("AdminLogs", row);
    },
    async listLogs(limit) {
      const rows = await scriptReadTab("AdminLogs");
      const all = rows.map((r) => ({
        logId: r.logId,
        adminId: r.adminId,
        action: r.action,
        targetUserId: r.targetUserId,
        previousValue: r.previousValue,
        newValue: r.newValue,
        timestamp: r.timestamp
      })).sort((a, b) => a.timestamp < b.timestamp ? 1 : -1);
      return all.slice(0, Math.min(Math.max(limit || 100, 1), 500));
    },
    async getSetting(key) {
      const rows = await scriptReadTab("AppSettings");
      return rows.find((r) => r.key === key)?.value ?? null;
    },
    async setSetting(key, value) {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const rows = await scriptReadTab("AppSettings");
      if (rows.some((r) => r.key === key)) {
        await scriptUpdateRowById("AppSettings", key, [key, value, now]);
        return;
      }
      await scriptAppendRow("AppSettings", [key, value, now]);
    },
    async listSettings() {
      const rows = await scriptReadTab("AppSettings");
      return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updatedAt }));
    },
    async getAuthProviders(userId) {
      try {
        const rows = await scriptReadTab("UserAuth");
        const hit = rows.find((r) => r.userId === userId);
        if (!hit) return [];
        return String(hit.providers ?? "").split(",").map((p) => p.trim()).filter((p) => p === "password" || p === "google");
      } catch {
        return [];
      }
    },
    async getSheetInfo(userId) {
      try {
        const rows = await scriptReadTab("UserSheets");
        const hit = rows.find((r) => r.userId === userId);
        if (!hit) return null;
        return { status: hit.status ?? "", verifiedAt: hit.verifiedAt ?? "", spreadsheetId: hit.spreadsheetId ?? "" };
      } catch {
        return null;
      }
    }
  };
}
var devStore = null;
function getStore() {
  if (!adminScriptConfigured()) {
    throw Object.assign(new Error("Private admin storage is not configured."), { status: 501 });
  }
  return createScriptStore();
}
function getDevStore() {
  if (!devStore) devStore = createMemoryStore();
  return devStore;
}
function requireSession(req) {
  const secret = process.env.ADMIN_SESSION_SECRET || "";
  const session = verifySessionToken(bearerToken(req), secret);
  if (!session) {
    throw Object.assign(new Error("Admin authentication required."), { status: 401 });
  }
  return session;
}
function sessionTtlMs() {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS || "12");
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 3600 * 1e3;
  return Math.min(hours, 72) * 3600 * 1e3;
}
async function audit(store, entry) {
  try {
    await store.appendLog(
      buildLogEntry({
        logId: entry.logId ?? newId("log"),
        adminId: entry.adminId,
        action: entry.action,
        targetUserId: entry.targetUserId,
        previousValue: entry.previousValue,
        newValue: entry.newValue
      })
    );
  } catch {
  }
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
      const sessionSecret = (process.env.ADMIN_SESSION_SECRET || "").trim();
      const setupKey = (process.env.ADMIN_SETUP_KEY || "").trim();
      const configured = Boolean(adminScriptConfigured() && sessionSecret && setupKey);
      let bootstrapAvailable = null;
      if (configured) {
        try {
          bootstrapAvailable = (await getStore().listAdmins()).length === 0;
        } catch {
          bootstrapAvailable = null;
        }
      }
      res.status(200).json({ success: true, data: { configured, bootstrapAvailable } });
      return;
    }
    if (action === "bootstrap") {
      const setupKey = (process.env.ADMIN_SETUP_KEY || "").trim();
      const sessionSecret = (process.env.ADMIN_SESSION_SECRET || "").trim();
      if (!setupKey || !sessionSecret) {
        res.status(501).json({ success: false, error: "Admin setup is not configured on the server.", ...setupHelp() });
        return;
      }
      if (!secretsEqual(String(body.setupKey ?? ""), setupKey)) {
        res.status(401).json({ success: false, error: "Invalid setup key." });
        return;
      }
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ success: false, error: "Enter a valid owner email address." });
        return;
      }
      const name = String(body.name ?? "").trim().slice(0, 80);
      void name;
      const store2 = getStore();
      const existing = await store2.listAdmins();
      if (existing.length > 0) {
        res.status(403).json({ success: false, error: "The owner is already set up. Bootstrap is disabled." });
        return;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const admin = {
        adminId: newId("adm"),
        email,
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now
      };
      await store2.createAdmin(admin);
      await audit(store2, {
        adminId: admin.adminId,
        action: "owner.bootstrap",
        targetUserId: admin.adminId,
        newValue: email,
        logId: logIdFor(body.idempotencyKey, newId("log"))
      });
      const token = createSessionToken(admin, sessionSecret, sessionTtlMs());
      console.info("[stockly-admin] bootstrap owner created");
      res.status(200).json({ success: true, data: { token, admin: { adminId: admin.adminId, email, role: "owner" } } });
      return;
    }
    if (action === "adminLogin") {
      const setupKey = (process.env.ADMIN_SETUP_KEY || "").trim();
      const sessionSecret = (process.env.ADMIN_SESSION_SECRET || "").trim();
      if (!setupKey || !sessionSecret) {
        res.status(501).json({ success: false, error: "Admin login is not configured on the server." });
        return;
      }
      if (!secretsEqual(String(body.setupKey ?? ""), setupKey)) {
        res.status(401).json({ success: false, error: "Invalid credentials." });
        return;
      }
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ success: false, error: "Enter a valid email address." });
        return;
      }
      const store2 = getStore();
      const admins2 = await store2.listAdmins();
      const admin = admins2.find((a) => a.email === email) ?? null;
      if (!admin || admin.status !== "active") {
        res.status(401).json({ success: false, error: "Invalid credentials." });
        return;
      }
      const token = createSessionToken(admin, sessionSecret, sessionTtlMs());
      await audit(store2, { adminId: admin.adminId, action: "admin.login", targetUserId: admin.adminId });
      console.info("[stockly-admin] admin login");
      res.status(200).json({
        success: true,
        data: { token, admin: { adminId: admin.adminId, email: admin.email, role: admin.role } }
      });
      return;
    }
    if (action === "syncUser") {
      const store2 = getStore();
      let input;
      try {
        input = validateRegistryInput({
          userId: body.userId,
          name: body.name,
          email: body.email,
          registeredAt: body.registeredAt,
          lastLoginAt: body.lastLoginAt
        });
      } catch (e) {
        res.status(400).json({ success: false, error: e instanceof Error ? e.message : "Invalid user data." });
        return;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const existing = await store2.getRegistry(input.userId);
      const { record, created } = mergeRegistryUser(existing, input, now);
      await store2.upsertRegistry(record);
      if (created) {
        await audit(store2, {
          adminId: "system-sync",
          action: "user.syncCreate",
          targetUserId: record.userId
        });
      }
      res.status(200).json({ success: true, data: { user: record, created } });
      return;
    }
    if (action === "checkStatus") {
      const userId = String(body.userId ?? "").trim();
      if (!isValidUserId(userId)) {
        res.status(400).json({ success: false, error: "Invalid userId." });
        return;
      }
      const store2 = getStore();
      const user = await store2.getRegistry(userId);
      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }
      res.status(200).json({ success: true, data: { userId, accountStatus: user.accountStatus } });
      return;
    }
    if (action === "statusEnvelope") {
      const mirrorSecret = (process.env.ADMIN_MIRROR_SECRET || "").trim();
      if (!mirrorSecret) {
        res.status(501).json({
          success: false,
          error: "Status envelopes are not configured. Set ADMIN_MIRROR_SECRET (server) and USER_SYNC_SECRET (Apps Script)."
        });
        return;
      }
      const userId = String(body.userId ?? "").trim();
      if (!isValidUserId(userId)) {
        res.status(400).json({ success: false, error: "Invalid userId." });
        return;
      }
      const store2 = getStore();
      const user = await store2.getRegistry(userId);
      if (!user) {
        res.status(404).json({ success: false, error: "User not found." });
        return;
      }
      const env = signStatusEnvelope(user.userId, user.accountStatus, mirrorSecret);
      res.status(200).json({ success: true, data: env });
      return;
    }
    const session = requireSession(req);
    const store = getStore();
    const admins = await store.listAdmins();
    const me = admins.find((a) => a.adminId === session.adminId) ?? null;
    if (!me || me.status !== "active") {
      res.status(401).json({ success: false, error: "Admin access revoked." });
      return;
    }
    const actorRole = me.role;
    switch (action) {
      case "adminMe": {
        res.status(200).json({ success: true, data: { admin: me } });
        return;
      }
      case "listUsers": {
        const all = await store.listRegistry();
        const stats = computeUserStats(all);
        const { users, total } = filterRegistry(all, {
          search: typeof body.search === "string" ? body.search : "",
          status: typeof body.status === "string" ? body.status : "all",
          limit: typeof body.limit === "number" ? body.limit : 100,
          offset: typeof body.offset === "number" ? body.offset : 0
        });
        const enriched = await Promise.all(
          users.map(async (u) => {
            try {
              const [providers, sheet] = await Promise.all([
                store.getAuthProviders(u.userId),
                store.getSheetInfo(u.userId)
              ]);
              return { ...u, providers, sheetStatus: sheet?.status ?? null, sheetVerifiedAt: sheet?.verifiedAt ?? null };
            } catch {
              return { ...u, providers: [], sheetStatus: null, sheetVerifiedAt: null };
            }
          })
        );
        res.status(200).json({ success: true, data: { users: enriched, total, stats } });
        return;
      }
      case "getUser": {
        const userId = String(body.userId ?? "").trim();
        if (!isValidUserId(userId)) {
          res.status(400).json({ success: false, error: "Invalid userId." });
          return;
        }
        const user = await store.getRegistry(userId);
        if (!user) {
          res.status(404).json({ success: false, error: "User not found." });
          return;
        }
        const [providers, sheet] = await Promise.all([
          store.getAuthProviders(userId).catch(() => []),
          store.getSheetInfo(userId).catch(() => null)
        ]);
        res.status(200).json({
          success: true,
          data: { user: { ...user, providers, sheetStatus: sheet?.status ?? null, sheetVerifiedAt: sheet?.verifiedAt ?? null } }
        });
        return;
      }
      case "setUserStatus": {
        const userId = String(body.userId ?? "").trim();
        const status = body.accountStatus;
        if (!isValidUserId(userId)) {
          res.status(400).json({ success: false, error: "Invalid userId." });
          return;
        }
        if (!isValidAccountStatus(status)) {
          res.status(400).json({ success: false, error: "Invalid account status." });
          return;
        }
        const logId = logIdFor(body.idempotencyKey, newId("log"));
        const seen = await store.findLog(logId);
        if (seen && body.idempotencyKey) {
          const user2 = await store.getRegistry(userId);
          res.status(200).json({ success: true, data: { user: user2, replayed: true } });
          return;
        }
        const user = await store.getRegistry(userId);
        if (!user) {
          res.status(404).json({ success: false, error: "User not found." });
          return;
        }
        const previous = user.accountStatus;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const next = { ...user, accountStatus: status, updatedAt: now };
        await store.upsertRegistry(next);
        try {
          await store.appendLog(
            buildLogEntry({
              logId,
              adminId: me.adminId,
              action: status === "active" ? "user.reactivate" : status === "suspended" ? "user.suspend" : "user.deactivate",
              targetUserId: userId,
              previousValue: previous,
              newValue: status
            })
          );
        } catch {
          const current = await store.getRegistry(userId);
          res.status(200).json({ success: true, data: { user: current, replayed: true } });
          return;
        }
        console.info("[stockly-admin] user status change");
        res.status(200).json({ success: true, data: { user: next, replayed: false } });
        return;
      }
      case "backfill": {
        const list = Array.isArray(body.users) ? body.users : [];
        if (list.length > 200) {
          res.status(400).json({ success: false, error: "Backfill is limited to 200 users per call." });
          return;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        let created = 0;
        let updated = 0;
        let skipped = 0;
        for (const item of list) {
          try {
            const input = validateRegistryInput({
              userId: item.userId,
              name: item.name,
              email: item.email,
              registeredAt: item.registeredAt,
              lastLoginAt: item.lastLoginAt
            });
            const existing = await store.getRegistry(input.userId);
            const merged = mergeRegistryUser(existing, input, now);
            await store.upsertRegistry(merged.record);
            if (merged.created) created += 1;
            else updated += 1;
          } catch {
            skipped += 1;
          }
        }
        await audit(store, {
          adminId: me.adminId,
          action: "user.backfill",
          newValue: `created=${created} updated=${updated} skipped=${skipped}`,
          logId: logIdFor(body.idempotencyKey, newId("log"))
        });
        res.status(200).json({ success: true, data: { created, updated, skipped } });
        return;
      }
      case "listAdmins": {
        const list = (await store.listAdmins()).map((a) => ({ ...a }));
        res.status(200).json({ success: true, data: { admins: list } });
        return;
      }
      case "setAdminRole": {
        if (actorRole !== "owner") {
          res.status(403).json({ success: false, error: "Only the owner can manage roles." });
          return;
        }
        const adminId = String(body.adminId ?? "").trim();
        const role = body.role;
        if (!isValidAdminId(adminId)) {
          res.status(400).json({ success: false, error: "Invalid adminId." });
          return;
        }
        if (!isValidRole(role)) {
          res.status(400).json({ success: false, error: "Invalid role." });
          return;
        }
        const target = admins.find((a) => a.adminId === adminId) ?? null;
        if (!target) {
          res.status(404).json({ success: false, error: "Admin not found." });
          return;
        }
        if (target.adminId === me.adminId && role !== "owner") {
          res.status(400).json({ success: false, error: "The owner cannot demote themselves." });
          return;
        }
        const previous = target.role;
        const next = await store.updateAdmin(adminId, { role });
        await audit(store, {
          adminId: me.adminId,
          action: "admin.setRole",
          targetUserId: adminId,
          previousValue: previous,
          newValue: role,
          logId: logIdFor(body.idempotencyKey, newId("log"))
        });
        res.status(200).json({ success: true, data: { admin: next } });
        return;
      }
      case "listLogs": {
        const logs = await store.listLogs(Number(body.limit) || 100);
        res.status(200).json({ success: true, data: { logs } });
        return;
      }
      case "getSettings": {
        const settings = await store.listSettings();
        res.status(200).json({ success: true, data: { settings } });
        return;
      }
      case "setSetting": {
        const key = String(body.key ?? "").trim();
        const value = String(body.value ?? "");
        if (!isValidSettingKey(key)) {
          res.status(400).json({ success: false, error: "Invalid setting key." });
          return;
        }
        if (value.length > 2e3) {
          res.status(400).json({ success: false, error: "Setting value is too long (max 2000 characters)." });
          return;
        }
        const previous = await store.getSetting(key);
        await store.setSetting(key, value);
        await audit(store, {
          adminId: me.adminId,
          action: "app.setSetting",
          previousValue: `${key}=${(previous ?? "").slice(0, 200)}`,
          newValue: `${key}=${value.slice(0, 200)}`,
          logId: logIdFor(body.idempotencyKey, newId("log"))
        });
        res.status(200).json({ success: true, data: { key, value } });
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
      res.status(501).json({
        success: false,
        error: "Private admin storage is not configured on the server.",
        ...setupHelp()
      });
      return;
    }
    if (status === 401 || status === 403 || status === 400 || status === 404) {
      res.status(status).json({ success: false, error: e instanceof Error ? e.message : "Request failed." });
      return;
    }
    console.error("[stockly-admin] request failed");
    res.status(500).json({ success: false, error: "Admin request failed. Check server logs and try again." });
  }
}
export {
  handler as default,
  getDevStore
};
