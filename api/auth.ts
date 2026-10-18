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

// api/auth-logic.js
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
function validateDisplayName(name) {
  const n = String(name ?? "").trim().replace(/\s+/g, " ");
  if (!n) throw new Error("Enter your name.");
  if (n.length > 80) throw new Error("Name is too long (max 80 characters).");
  return n;
}
function validatePassword(password) {
  const p = String(password ?? "");
  if (p.length < 8) throw new Error("Password must be at least 8 characters.");
  if (p.length > 256) throw new Error("Password is too long (max 256 characters).");
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    throw new Error("Password must include both letters and numbers.");
  }
  return p;
}

// api/auth-logic.js
var AUTH_SESSION_TTL_MS = 30 * 24 * 3600 * 1e3;
var isValidAuthEmail = isValidEmail;
var isValidAuthUserId = isValidUserId;
var normalizeAuthEmail = normalizeEmail;
var SCRYPT_N = 16384;
var SCRYPT_R = 8;
var SCRYPT_P = 1;
var KEY_LEN = 64;
var SALT_LEN = 32;
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

// api/device-logic.js
import { createHash as createHash2, createHmac as createHmac2, randomBytes as randomBytes2, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
var QR_LINK_TTL_MS = 5 * 60 * 1e3;
var CODE_LINK_TTL_MS = 10 * 60 * 1e3;
var DEVICE_SESSION_TTL_MS = 90 * 24 * 3600 * 1e3;
var DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
var USER_ID_RE2 = /^[A-Za-z0-9_-]{8,64}$/;
function isValidDeviceId(id) {
  return typeof id === "string" && DEVICE_ID_RE.test(id.trim());
}
function isValidUserIdRef(id) {
  return typeof id === "string" && USER_ID_RE2.test(id.trim());
}
function sha256hex(input) {
  return createHash2("sha256").update(input, "utf8").digest("hex");
}
function hashEqual(aHex, bHex) {
  try {
    const a = Buffer.from(String(aHex).trim(), "hex");
    const b = Buffer.from(String(bHex).trim(), "hex");
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual2(a, b);
  } catch {
    return false;
  }
}
function b64urlDecode2(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}
function verifyDeviceSessionFormat(token, secret) {
  try {
    if (typeof token !== "string" || !secret) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac2("sha256", secret).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expect.length || !timingSafeEqual2(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode2(body));
    if (!payload || !isValidUserIdRef(payload.userId) || !isValidDeviceId(payload.deviceId) || typeof payload.iat !== "number" || typeof payload.exp !== "number") {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// api/admin-logic.js
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

// api/auth.ts
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
function clientIp(req) {
  const raw = req.headers?.["x-forwarded-for"] ?? req.headers?.["X-Forwarded-For"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ((value ?? "").split(",")[0] ?? "").trim() || "unknown";
}
function httpError2(message, status) {
  return Object.assign(new Error(message), { status });
}
function toAuthUser(r) {
  return {
    userId: r.userId,
    email: r.email,
    name: r.name,
    passwordHash: r.passwordHash ?? "",
    providers: parseProviders(r.providers),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  };
}
function authRow(u) {
  return [u.userId, u.email, u.name, u.passwordHash, serializeProviders(u.providers), u.createdAt, u.updatedAt];
}
function createScriptAuthStore() {
  async function readAll() {
    return scriptReadTab("UserAuth");
  }
  return {
    async findByEmail(email) {
      const want = normalizeAuthEmail(email);
      const hit = (await readAll()).map(toAuthUser).find((u) => normalizeAuthEmail(u.email) === want);
      return hit ?? null;
    },
    async findById(userId) {
      const hit = (await readAll()).map(toAuthUser).find((u) => u.userId === userId);
      return hit ?? null;
    },
    async create(user) {
      await scriptAppendRow("UserAuth", authRow(user));
    },
    async update(user) {
      const rows = await scriptReadTab("UserAuth");
      if (!rows.some((r) => r.userId === user.userId)) throw httpError2("User not found.", 404);
      await scriptUpdateRowById("UserAuth", user.userId, authRow(user));
    },
    async count() {
      const rows = await scriptReadTab("UserAuth");
      return rows.filter((r) => r.userId).length;
    }
  };
}
async function readRegistryEntry(userId) {
  const rows = await scriptReadTab("UserRegistry");
  const hit = rows.find((r) => r.userId === userId);
  if (!hit) return null;
  return {
    name: hit.name ?? "",
    email: hit.email ?? "",
    accountStatus: hit.accountStatus ?? "active",
    registeredAt: hit.registeredAt ?? "",
    lastLoginAt: hit.lastLoginAt ?? ""
  };
}
async function touchRegistry(input, isLogin) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const rows = await scriptReadTab("UserRegistry");
  const hit = rows.find((r) => r.userId === input.userId);
  let existing = null;
  if (hit) {
    const st = hit.accountStatus ?? "active";
    existing = {
      userId: input.userId,
      name: hit.name ?? "",
      email: hit.email ?? "",
      accountStatus: st === "suspended" || st === "deactivated" ? st : "active",
      registeredAt: hit.registeredAt ?? "",
      lastLoginAt: hit.lastLoginAt ?? "",
      updatedAt: hit.updatedAt ?? ""
    };
  }
  const { record } = mergeRegistryUser(
    existing,
    { userId: input.userId, name: input.name, email: input.email, registeredAt: "", lastLoginAt: isLogin ? now : "" },
    now
  );
  const row = [record.userId, record.name, record.email, record.accountStatus, record.registeredAt, record.lastLoginAt, record.updatedAt];
  if (!hit) await scriptAppendRow("UserRegistry", row);
  else await scriptUpdateRowById("UserRegistry", input.userId, row);
}
async function auditLog(entry) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rand = Math.random().toString(36).slice(2, 10);
    const row = [`log_${Date.now().toString(36)}${rand}`, entry.adminId, entry.action, entry.targetUserId ?? "", entry.previousValue ?? "", entry.newValue ?? "", now];
    await scriptAppendRow("AdminLogs", row);
  } catch {
  }
}
function getDeps() {
  const authSecret = process.env.AUTH_SESSION_SECRET || "";
  if (!adminScriptConfigured() || !authSecret) {
    throw httpError2("Account service is not configured on the server.", 501);
  }
  return { store: createScriptAuthStore(), authSecret };
}
var loginLimiter = /* @__PURE__ */ new Map();
function loginAllowed(key, now = Date.now()) {
  const list = (loginLimiter.get(key) ?? []).filter((t) => t > now - 6e4);
  if (list.length >= 10) {
    loginLimiter.set(key, list);
    return false;
  }
  list.push(now);
  loginLimiter.set(key, list);
  if (loginLimiter.size > 5e3) loginLimiter.delete([...loginLimiter.keys()][0]);
  return true;
}
function publicUser(u, accountStatus) {
  return { userId: u.userId, email: u.email, name: u.name, providers: u.providers, accountStatus };
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
      const configured = Boolean(adminScriptConfigured() && process.env.AUTH_SESSION_SECRET);
      res.status(200).json({
        success: true,
        data: {
          configured
        }
      });
      return;
    }
    const { store, authSecret } = getDeps();
    const mint = (userId) => createAuthSession(userId, authSecret, AUTH_SESSION_TTL_MS);
    if (action === "register") {
      if (!loginAllowed(`reg:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: "Too many attempts. Wait a minute and try again." });
        return;
      }
      let name;
      let password;
      const email = normalizeAuthEmail(body.email);
      try {
        name = validateDisplayName(body.name);
        password = validatePassword(body.password);
      } catch (e) {
        res.status(400).json({ success: false, error: e instanceof Error ? e.message : "Invalid input." });
        return;
      }
      if (!isValidAuthEmail(email)) {
        res.status(400).json({ success: false, error: "Enter a valid email address." });
        return;
      }
      const existing = await store.findByEmail(email);
      if (existing) {
        res.status(409).json({ success: false, error: "An account with this email already exists. Sign in instead." });
        return;
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const user = {
        userId: newAuthUserId(),
        email,
        name,
        passwordHash: hashPassword(password),
        providers: ["password"],
        createdAt: now,
        updatedAt: now
      };
      await store.create(user);
      await touchRegistry({ userId: user.userId, name, email }, true);
      await auditLog({ adminId: `user:${user.userId}`, action: "auth.register", targetUserId: user.userId, newValue: "password" });
      console.info("[stockly-auth] password registration");
      res.status(200).json({ success: true, data: { session: mint(user.userId), user: publicUser(user, "active") } });
      return;
    }
    if (action === "login") {
      if (!loginAllowed(`login:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: "Too many attempts. Wait a minute and try again." });
        return;
      }
      const email = normalizeAuthEmail(body.email);
      const password = String(body.password ?? "");
      const user = isValidAuthEmail(email) ? await store.findByEmail(email) : null;
      const hashOk = user && user.passwordHash ? verifyPassword(password, user.passwordHash) && user.providers.includes("password") : false;
      if (!user || !hashOk) {
        res.status(401).json({ success: false, error: "Incorrect email or password." });
        return;
      }
      const reg = await readRegistryEntry(user.userId);
      const accountStatus = reg?.accountStatus ?? "active";
      if (accountStatus !== "active") {
        res.status(403).json({
          success: false,
          error: accountStatus === "suspended" ? "This account is suspended. Contact the owner." : "This account is deactivated. Contact the owner."
        });
        return;
      }
      await touchRegistry({ userId: user.userId, name: user.name, email: user.email }, true);
      await auditLog({ adminId: `user:${user.userId}`, action: "auth.login", targetUserId: user.userId, newValue: "password" });
      res.status(200).json({ success: true, data: { session: mint(user.userId), user: publicUser(user, accountStatus) } });
      return;
    }
    if (action === "logout") {
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (session) {
        await auditLog({ adminId: `user:${session.userId}`, action: "auth.logout", targetUserId: session.userId });
      }
      res.status(200).json({ success: true, data: { ok: true } });
      return;
    }
    if (action === "me") {
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: "Sign-in required." });
        return;
      }
      const user = await store.findById(session.userId);
      if (!user) {
        res.status(401).json({ success: false, error: "Account not found." });
        return;
      }
      const reg = await readRegistryEntry(user.userId);
      const accountStatus = reg?.accountStatus ?? "active";
      res.status(200).json({
        success: true,
        data: {
          user: publicUser(user, accountStatus),
          registeredAt: reg?.registeredAt ?? user.createdAt,
          lastLoginAt: reg?.lastLoginAt ?? null
        }
      });
      return;
    }
    if (action === "linkAdopt") {
      const linkId = String(body.linkId ?? "").trim();
      const token = String(body.token ?? "").trim();
      const deviceId = String(body.deviceId ?? "").trim();
      if (!linkId || !token || !deviceId) {
        res.status(400).json({ success: false, error: "Invalid link adoption request." });
        return;
      }
      const rows = await scriptReadTab("DeviceLinks");
      const row = rows.find((r) => r.linkId === linkId) ?? null;
      if (!row) {
        res.status(404).json({ success: false, error: "Link not found." });
        return;
      }
      const status = row.status ?? "";
      const storedHash = row.tokenHash ?? "";
      let claimantDeviceId = "";
      try {
        claimantDeviceId = String(JSON.parse(String(row.claimant ?? "")).deviceId ?? "");
      } catch {
        claimantDeviceId = "";
      }
      const tokenOk = hashEqual(sha256hex(token), storedHash) || hashEqual(sha256hex(token.replace(/[^A-Z0-9]/gi, "").toUpperCase()), storedHash);
      if (status !== "approved" || !tokenOk || claimantDeviceId !== deviceId) {
        res.status(403).json({ success: false, error: "This link cannot be used to sign in." });
        return;
      }
      const userId = row.userId ?? "";
      const user = isValidAuthUserId(userId) ? await store.findById(userId) : null;
      if (!user) {
        res.status(404).json({ success: false, error: "Account not found." });
        return;
      }
      const reg = await readRegistryEntry(userId);
      const accountStatus = reg?.accountStatus ?? "active";
      if (accountStatus !== "active") {
        res.status(403).json({ success: false, error: "This account is not active. Contact the owner." });
        return;
      }
      await auditLog({ adminId: `user:${userId}`, action: "auth.linkAdopt", targetUserId: userId, newValue: deviceId });
      res.status(200).json({ success: true, data: { session: mint(userId), user: publicUser(user, accountStatus) } });
      return;
    }
    if (action === "checkDevice") {
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: "Sign-in required." });
        return;
      }
      const ds = verifyDeviceSessionFormat(String(body.deviceSession ?? ""), process.env.DEVICE_SESSION_SECRET || "");
      res.status(200).json({ success: true, data: { deviceOk: !!ds && ds.userId === session.userId } });
      return;
    }
    res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    return;
  } catch (e) {
    const status = typeof e.status === "number" ? e.status : 500;
    if (status === 501) {
      res.status(501).json({
        success: false,
        error: "Account service is not configured on the server.",
        steps: [
          "Deploy apps-script/Admin.gs on the private admin spreadsheet (tabs are created automatically).",
          "Set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN and AUTH_SESSION_SECRET in Vercel environment variables and redeploy."
        ]
      });
      return;
    }
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 429) {
      res.status(status).json({ success: false, error: e instanceof Error ? e.message : "Request failed." });
      return;
    }
    console.error("[stockly-auth] request failed");
    res.status(500).json({ success: false, error: "Sign-in failed. Check server logs and try again." });
  }
}
export {
  handler as default
};
