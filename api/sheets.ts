import { ensureSchemaCached } from './schema.ts';
/* Stockly user-sheet gateway (Vercel serverless, server-side only).
 *
 * Every user connects their OWN spreadsheet; the verified association
 * (userId → exec URL + spreadsheet id) lives in the UserSheets tab of the
 * private admin spreadsheet and can only be written by the verify flow
 * below — never by a frontend variable. The browser never learns any exec
 * URL: inventory traffic goes through `proxy`, which resolves the target
 * server-side from the authenticated session.
 *
 * Central guard (also mirrored by frontend route guards, which are NOT
 * trusted): valid auth session + active account + verified sheet
 * connection + authorized device. Suspended users, unverified sheets,
 * and revoked devices are rejected HERE.
 *
 * Required env (server-side): ADMIN_SCRIPT_URL + ADMIN_SCRIPT_TOKEN
 * (bound Admin.gs deployment), AUTH_SESSION_SECRET.
 * DEVICE_SESSION_SECRET for device checks.
 */

import { adminScriptConfigured, scriptAppendRow, scriptReadTab, scriptUpdateRowById } from './apps-script-client.ts';
import { parseSheetInput, verifyAuthSession } from './auth-logic.ts';
import { verifyDeviceSessionFormat } from './device-logic.ts';

export const USER_SHEETS_HEADERS = ['userId', 'spreadsheetId', 'execUrl', 'status', 'verifiedAt', 'updatedAt'] as const;
export const REQUIRED_TABS = ['Products', 'Categories', 'StockTransactions', 'Settings', 'Users'] as const;
export type SheetConnStatus = 'verified' | 'failed' | 'revoked';

interface SheetsReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

type QueryValue = string | string[] | undefined;

interface SheetsRes {
  status: (code: number) => SheetsRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

interface SheetConnection {
  userId: string;
  spreadsheetId: string;
  execUrl: string;
  status: SheetConnStatus;
  verifiedAt: string;
  updatedAt: string;
}

function readBody(req: SheetsReq): Record<string, unknown> {
  const b = req.body;
  if (typeof b === 'string') {
    try {
      const parsed: unknown = JSON.parse(b || '{}');
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  if (typeof b === 'object' && b !== null) return b as Record<string, unknown>;
  return {};
}

function bearerToken(req: SheetsReq): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}

function deviceHeader(req: SheetsReq): string | null {
  const raw = req.headers?.['x-device-session'] ?? req.headers?.['X-Device-Session'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? value.trim() : null;
}

function httpError(message: string, status: number): Error & { status?: number } {
  return Object.assign(new Error(message), { status });
}

/* Storage goes through the bound Apps Script project (apps-script/Admin.gs)
 * via api/apps-script-client.ts — no service-account keys anywhere. */

function toConnection(r: string[]): SheetConnection {
  const st = r[3] ?? '';
  return {
    userId: r[0] ?? '',
    spreadsheetId: r[1] ?? '',
    execUrl: r[2] ?? '',
    status: st === 'verified' || st === 'failed' || st === 'revoked' ? st : 'failed',
    verifiedAt: r[4] ?? '',
    updatedAt: r[5] ?? '',
  };
}

async function findConnection(userId: string): Promise<{ conn: SheetConnection | null; exists: boolean }> {
  const rows = await scriptReadTab('UserSheets');
  const hit = rows.find((r) => r.userId === userId);
  if (!hit) return { conn: null, exists: false };
  return { conn: toConnection([hit.userId, hit.spreadsheetId, hit.execUrl, hit.status, hit.verifiedAt, hit.updatedAt]), exists: true };
}

async function saveConnection(conn: SheetConnection, exists: boolean): Promise<void> {
  const row = [conn.userId, conn.spreadsheetId, conn.execUrl, conn.status, conn.verifiedAt, conn.updatedAt];
  if (!exists) await scriptAppendRow('UserSheets', row);
  else await scriptUpdateRowById('UserSheets', conn.userId, row);
}

async function readAccountStatus(userId: string): Promise<string> {
  const rows = await scriptReadTab('UserRegistry');
  const hit = rows.find((r) => r.userId === userId);
  return hit?.accountStatus ?? 'active';
}

async function listUserDeviceIds(userId: string): Promise<string[]> {
  const rows = await scriptReadTab('Devices');
  return rows.filter((r) => r.userId === userId && r.status === 'active').map((r) => r.deviceId);
}

async function auditLog(entry: { adminId: string; action: string; targetUserId?: string; previousValue?: string; newValue?: string }): Promise<void> {
  try {
    const now = new Date().toISOString();
    const rand = Math.random().toString(36).slice(2, 10);
    await scriptAppendRow('AdminLogs', [`log_${Date.now().toString(36)}${rand}`, entry.adminId, entry.action, entry.targetUserId ?? '', entry.previousValue ?? '', entry.newValue ?? '', now]);
  } catch {
    /* best-effort */
  }
}

/* ------------------------- upstream Apps Script ------------------------- */

function validExecTarget(raw: string): URL {
  const parsed = parseSheetInput(raw);
  if (!parsed || parsed.kind !== 'exec') {
    throw httpError('Provide the deployed Apps Script Web App /exec URL from your own sheet.', 400);
  }
  return new URL(String(raw).trim());
}

async function upstreamGet(target: URL, params: Record<string, string>): Promise<unknown> {
  const u = new URL(target.toString());
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { method: 'GET', redirect: 'follow' });
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw httpError('The connected Apps Script did not return JSON. Redeploy it with execute-as-Me, Anyone access.', 502);
  }
}

async function upstreamPost(target: URL, payload: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(target.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow',
  });
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw httpError('The connected Apps Script did not return JSON. Redeploy it with execute-as-Me, Anyone access.', 502);
  }
}

interface DescribeResult {
  spreadsheetId: string;
  version: string;
  tabs: string[];
}

/** Verify a candidate exec URL end-to-end and return its authoritative description. */
async function verifyExecUrl(execUrl: string): Promise<{ target: URL; desc: DescribeResult }> {
  const target = validExecTarget(execUrl);
  const health = (await upstreamGet(target, { action: 'health' })) as { success?: boolean };
  if (!health || health.success !== true) {
    throw httpError('Could not reach that Apps Script deployment. Check the URL and deployment access (Anyone).', 400);
  }
  const raw = (await upstreamGet(target, { action: 'describe' })) as {
    success?: boolean;
    data?: { spreadsheetId?: unknown; version?: unknown; tabs?: unknown };
    error?: unknown;
  };
  if (!raw || raw.success !== true || !raw.data || typeof raw.data.spreadsheetId !== 'string') {
    throw httpError('That deployment is not a Stockly backend (v1.5+ required). Update apps-script/Code.gs and redeploy.', 400);
  }
  const desc: DescribeResult = {
    spreadsheetId: raw.data.spreadsheetId,
    version: String(raw.data.version ?? ''),
    tabs: Array.isArray(raw.data.tabs) ? (raw.data.tabs as unknown[]).map((t) => String(t)) : [],
  };
  if (!/^[A-Za-z0-9_-]{20,}$/.test(desc.spreadsheetId)) {
    throw httpError('The deployment returned an invalid spreadsheet id.', 502);
  }
  // Note: the private admin spreadsheet runs different code (Admin.gs) with
  // no inventory tabs, so it fails the describe check below and can never
  // be connected as a user sheet.
  // Safely initialize any missing tabs/headers (setupDatabase is idempotent
  // and never deletes data).
  const missing = REQUIRED_TABS.filter((t) => !desc.tabs.includes(t));
  if (missing.length > 0) {
    const done = (await upstreamPost(target, { action: 'setupDatabase' })) as { success?: boolean; error?: unknown };
    if (!done || done.success !== true) {
      throw httpError('The sheet is missing required tabs and could not be initialized. Open the sheet and run setupDatabase once.', 400);
    }
    const retry = (await upstreamGet(target, { action: 'describe' })) as { success?: boolean; data?: { tabs?: unknown } };
    const tabs2: string[] = Array.isArray(retry?.data?.tabs) ? (retry.data.tabs as unknown[]).map((t) => String(t)) : [];
    const stillMissing = REQUIRED_TABS.filter((t) => !tabs2.includes(t));
    if (stillMissing.length > 0) {
      throw httpError(`Required tabs still missing: ${stillMissing.join(', ')}. Run setupDatabase in Apps Script.`, 400);
    }
  }
  return { target, desc };
}

/** Central authorization: session + account + connection + device. */
async function authorize(
  req: SheetsReq,
): Promise<{ userId: string; conn: SheetConnection; deviceId: string | null; deviceSession: string | null }> {
  const authSecret = process.env.AUTH_SESSION_SECRET || '';
  const session = verifyAuthSession(bearerToken(req), authSecret);
  if (!session) throw httpError('Sign-in required.', 401);
  const accountStatus = await readAccountStatus(session.userId);
  if (accountStatus !== 'active') {
    throw httpError(accountStatus === 'suspended' ? 'This account is suspended. Contact the owner.' : 'This account is not active. Contact the owner.', 403);
  }
  const { conn } = await findConnection(session.userId);
  if (!conn || conn.status !== 'verified' || !conn.execUrl) {
    const e = httpError('No verified sheet connection. Connect your Google Sheet first.', 403);
    (e as { reason?: string }).reason = 'sheet-not-connected';
    throw e;
  }
  const deviceIds = await listUserDeviceIds(session.userId);
  let deviceId: string | null = null;
  let deviceSession: string | null = null;
  if (deviceIds.length > 0) {
    const raw = deviceHeader(req);
    const ds = verifyDeviceSessionFormat(raw, process.env.DEVICE_SESSION_SECRET || '');
    if (!ds || ds.userId !== session.userId || !deviceIds.includes(ds.deviceId)) {
      const e = httpError('This device is not authorized. Re-link it from Settings.', 401);
      (e as { reason?: string }).reason = 'device-unauthorized';
      throw e;
    }
    deviceId = ds.deviceId;
    deviceSession = raw;
  }
  return { userId: session.userId, conn, deviceId, deviceSession };
}

function getDeps(): void {
  if (!adminScriptConfigured() || !process.env.AUTH_SESSION_SECRET) {
    throw httpError('Sheet service is not configured on the server.', 501);
  }
}

const ALLOWED_PROXY_ACTIONS = new Set([
  'health',
  'listProducts',
  'getProduct',
  'listCategories',
  'listTransactions',
  'dashboard',
  'sync',
  'getUser',
  'getUserByEmail',
  'createProduct',
  'updateProduct',
  'deleteProduct',
  'createCategory',
  'updateCategory',
  'deleteCategory',
  'stockIn',
  'stockOut',
  'registerUser',
  'updateUserProfile',
  'reportLogin',
  'mirrorStatus',
]);

export default async function handler(req: SheetsReq, res: SheetsRes): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  // Native Android WebViews call the deployed backend cross-origin:
  // allow preflight + Authorization/device headers (no cookies used).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Session');
  if (req.method === 'OPTIONS') {
    res.status(200).json({ success: true });
    return;
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }
  const body = req.method === 'POST' ? readBody(req) : {};
  const queryAction = req.query && typeof req.query.action === 'string' ? req.query.action : undefined;
  const action = String((body.action as string) ?? queryAction ?? '').trim();

  try {
    // Auto-provision: a fresh empty spreadsheet grows its tabs on first
    // contact. Best-effort — endpoints below report their own errors.
    try {
      await ensureSchemaCached();
    } catch {
      /* schema provisioning is best-effort */
    }
    getDeps();

    if (action === 'getConnection') {
      // Reports state even when no sheet is connected: session + account
      // are validated, the sheet check is the point of this call.
      const authSecret = process.env.AUTH_SESSION_SECRET || '';
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: 'Sign-in required.' });
        return;
      }
      const accountStatus = await readAccountStatus(session.userId);
      if (accountStatus !== 'active') {
        res.status(403).json({ success: false, error: 'This account is not active. Contact the owner.', reason: 'suspended' });
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
          connected: conn.status === 'verified',
          status: conn.status,
          spreadsheetId: conn.spreadsheetId || null,
          verifiedAt: conn.verifiedAt || null,
        },
      });
      return;
    }

    if (action === 'connectSheet' || action === 'reverify') {
      const authSecret = process.env.AUTH_SESSION_SECRET || '';
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: 'Sign-in required.' });
        return;
      }
      const accountStatus = await readAccountStatus(session.userId);
      if (accountStatus !== 'active') {
        res.status(403).json({ success: false, error: 'This account is not active. Contact the owner.' });
        return;
      }
      let execUrl: string;
      if (action === 'reverify') {
        const found = await findConnection(session.userId);
        if (!found.conn) {
          res.status(404).json({ success: false, error: 'No sheet connection to verify yet.' });
          return;
        }
        execUrl = found.conn.execUrl;
      } else {
        execUrl = String(body.execUrl ?? '').trim();
        if (!execUrl) {
          res.status(400).json({ success: false, error: 'Paste your Apps Script Web App /exec URL.' });
          return;
        }
      }
      try {
        const { desc } = await verifyExecUrl(execUrl);
        const now = new Date().toISOString();
        const found = await findConnection(session.userId);
        await saveConnection(
          {
            userId: session.userId,
            spreadsheetId: desc.spreadsheetId,
            execUrl,
            status: 'verified',
            verifiedAt: now,
            updatedAt: now,
          },
          found.exists,
        );
        await auditLog({
          adminId: `user:${session.userId}`,
          action: action === 'reverify' ? 'sheet.reverify' : 'sheet.connect',
          targetUserId: session.userId,
          newValue: `verified:${desc.spreadsheetId}`,
        });
        console.info('[stockly-sheets] connection verified');
        res.status(200).json({
          success: true,
          data: { connected: true, status: 'verified', spreadsheetId: desc.spreadsheetId, verifiedAt: now, version: desc.version },
        });
        return;
      } catch (e) {
        const now = new Date().toISOString();
        const found = await findConnection(session.userId).catch(() => ({ conn: null, exists: false }));
        if (action === 'connectSheet' && found.conn) {
          await saveConnection({ ...found.conn, status: 'failed', updatedAt: now }, found.exists).catch(() => undefined);
        }
        throw e;
      }
    }

    if (action === 'proxy') {
      const { userId, conn, deviceId, deviceSession } = await authorize(req);
      const gsAction = String(body.gsAction ?? '').trim();
      if (!ALLOWED_PROXY_ACTIONS.has(gsAction)) {
        res.status(400).json({ success: false, error: 'Unknown inventory action.' });
        return;
      }
      const target = validExecTarget(conn.execUrl);
      const method = body.method === 'POST' ? 'POST' : 'GET';
      let inner: unknown;
      if (method === 'GET') {
        const params: Record<string, string> = {};
        const extra = body.params;
        if (extra && typeof extra === 'object') {
          for (const [k, v] of Object.entries(extra as Record<string, unknown>)) {
            if ((typeof v === 'string' || typeof v === 'number') && k !== 'action') params[k] = String(v);
          }
        }
        // Server-chosen action wins; client params can never override it.
        inner = await upstreamGet(target, { ...params, action: gsAction });
      } else {
        const payload = body.body && typeof body.body === 'object' ? { ...(body.body as Record<string, unknown>) } : {};
        // Server-trusted identity for the Apps Script layer (defense in
        // depth alongside the gateway check above). Client fields can
        // never override the authenticated identity.
        delete payload.userId;
        delete payload.deviceId;
        delete payload.deviceSession;
        inner = await upstreamPost(target, {
          ...payload,
          action: gsAction,
          userId,
          ...(deviceId && deviceSession ? { deviceId, deviceSession } : {}),
        });
      }
      // Pass the Apps Script envelope through: the client's
      // interpretApiResponse maps backend errors to safe UI messages.
      res.status(200).json(inner);
      return;
    }

    res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    return;
  } catch (e) {
    const status = typeof (e as { status?: unknown }).status === 'number' ? ((e as { status: number }).status as number) : 500;
    if (status === 501) {
      res.status(501).json({
        success: false,
        error: 'Sheet service is not configured on the server.',
        steps: [
          'Deploy apps-script/Admin.gs on the private admin spreadsheet (tabs are created automatically).',
          'Set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN and AUTH_SESSION_SECRET in Vercel environment variables and redeploy.',
        ],
      });
      return;
    }
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 429 || status === 502) {
      const out: Record<string, unknown> = { success: false, error: e instanceof Error ? e.message : 'Request failed.' };
      const reason = (e as { reason?: unknown }).reason;
      if (typeof reason === 'string') out.reason = reason;
      res.status(status).json(out);
      return;
    }
    console.error('[stockly-sheets] request failed');
    res.status(500).json({ success: false, error: 'Sheet request failed. Check server logs and try again.' });
  }
}
