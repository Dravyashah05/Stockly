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
var USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
function isValidUserId(id) {
  return typeof id === "string" && USER_ID_RE.test(id.trim());
}

// api/auth-logic.js
var AUTH_SESSION_TTL_MS = 30 * 24 * 3600 * 1e3;
var isValidAuthUserId = isValidUserId;
function b64urlDecode(input) {
  return Buffer.from(input, "base64url").toString("utf8");
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

// api/sheets.ts
var USER_SHEETS_HEADERS = ["userId", "spreadsheetId", "execUrl", "status", "verifiedAt", "updatedAt"];
var REQUIRED_TABS = ["Products", "Categories", "StockTransactions", "Settings", "Users"];
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
function deviceHeader(req) {
  const raw = req.headers?.["x-device-session"] ?? req.headers?.["X-Device-Session"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? value.trim() : null;
}
function httpError2(message, status) {
  return Object.assign(new Error(message), { status });
}
function toConnection(r) {
  const st = r[3] ?? "";
  return {
    userId: r[0] ?? "",
    spreadsheetId: r[1] ?? "",
    execUrl: r[2] ?? "",
    status: st === "verified" || st === "failed" || st === "revoked" ? st : "failed",
    verifiedAt: r[4] ?? "",
    updatedAt: r[5] ?? ""
  };
}
async function findConnection(userId) {
  const rows = await scriptReadTab("UserSheets");
  const hit = rows.find((r) => r.userId === userId);
  if (!hit) return { conn: null, exists: false };
  return { conn: toConnection([hit.userId, hit.spreadsheetId, hit.execUrl, hit.status, hit.verifiedAt, hit.updatedAt]), exists: true };
}
async function saveConnection(conn, exists) {
  const row = [conn.userId, conn.spreadsheetId, conn.execUrl, conn.status, conn.verifiedAt, conn.updatedAt];
  if (!exists) await scriptAppendRow("UserSheets", row);
  else await scriptUpdateRowById("UserSheets", conn.userId, row);
}
async function readAccountStatus(userId) {
  const rows = await scriptReadTab("UserRegistry");
  const hit = rows.find((r) => r.userId === userId);
  return hit?.accountStatus ?? "active";
}
async function listUserDeviceIds(userId) {
  const rows = await scriptReadTab("Devices");
  return rows.filter((r) => r.userId === userId && r.status === "active").map((r) => r.deviceId);
}
async function auditLog(entry) {
  try {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const rand = Math.random().toString(36).slice(2, 10);
    await scriptAppendRow("AdminLogs", [`log_${Date.now().toString(36)}${rand}`, entry.adminId, entry.action, entry.targetUserId ?? "", entry.previousValue ?? "", entry.newValue ?? "", now]);
  } catch {
  }
}
function validExecTarget(raw) {
  const parsed = parseSheetInput(raw);
  if (!parsed || parsed.kind !== "exec") {
    throw httpError2("Provide the deployed Apps Script Web App /exec URL from your own sheet.", 400);
  }
  return new URL(String(raw).trim());
}
async function upstreamGet(target, params) {
  const u = new URL(target.toString());
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { method: "GET", redirect: "follow" });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw httpError2("The connected Apps Script did not return JSON. Redeploy it with execute-as-Me, Anyone access.", 502);
  }
}
async function upstreamPost(target, payload) {
  const res = await fetch(target.toString(), {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
    redirect: "follow"
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw httpError2("The connected Apps Script did not return JSON. Redeploy it with execute-as-Me, Anyone access.", 502);
  }
}
async function verifyExecUrl(execUrl) {
  const target = validExecTarget(execUrl);
  const health = await upstreamGet(target, { action: "health" });
  if (!health || health.success !== true) {
    throw httpError2("Could not reach that Apps Script deployment. Check the URL and deployment access (Anyone).", 400);
  }
  const raw = await upstreamGet(target, { action: "describe" });
  if (!raw || raw.success !== true || !raw.data || typeof raw.data.spreadsheetId !== "string") {
    throw httpError2("That deployment is not a Stockly backend (v1.5+ required). Update apps-script/Code.gs and redeploy.", 400);
  }
  const desc = {
    spreadsheetId: raw.data.spreadsheetId,
    version: String(raw.data.version ?? ""),
    tabs: Array.isArray(raw.data.tabs) ? raw.data.tabs.map((t) => String(t)) : []
  };
  if (!/^[A-Za-z0-9_-]{20,}$/.test(desc.spreadsheetId)) {
    throw httpError2("The deployment returned an invalid spreadsheet id.", 502);
  }
  const missing = REQUIRED_TABS.filter((t) => !desc.tabs.includes(t));
  if (missing.length > 0) {
    const done = await upstreamPost(target, { action: "setupDatabase" });
    if (!done || done.success !== true) {
      throw httpError2("The sheet is missing required tabs and could not be initialized. Open the sheet and run setupDatabase once.", 400);
    }
    const retry = await upstreamGet(target, { action: "describe" });
    const tabs2 = Array.isArray(retry?.data?.tabs) ? retry.data.tabs.map((t) => String(t)) : [];
    const stillMissing = REQUIRED_TABS.filter((t) => !tabs2.includes(t));
    if (stillMissing.length > 0) {
      throw httpError2(`Required tabs still missing: ${stillMissing.join(", ")}. Run setupDatabase in Apps Script.`, 400);
    }
  }
  return { target, desc };
}
async function authorize(req) {
  const authSecret = process.env.AUTH_SESSION_SECRET || "";
  const session = verifyAuthSession(bearerToken(req), authSecret);
  if (!session) throw httpError2("Sign-in required.", 401);
  const accountStatus = await readAccountStatus(session.userId);
  if (accountStatus !== "active") {
    throw httpError2(accountStatus === "suspended" ? "This account is suspended. Contact the owner." : "This account is not active. Contact the owner.", 403);
  }
  const { conn } = await findConnection(session.userId);
  if (!conn || conn.status !== "verified" || !conn.execUrl) {
    const e = httpError2("No verified sheet connection. Connect your Google Sheet first.", 403);
    e.reason = "sheet-not-connected";
    throw e;
  }
  const deviceIds = await listUserDeviceIds(session.userId);
  let deviceId = null;
  let deviceSession = null;
  if (deviceIds.length > 0) {
    const raw = deviceHeader(req);
    const ds = verifyDeviceSessionFormat(raw, process.env.DEVICE_SESSION_SECRET || "");
    if (!ds || ds.userId !== session.userId || !deviceIds.includes(ds.deviceId)) {
      const e = httpError2("This device is not authorized. Re-link it from Settings.", 401);
      e.reason = "device-unauthorized";
      throw e;
    }
    deviceId = ds.deviceId;
    deviceSession = raw;
  }
  return { userId: session.userId, conn, deviceId, deviceSession };
}
function getDeps() {
  if (!adminScriptConfigured() || !process.env.AUTH_SESSION_SECRET) {
    throw httpError2("Sheet service is not configured on the server.", 501);
  }
}
var ALLOWED_PROXY_ACTIONS = /* @__PURE__ */ new Set([
  "health",
  "listProducts",
  "getProduct",
  "listCategories",
  "listTransactions",
  "dashboard",
  "sync",
  "getUser",
  "getUserByEmail",
  "createProduct",
  "updateProduct",
  "deleteProduct",
  "createCategory",
  "updateCategory",
  "deleteCategory",
  "stockIn",
  "stockOut",
  "registerUser",
  "updateUserProfile",
  "reportLogin",
  "mirrorStatus"
]);
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
    getDeps();
    if (action === "getConnection") {
      const authSecret = process.env.AUTH_SESSION_SECRET || "";
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: "Sign-in required." });
        return;
      }
      const accountStatus = await readAccountStatus(session.userId);
      if (accountStatus !== "active") {
        res.status(403).json({ success: false, error: "This account is not active. Contact the owner.", reason: "suspended" });
        return;
      }
      const { conn } = await findConnection(session.userId);
      if (!conn) {
        res.status(200).json({ success: true, data: { connected: false, status: null } });
        return;
      }
      res.status(200).json({
        success: true,
        data: {
          connected: conn.status === "verified",
          status: conn.status,
          spreadsheetId: conn.spreadsheetId || null,
          verifiedAt: conn.verifiedAt || null
        }
      });
      return;
    }
    if (action === "connectSheet" || action === "reverify") {
      const authSecret = process.env.AUTH_SESSION_SECRET || "";
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: "Sign-in required." });
        return;
      }
      const accountStatus = await readAccountStatus(session.userId);
      if (accountStatus !== "active") {
        res.status(403).json({ success: false, error: "This account is not active. Contact the owner." });
        return;
      }
      let execUrl;
      if (action === "reverify") {
        const found = await findConnection(session.userId);
        if (!found.conn) {
          res.status(404).json({ success: false, error: "No sheet connection to verify yet." });
          return;
        }
        execUrl = found.conn.execUrl;
      } else {
        execUrl = String(body.execUrl ?? "").trim();
        if (!execUrl) {
          res.status(400).json({ success: false, error: "Paste your Apps Script Web App /exec URL." });
          return;
        }
      }
      try {
        const { desc } = await verifyExecUrl(execUrl);
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const found = await findConnection(session.userId);
        await saveConnection(
          {
            userId: session.userId,
            spreadsheetId: desc.spreadsheetId,
            execUrl,
            status: "verified",
            verifiedAt: now,
            updatedAt: now
          },
          found.exists
        );
        await auditLog({
          adminId: `user:${session.userId}`,
          action: action === "reverify" ? "sheet.reverify" : "sheet.connect",
          targetUserId: session.userId,
          newValue: `verified:${desc.spreadsheetId}`
        });
        console.info("[stockly-sheets] connection verified");
        res.status(200).json({
          success: true,
          data: { connected: true, status: "verified", spreadsheetId: desc.spreadsheetId, verifiedAt: now, version: desc.version }
        });
        return;
      } catch (e) {
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const found = await findConnection(session.userId).catch(() => ({ conn: null, exists: false }));
        if (action === "connectSheet" && found.conn) {
          await saveConnection({ ...found.conn, status: "failed", updatedAt: now }, found.exists).catch(() => void 0);
        }
        throw e;
      }
    }
    if (action === "proxy") {
      const { userId, conn, deviceId, deviceSession } = await authorize(req);
      const gsAction = String(body.gsAction ?? "").trim();
      if (!ALLOWED_PROXY_ACTIONS.has(gsAction)) {
        res.status(400).json({ success: false, error: "Unknown inventory action." });
        return;
      }
      const target = validExecTarget(conn.execUrl);
      const method = body.method === "POST" ? "POST" : "GET";
      let inner;
      if (method === "GET") {
        const params = {};
        const extra = body.params;
        if (extra && typeof extra === "object") {
          for (const [k, v] of Object.entries(extra)) {
            if ((typeof v === "string" || typeof v === "number") && k !== 'action') params[k] = String(v);
          }
        }
        inner = await upstreamGet(target, { ...params, action: gsAction });
      } else {
        const payload = body.body && typeof body.body === "object" ? { ...body.body } : {};
        delete payload.userId;
        delete payload.deviceId;
        delete payload.deviceSession;
        inner = await upstreamPost(target, {
          ...payload,
          action: gsAction,
          userId,
          ...deviceId && deviceSession ? { deviceId, deviceSession } : {}
        });
      }
      res.status(200).json(inner);
      return;
    }
    res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    return;
  } catch (e) {
    const status = typeof e.status === "number" ? e.status : 500;
    if (status === 501) {
      res.status(501).json({
        success: false,
        error: "Sheet service is not configured on the server.",
        steps: [
          "Deploy apps-script/Admin.gs on the private admin spreadsheet (tabs are created automatically).",
          "Set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN and AUTH_SESSION_SECRET in Vercel environment variables and redeploy."
        ]
      });
      return;
    }
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 429 || status === 502) {
      const out = { success: false, error: e instanceof Error ? e.message : "Request failed." };
      const reason = e.reason;
      if (typeof reason === "string") out.reason = reason;
      res.status(status).json(out);
      return;
    }
    console.error("[stockly-sheets] request failed");
    res.status(500).json({ success: false, error: "Sheet request failed. Check server logs and try again." });
  }
}
export {
  REQUIRED_TABS,
  USER_SHEETS_HEADERS,
  handler as default
};
