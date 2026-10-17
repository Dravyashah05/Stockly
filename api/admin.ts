import { ensureSchemaCached } from './schema.js';
import { applyApiCors } from './cors.js';
/* Stockly private-admin API (Vercel serverless, server-side only).
 *
 * Storage goes through the bound Apps Script project
 * (apps-script/Admin.gs), called here server-to-server. The browser never
 * sees the script URL, the server token, the setup key, or session/mirror
 * secrets — it only calls this same-origin route, authenticated with a
 * short-lived HMAC session token kept in sessionStorage.
 *
 * Required Vercel env vars (NOT VITE_* — never expose these to the client):
 *   ADMIN_SCRIPT_URL            /exec URL of the deployed Admin.gs web app
 *   ADMIN_SCRIPT_TOKEN          server-to-server token (Script Properties)
 *   ADMIN_SETUP_KEY             one-time owner bootstrap + admin login factor
 *   ADMIN_SESSION_SECRET        HMAC secret for admin session tokens
 * Optional:
 *   ADMIN_MIRROR_SECRET         shared with Apps Script USER_SYNC_SECRET for
 *                               signed status envelopes (admin → user sheet)
 *   ADMIN_SESSION_TTL_HOURS     session lifetime (default 12)
 *
 * Admin spreadsheet tabs (exact headers, auto-created by setupSchema):
 *   AdminUsers  adminId,email,role,status,createdAt,updatedAt
 *   UserRegistry userId,name,email,accountStatus,registeredAt,lastLoginAt,updatedAt
 *   AdminLogs   logId,adminId,action,targetUserId,previousValue,newValue,timestamp
 *   AppSettings key,value,updatedAt
 */

import { adminScriptConfigured, scriptAppendRow, scriptReadTab, scriptUpdateRowById } from './apps-script-client.js';
import { RateLimiter } from './device-logic.js';
import {
  ADMIN_TABS,
  buildLogEntry,
  computeUserStats,
  createMemoryStore,
  createSessionToken,
  filterRegistry,
  isValidAccountStatus,
  isValidAdminId,
  isValidEmail,
  isValidRole,
  isValidSettingKey,
  isValidUserId,
  logIdFor,
  mergeRegistryUser,
  newId,
  normalizeEmail,
  secretsEqual,
  signStatusEnvelope,
  validateRegistryInput,
  verifySessionToken,
  type AdminRole,
  type AdminStore,
  type AdminUser,
  type RegistryUser,
} from './admin-logic.js';

type QueryValue = string | string[] | undefined;

interface AdminReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

interface AdminRes {
  status: (code: number) => AdminRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

function readBody(req: AdminReq): Record<string, unknown> {
  const b = req.body;
  if (typeof b === 'string') {
    try {
      const parsed: unknown = JSON.parse(b || '{}');
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof b === 'object' && b !== null) return b as Record<string, unknown>;
  return {};
}

function bearerToken(req: AdminReq): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}

function clientIp(req: AdminReq): string {
  const raw = req.headers?.['x-forwarded-for'] ?? req.headers?.['X-Forwarded-For'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ((value ?? '').split(',')[0] ?? '').trim() || 'unknown';
}

// The setup key is the sole login factor: throttle guessing like the user
// login path (10/min/IP, in-memory per instance, best-effort on serverless).
const adminAuthLimiter = new RateLimiter(10, 60_000);

function setupHelp(): Record<string, string[]> {
  return {
    steps: [
      'Create a NEW Google spreadsheet (it may be empty) for private admin data.',
      'Open Extensions → Apps Script, paste apps-script/Admin.gs, save, run setAdminScriptToken("...") once, then Deploy → Web app (execute as Me, access Anyone).',
      'In Vercel → Project → Settings → Environment Variables set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN, ADMIN_SETUP_KEY, ADMIN_SESSION_SECRET, and ADMIN_MIRROR_SECRET. Redeploy. Tabs are created automatically on first contact.',
    ],
  };
}

/* ------------------------- Admin script store ------------------------- */
/* Storage goes through the bound Apps Script project (apps-script/Admin.gs)
 * via api/apps-script-client.ts — no service-account keys anywhere. */

const toAdmin = (r: Record<string, string>): AdminUser => ({
  adminId: r.adminId,
  email: r.email,
  role: (r.role === 'owner' ? 'owner' : 'admin') as AdminRole,
  status: (r.status === 'suspended' ? 'suspended' : 'active') as AdminUser['status'],
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});
const toRegistry = (r: Record<string, string>): RegistryUser => ({
  userId: r.userId,
  name: r.name,
  email: r.email,
  accountStatus:
    r.accountStatus === 'suspended' || r.accountStatus === 'deactivated' ? r.accountStatus : 'active',
  registeredAt: r.registeredAt,
  lastLoginAt: r.lastLoginAt,
  updatedAt: r.updatedAt,
});
const adminRow = (a: AdminUser): (string | number)[] =>
  ADMIN_TABS.AdminUsers.map((h) => (a as unknown as Record<string, string>)[h] ?? '');
const registryRow = (u: RegistryUser): (string | number)[] =>
  ADMIN_TABS.UserRegistry.map((h) => (u as unknown as Record<string, string>)[h] ?? '');

function createScriptStore(): AdminStore {
  async function readAdmins(): Promise<AdminUser[]> {
    return (await scriptReadTab('AdminUsers')).map(toAdmin);
  }
  async function readRegistry(): Promise<RegistryUser[]> {
    return (await scriptReadTab('UserRegistry')).map(toRegistry);
  }
  return {
    async listAdmins() {
      return readAdmins();
    },
    async createAdmin(a) {
      await scriptAppendRow('AdminUsers', adminRow(a));
    },
    async updateAdmin(adminId, patch) {
      const cur = (await readAdmins()).find((a) => a.adminId === adminId);
      if (!cur) return null;
      const next = { ...cur, ...patch, adminId: cur.adminId, updatedAt: new Date().toISOString() };
      await scriptUpdateRowById('AdminUsers', adminId, adminRow(next));
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
        await scriptAppendRow('UserRegistry', registryRow(u));
        return { record: u, created: true };
      }
      await scriptUpdateRowById('UserRegistry', u.userId, registryRow(u));
      return { record: u, created: false };
    },
    async findLog(logId) {
      const rows = await scriptReadTab('AdminLogs');
      const hit = rows.find((r) => r.logId === logId);
      return hit
        ? {
            logId: hit.logId,
            adminId: hit.adminId,
            action: hit.action,
            targetUserId: hit.targetUserId,
            previousValue: hit.previousValue,
            newValue: hit.newValue,
            timestamp: hit.timestamp,
          }
        : null;
    },
    async appendLog(entry) {
      const row = ADMIN_TABS.AdminLogs.map(
        (h) => (entry as unknown as Record<string, string>)[h] ?? '',
      );
      await scriptAppendRow('AdminLogs', row);
    },
    async listLogs(limit) {
      const rows = await scriptReadTab('AdminLogs');
      const all = rows
        .map((r) => ({
          logId: r.logId,
          adminId: r.adminId,
          action: r.action,
          targetUserId: r.targetUserId,
          previousValue: r.previousValue,
          newValue: r.newValue,
          timestamp: r.timestamp,
        }))
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      return all.slice(0, Math.min(Math.max(limit || 100, 1), 500));
    },
    async getSetting(key) {
      const rows = await scriptReadTab('AppSettings');
      return rows.find((r) => r.key === key)?.value ?? null;
    },
    async setSetting(key, value) {
      const now = new Date().toISOString();
      const rows = await scriptReadTab('AppSettings');
      if (rows.some((r) => r.key === key)) {
        await scriptUpdateRowById('AppSettings', key, [key, value, now]);
        return;
      }
      await scriptAppendRow('AppSettings', [key, value, now]);
    },
    async listSettings() {
      const rows = await scriptReadTab('AppSettings');
      return rows.map((r) => ({ key: r.key, value: r.value, updatedAt: r.updatedAt }));
    },
    async getAuthProviders(userId: string) {
      try {
        const rows = await scriptReadTab('UserAuth');
        const hit = rows.find((r) => r.userId === userId);
        if (!hit) return [];
        return String(hit.providers ?? '')
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p === 'password' || p === 'google');
      } catch {
        return [];
      }
    },
    async getSheetInfo(userId: string) {
      try {
        const rows = await scriptReadTab('UserSheets');
        const hit = rows.find((r) => r.userId === userId);
        if (!hit) return null;
        return { status: hit.status ?? '', verifiedAt: hit.verifiedAt ?? '', spreadsheetId: hit.spreadsheetId ?? '' };
      } catch {
        return null;
      }
    },
  };
}

let devStore: AdminStore | null = null;

function getStore(): AdminStore {
  if (!adminScriptConfigured()) {
    throw Object.assign(new Error('Private admin storage is not configured.'), { status: 501 });
  }
  return createScriptStore();
}

/** Test/dev hook: an isolated in-memory store (never used when configured). */
export function getDevStore(): AdminStore {
  if (!devStore) devStore = createMemoryStore();
  return devStore;
}

function requireSession(req: AdminReq): { adminId: string; email: string; role: AdminRole } {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  const session = verifySessionToken(bearerToken(req), secret);
  if (!session) {
    throw Object.assign(new Error('Admin authentication required.'), { status: 401 });
  }
  return session;
}

function sessionTtlMs(): number {
  const hours = Number(process.env.ADMIN_SESSION_TTL_HOURS || '12');
  if (!Number.isFinite(hours) || hours <= 0) return 12 * 3600 * 1000;
  return Math.min(hours, 72) * 3600 * 1000;
}

async function audit(
  store: AdminStore,
  entry: { adminId: string; action: string; targetUserId?: string; previousValue?: string; newValue?: string; logId?: string },
): Promise<void> {
  try {
    await store.appendLog(
      buildLogEntry({
        logId: entry.logId ?? newId('log'),
        adminId: entry.adminId,
        action: entry.action,
        targetUserId: entry.targetUserId,
        previousValue: entry.previousValue,
        newValue: entry.newValue,
      }),
    );
  } catch {
    /* audit failures must not mask the primary result */
  }
}

export default async function handler(req: AdminReq, res: AdminRes): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  applyApiCors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).json({ success: true });
    return;
  }
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed.' });
    return;
  }
  const body = req.method === 'POST' ? readBody(req) : {};
  const queryAction =
    req.query && typeof req.query.action === 'string' ? req.query.action : undefined;
  const action = String((body.action as string) ?? queryAction ?? '').trim();

  try {
    // Auto-provision: a fresh empty spreadsheet grows its tabs on first
    // contact. Best-effort — endpoints below report their own errors.
    try {
      await ensureSchemaCached();
    } catch {
      /* schema provisioning is best-effort */
    }
    if (!action || action === 'status') {
      const sessionSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
      const setupKey = (process.env.ADMIN_SETUP_KEY || '').trim();
      const configured = Boolean(adminScriptConfigured() && sessionSecret && setupKey);
      let bootstrapAvailable: boolean | null = null;
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

    if (action === 'bootstrap') {
      const setupKey = (process.env.ADMIN_SETUP_KEY || '').trim();
      const sessionSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
      if (!setupKey || !sessionSecret) {
        res.status(501).json({ success: false, error: 'Admin setup is not configured on the server.', ...setupHelp() });
        return;
      }
      if (!adminAuthLimiter.take(`bootstrap:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: 'Too many attempts. Wait a minute and try again.' });
        return;
      }
      if (!secretsEqual(String(body.setupKey ?? ''), setupKey)) {
        res.status(401).json({ success: false, error: 'Invalid setup key.' });
        return;
      }
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ success: false, error: 'Enter a valid owner email address.' });
        return;
      }
      const name = String(body.name ?? '').trim().slice(0, 80);
      void name;
      const store = getStore();
      const existing = await store.listAdmins();
      if (existing.length > 0) {
        res.status(403).json({ success: false, error: 'The owner is already set up. Bootstrap is disabled.' });
        return;
      }
      const now = new Date().toISOString();
      const admin: AdminUser = {
        adminId: newId('adm'),
        email,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await store.createAdmin(admin);
      await audit(store, {
        adminId: admin.adminId,
        action: 'owner.bootstrap',
        targetUserId: admin.adminId,
        newValue: email,
        logId: logIdFor(body.idempotencyKey, newId('log')),
      });
      const token = createSessionToken(admin, sessionSecret, sessionTtlMs());
      console.info('[stockly-admin] bootstrap owner created');
      res.status(200).json({ success: true, data: { token, admin: { adminId: admin.adminId, email, role: 'owner' } } });
      return;
    }

    if (action === 'adminLogin') {
      const setupKey = (process.env.ADMIN_SETUP_KEY || '').trim();
      const sessionSecret = (process.env.ADMIN_SESSION_SECRET || '').trim();
      if (!setupKey || !sessionSecret) {
        res.status(501).json({ success: false, error: 'Admin login is not configured on the server.' });
        return;
      }
      if (!adminAuthLimiter.take(`adminLogin:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: 'Too many attempts. Wait a minute and try again.' });
        return;
      }
      if (!secretsEqual(String(body.setupKey ?? ''), setupKey)) {
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
        return;
      }
      const email = normalizeEmail(body.email);
      if (!isValidEmail(email)) {
        res.status(400).json({ success: false, error: 'Enter a valid email address.' });
        return;
      }
      const store = getStore();
      const admins = await store.listAdmins();
      const admin = admins.find((a) => a.email === email) ?? null;
      if (!admin || admin.status !== 'active') {
        res.status(401).json({ success: false, error: 'Invalid credentials.' });
        return;
      }
      const token = createSessionToken(admin, sessionSecret, sessionTtlMs());
      await audit(store, { adminId: admin.adminId, action: 'admin.login', targetUserId: admin.adminId });
      console.info('[stockly-admin] admin login');
      res.status(200).json({
        success: true,
        data: { token, admin: { adminId: admin.adminId, email: admin.email, role: admin.role } },
      });
      return;
    }

    if (action === 'syncUser') {
      // Public by design (called right after registration from the user's
      // device). Strictly validated; upserts profile fields by stable userId
      // and NEVER changes accountStatus on existing rows.
      const store = getStore();
      let input;
      try {
        input = validateRegistryInput({
          userId: body.userId,
          name: body.name,
          email: body.email,
          registeredAt: body.registeredAt,
          lastLoginAt: body.lastLoginAt,
        });
      } catch (e) {
        res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Invalid user data.' });
        return;
      }
      const now = new Date().toISOString();
      const existing = await store.getRegistry(input.userId);
      const { record, created } = mergeRegistryUser(existing, input, now);
      // Write directly: the tab was just read above, so upsertRegistry's
      // internal re-read would be a redundant round-trip for the same data.
      if (!existing) await scriptAppendRow('UserRegistry', registryRow(record));
      else await scriptUpdateRowById('UserRegistry', input.userId, registryRow(record));
      if (created) {
        await audit(store, {
          adminId: 'system-sync',
          action: 'user.syncCreate',
          targetUserId: record.userId,
        });
      }
      res.status(200).json({ success: true, data: { user: record, created } });
      return;
    }

    if (action === 'checkStatus') {
      const userId = String(body.userId ?? '').trim();
      if (!isValidUserId(userId)) {
        res.status(400).json({ success: false, error: 'Invalid userId.' });
        return;
      }
      const store = getStore();
      const user = await store.getRegistry(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }
      res.status(200).json({ success: true, data: { userId, accountStatus: user.accountStatus } });
      return;
    }

    if (action === 'statusEnvelope') {
      const mirrorSecret = (process.env.ADMIN_MIRROR_SECRET || '').trim();
      if (!mirrorSecret) {
        res.status(501).json({
          success: false,
          error: 'Status envelopes are not configured. Set ADMIN_MIRROR_SECRET (server) and USER_SYNC_SECRET (Apps Script).',
        });
        return;
      }
      const userId = String(body.userId ?? '').trim();
      if (!isValidUserId(userId)) {
        res.status(400).json({ success: false, error: 'Invalid userId.' });
        return;
      }
      const store = getStore();
      const user = await store.getRegistry(userId);
      if (!user) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
      }
      const env = signStatusEnvelope(user.userId, user.accountStatus, mirrorSecret);
      res.status(200).json({ success: true, data: env });
      return;
    }

    // ---- everything below requires a valid admin session ----
    const session = requireSession(req);
    const store = getStore();
    const admins = await store.listAdmins();
    const me = admins.find((a) => a.adminId === session.adminId) ?? null;
    if (!me || me.status !== 'active') {
      res.status(401).json({ success: false, error: 'Admin access revoked.' });
      return;
    }
    const actorRole: AdminRole = me.role;

    switch (action) {
      case 'adminMe': {
        res.status(200).json({ success: true, data: { admin: me } });
        return;
      }
      case 'listUsers': {
        const all = await store.listRegistry();
        const stats = computeUserStats(all);
        const { users, total } = filterRegistry(all, {
          search: typeof body.search === 'string' ? body.search : '',
          status: typeof body.status === 'string' ? body.status : 'all',
          limit: typeof body.limit === 'number' ? body.limit : 100,
          offset: typeof body.offset === 'number' ? body.offset : 0,
        });
        // Enrich with auth methods + sheet connection (best-effort; the
        // core list must never fail because of enrichment). Both tabs are
        // read ONCE for the whole page — per-user reads here cost a full
        // Apps Script round-trip each (100 users = 200 calls before).
        let providersByUser = new Map<string, string[]>();
        let sheetByUser = new Map<string, { status: string; verifiedAt: string }>();
        try {
          const [authRows, sheetRows] = await Promise.all([scriptReadTab('UserAuth'), scriptReadTab('UserSheets')]);
          for (const r of authRows) {
            if (!r.userId) continue;
            providersByUser.set(
              r.userId,
              String(r.providers ?? '')
                .split(',')
                .map((p) => p.trim())
                .filter((p) => p === 'password' || p === 'google'),
            );
          }
          for (const r of sheetRows) {
            if (!r.userId) continue;
            sheetByUser.set(r.userId, { status: r.status ?? '', verifiedAt: r.verifiedAt ?? '' });
          }
        } catch {
          /* enrichment unavailable — core list still served below */
        }
        const enriched = users.map((u) => {
          const sheet = sheetByUser.get(u.userId);
          return {
            ...u,
            providers: providersByUser.get(u.userId) ?? [],
            sheetStatus: sheet?.status ?? null,
            sheetVerifiedAt: sheet?.verifiedAt ?? null,
          };
        });
        res.status(200).json({ success: true, data: { users: enriched, total, stats } });
        return;
      }
      case 'getUser': {
        const userId = String(body.userId ?? '').trim();
        if (!isValidUserId(userId)) {
          res.status(400).json({ success: false, error: 'Invalid userId.' });
          return;
        }
        const user = await store.getRegistry(userId);
        if (!user) {
          res.status(404).json({ success: false, error: 'User not found.' });
          return;
        }
        const [providers, sheet] = await Promise.all([
          store.getAuthProviders(userId).catch(() => [] as string[]),
          store.getSheetInfo(userId).catch(() => null),
        ]);
        res.status(200).json({
          success: true,
          data: { user: { ...user, providers, sheetStatus: sheet?.status ?? null, sheetVerifiedAt: sheet?.verifiedAt ?? null } },
        });
        return;
      }
      case 'setUserStatus': {
        const userId = String(body.userId ?? '').trim();
        const status = body.accountStatus;
        if (!isValidUserId(userId)) {
          res.status(400).json({ success: false, error: 'Invalid userId.' });
          return;
        }
        if (!isValidAccountStatus(status)) {
          res.status(400).json({ success: false, error: 'Invalid account status.' });
          return;
        }
        const logId = logIdFor(body.idempotencyKey, newId('log'));
        // Independent reads — one batch instead of two round-trips.
        const [seen, user] = await Promise.all([store.findLog(logId), store.getRegistry(userId)]);
        if (seen && body.idempotencyKey) {
          res.status(200).json({ success: true, data: { user, replayed: true } });
          return;
        }
        if (!user) {
          res.status(404).json({ success: false, error: 'User not found.' });
          return;
        }
        const previous = user.accountStatus;
        const now = new Date().toISOString();
        const next: RegistryUser = { ...user, accountStatus: status, updatedAt: now };
        await store.upsertRegistry(next);
        try {
          await store.appendLog(
            buildLogEntry({
              logId,
              adminId: me.adminId,
              action: status === 'active' ? 'user.reactivate' : status === 'suspended' ? 'user.suspend' : 'user.deactivate',
              targetUserId: userId,
              previousValue: previous,
              newValue: status,
            }),
          );
        } catch {
          /* duplicate log id → treat as replay */
          const current = await store.getRegistry(userId);
          res.status(200).json({ success: true, data: { user: current, replayed: true } });
          return;
        }
        console.info('[stockly-admin] user status change');
        res.status(200).json({ success: true, data: { user: next, replayed: false } });
        return;
      }
      case 'backfill': {
        const list = Array.isArray(body.users) ? body.users : [];
        if (list.length > 200) {
          res.status(400).json({ success: false, error: 'Backfill is limited to 200 users per call.' });
          return;
        }
        const now = new Date().toISOString();
        let created = 0;
        let updated = 0;
        let skipped = 0;
        // Read the tab once up front: per-item getRegistry would cost a
        // full Apps Script round-trip per row (200 items = 200 calls).
        // Writes stay sequential — Apps Script serializes them under a
        // lock anyway, so parallel writes only add contention.
        let snapshot: RegistryUser[];
        try {
          snapshot = await store.listRegistry();
        } catch {
          res.status(502).json({ success: false, error: 'Could not read the user registry.' });
          return;
        }
        const byId = new Map(snapshot.map((u) => [u.userId, u]));
        for (const item of list) {
          try {
            const input = validateRegistryInput({
              userId: (item as Record<string, unknown>).userId,
              name: (item as Record<string, unknown>).name,
              email: (item as Record<string, unknown>).email,
              registeredAt: (item as Record<string, unknown>).registeredAt,
              lastLoginAt: (item as Record<string, unknown>).lastLoginAt,
            });
            const merged = mergeRegistryUser(byId.get(input.userId) ?? null, input, now);
            if (merged.created) await scriptAppendRow('UserRegistry', registryRow(merged.record));
            else await scriptUpdateRowById('UserRegistry', input.userId, registryRow(merged.record));
            byId.set(input.userId, merged.record);
            if (merged.created) created += 1;
            else updated += 1;
          } catch {
            skipped += 1;
          }
        }
        await audit(store, {
          adminId: me.adminId,
          action: 'user.backfill',
          newValue: `created=${created} updated=${updated} skipped=${skipped}`,
          logId: logIdFor(body.idempotencyKey, newId('log')),
        });
        res.status(200).json({ success: true, data: { created, updated, skipped } });
        return;
      }
      case 'listAdmins': {
        const list = (await store.listAdmins()).map((a) => ({ ...a }));
        res.status(200).json({ success: true, data: { admins: list } });
        return;
      }
      case 'setAdminRole': {
        if (actorRole !== 'owner') {
          res.status(403).json({ success: false, error: 'Only the owner can manage roles.' });
          return;
        }
        const adminId = String(body.adminId ?? '').trim();
        const role = body.role;
        if (!isValidAdminId(adminId)) {
          res.status(400).json({ success: false, error: 'Invalid adminId.' });
          return;
        }
        if (!isValidRole(role)) {
          res.status(400).json({ success: false, error: 'Invalid role.' });
          return;
        }
        const target = admins.find((a) => a.adminId === adminId) ?? null;
        if (!target) {
          res.status(404).json({ success: false, error: 'Admin not found.' });
          return;
        }
        if (target.adminId === me.adminId && role !== 'owner') {
          res.status(400).json({ success: false, error: 'The owner cannot demote themselves.' });
          return;
        }
        const previous = target.role;
        const next = await store.updateAdmin(adminId, { role });
        await audit(store, {
          adminId: me.adminId,
          action: 'admin.setRole',
          targetUserId: adminId,
          previousValue: previous,
          newValue: role,
          logId: logIdFor(body.idempotencyKey, newId('log')),
        });
        res.status(200).json({ success: true, data: { admin: next } });
        return;
      }
      case 'listLogs': {
        const logs = await store.listLogs(Number(body.limit) || 100);
        res.status(200).json({ success: true, data: { logs } });
        return;
      }
      case 'getSettings': {
        const settings = await store.listSettings();
        res.status(200).json({ success: true, data: { settings } });
        return;
      }
      case 'setSetting': {
        const key = String(body.key ?? '').trim();
        const value = String(body.value ?? '');
        if (!isValidSettingKey(key)) {
          res.status(400).json({ success: false, error: 'Invalid setting key.' });
          return;
        }
        if (value.length > 2000) {
          res.status(400).json({ success: false, error: 'Setting value is too long (max 2000 characters).' });
          return;
        }
        const previous = await store.getSetting(key);
        await store.setSetting(key, value);
        await audit(store, {
          adminId: me.adminId,
          action: 'app.setSetting',
          previousValue: `${key}=${(previous ?? '').slice(0, 200)}`,
          newValue: `${key}=${value.slice(0, 200)}`,
          logId: logIdFor(body.idempotencyKey, newId('log')),
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
    const status = typeof (e as { status?: unknown }).status === 'number'
      ? ((e as { status: number }).status as number)
      : 500;
    if (status === 501) {
      res.status(501).json({
        success: false,
        error: 'Private admin storage is not configured on the server.',
        ...setupHelp(),
      });
      return;
    }
    if (status === 401 || status === 403 || status === 400 || status === 404) {
      res.status(status).json({ success: false, error: e instanceof Error ? e.message : 'Request failed.' });
      return;
    }
    console.error('[stockly-admin] request failed');
    res.status(500).json({ success: false, error: 'Admin request failed. Check server logs and try again.' });
  }
}
