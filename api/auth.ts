import { ensureSchemaCached } from './schema.ts';
import { applyApiCors } from './cors.ts';
/* Stockly account-auth API (Vercel serverless, server-side only).
 *
 * Email/password sign-in, verified HERE. Passwords are hashed with scrypt
 * and only hashes reach the private admin spreadsheet (UserAuth tab).
 * Plaintext passwords are never stored or logged.
 *
 * Required Vercel env vars (server-side only, never VITE_*):
 *   ADMIN_SCRIPT_URL + ADMIN_SCRIPT_TOKEN (bound Admin.gs deployment).
 *   AUTH_SESSION_SECRET   HMAC secret for auth session tokens.
 */

import { adminScriptConfigured, scriptAppendRow, scriptReadTab, scriptUpdateRowById } from './apps-script-client.ts';
import {
  AUTH_SESSION_TTL_MS,
  AUTH_TABS,
  createAuthSession,
  hashPassword,
  isValidAuthEmail,
  isValidAuthUserId,
  newAuthUserId,
  normalizeAuthEmail,
  parseProviders,
  serializeProviders,
  validateDisplayName,
  validatePassword,
  verifyAuthSession,
  verifyPassword,
  type AuthStore,
  type AuthUser,
} from './auth-logic.ts';
import { hashEqual, sha256hex } from './device-logic.ts';
import { mergeRegistryUser } from './admin-logic.ts';

type QueryValue = string | string[] | undefined;

interface AuthReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

interface AuthRes {
  status: (code: number) => AuthRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

function readBody(req: AuthReq): Record<string, unknown> {
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

function bearerToken(req: AuthReq): string | null {
  const raw = req.headers?.authorization ?? req.headers?.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  return match ? match[1].trim() : null;
}

function clientIp(req: AuthReq): string {
  const raw = req.headers?.['x-forwarded-for'] ?? req.headers?.['X-Forwarded-For'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return ((value ?? '').split(',')[0] ?? '').trim() || 'unknown';
}

function httpError(message: string, status: number): Error & { status?: number } {
  return Object.assign(new Error(message), { status });
}

/* Storage goes through the bound Apps Script project (apps-script/Admin.gs)
 * via api/apps-script-client.ts — no service-account keys anywhere. */

function toAuthUser(r: Record<string, string>): AuthUser {
  return {
    userId: r.userId,
    email: r.email,
    name: r.name,
    passwordHash: r.passwordHash ?? '',
    providers: parseProviders(r.providers),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function authRow(u: AuthUser): (string | number)[] {
  return [u.userId, u.email, u.name, u.passwordHash, serializeProviders(u.providers), u.createdAt, u.updatedAt];
}

function createScriptAuthStore(): AuthStore {
  async function readAll(): Promise<Record<string, string>[]> {
    return scriptReadTab('UserAuth');
  }
  return {
    async findByEmail(email: string) {
      const want = normalizeAuthEmail(email);
      const hit = (await readAll()).map(toAuthUser).find((u) => normalizeAuthEmail(u.email) === want);
      return hit ?? null;
    },
    async findById(userId: string) {
      const hit = (await readAll()).map(toAuthUser).find((u) => u.userId === userId);
      return hit ?? null;
    },
    async create(user: AuthUser) {
      await scriptAppendRow('UserAuth', authRow(user));
    },
    async update(user: AuthUser) {
      const rows = await scriptReadTab('UserAuth');
      if (!rows.some((r) => r.userId === user.userId)) throw httpError('User not found.', 404);
      await scriptUpdateRowById('UserAuth', user.userId, authRow(user));
    },
    async count() {
      const rows = await scriptReadTab('UserAuth');
      return rows.filter((r) => r.userId).length;
    },
  };
}

/** Read account status + profile summary from the registry (same sheet). */
async function readRegistryEntry(
  userId: string,
): Promise<{ name: string; email: string; accountStatus: string; registeredAt: string; lastLoginAt: string } | null> {
  const rows = await scriptReadTab('UserRegistry');
  const hit = rows.find((r) => r.userId === userId);
  if (!hit) return null;
  return {
    name: hit.name ?? '',
    email: hit.email ?? '',
    accountStatus: hit.accountStatus ?? 'active',
    registeredAt: hit.registeredAt ?? '',
    lastLoginAt: hit.lastLoginAt ?? '',
  };
}

/** Upsert registry profile fields by stable userId (status never touched). */
async function touchRegistry(
  input: { userId: string; name: string; email: string },
  isLogin: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const rows = await scriptReadTab('UserRegistry');
  const hit = rows.find((r) => r.userId === input.userId);
  let existing: { userId: string; name: string; email: string; accountStatus: 'active' | 'suspended' | 'deactivated'; registeredAt: string; lastLoginAt: string; updatedAt: string } | null = null;
  if (hit) {
    const st = hit.accountStatus ?? 'active';
    existing = {
      userId: input.userId,
      name: hit.name ?? '',
      email: hit.email ?? '',
      accountStatus: st === 'suspended' || st === 'deactivated' ? st : 'active',
      registeredAt: hit.registeredAt ?? '',
      lastLoginAt: hit.lastLoginAt ?? '',
      updatedAt: hit.updatedAt ?? '',
    };
  }
  const { record } = mergeRegistryUser(
    existing,
    { userId: input.userId, name: input.name, email: input.email, registeredAt: '', lastLoginAt: isLogin ? now : '' },
    now,
  );
  const row = [record.userId, record.name, record.email, record.accountStatus, record.registeredAt, record.lastLoginAt, record.updatedAt];
  if (!hit) await scriptAppendRow('UserRegistry', row);
  else await scriptUpdateRowById('UserRegistry', input.userId, row);
}

async function auditLog(
  entry: { adminId: string; action: string; targetUserId?: string; previousValue?: string; newValue?: string },
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const rand = Math.random().toString(36).slice(2, 10);
    const row = [`log_${Date.now().toString(36)}${rand}`, entry.adminId, entry.action, entry.targetUserId ?? '', entry.previousValue ?? '', entry.newValue ?? '', now];
    await scriptAppendRow('AdminLogs', row);
  } catch {
    /* audit failures must not mask the primary result */
  }
}

function getDeps(): { store: AuthStore; authSecret: string } {
  const authSecret = process.env.AUTH_SESSION_SECRET || '';
  if (!adminScriptConfigured() || !authSecret) {
    throw httpError('Account service is not configured on the server.', 501);
  }
  return { store: createScriptAuthStore(), authSecret };
}

// In-memory credential-stuffing guard (per instance; persistent lockout
// intentionally NOT implemented — failed logins never reveal whether the
// account exists, and responses stay uniform).
const loginLimiter = new Map<string, number[]>();
function loginAllowed(key: string, now = Date.now()): boolean {
  const list = (loginLimiter.get(key) ?? []).filter((t) => t > now - 60_000);
  if (list.length >= 10) {
    loginLimiter.set(key, list);
    return false;
  }
  list.push(now);
  loginLimiter.set(key, list);
  if (loginLimiter.size > 5000) loginLimiter.delete([...loginLimiter.keys()][0]);
  return true;
}

function publicUser(u: AuthUser, accountStatus: string): Record<string, unknown> {
  return { userId: u.userId, email: u.email, name: u.name, providers: u.providers, accountStatus };
}

/** Fire-and-forget bookkeeping (last-login stamps, audit rows): the response
 *  never carries their results, so awaiting them only burns extra Apps Script
 *  round-trips on the sign-in critical path. Never rejects. On ephemeral
 *  serverless instances a frozen background write is simply retried next
 *  login — lastLoginAt/audit rows are best-effort by design. */
function bg(work: Promise<unknown>): void {
  work.catch(() => undefined);
}

export default async function handler(req: AuthReq, res: AuthRes): Promise<void> {
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
    if (!action || action === 'status') {
      const configured = Boolean(adminScriptConfigured() && process.env.AUTH_SESSION_SECRET);
      res.status(200).json({
        success: true,
        data: {
          configured,
        },
      });
      return;
    }

    const { store, authSecret } = getDeps();
    const mint = (userId: string): string => createAuthSession(userId, authSecret, AUTH_SESSION_TTL_MS);

    if (action === 'register') {
      if (!loginAllowed(`reg:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: 'Too many attempts. Wait a minute and try again.' });
        return;
      }
      let name: string;
      let password: string;
      const email = normalizeAuthEmail(body.email);
      try {
        name = validateDisplayName(body.name);
        password = validatePassword(body.password);
      } catch (e) {
        res.status(400).json({ success: false, error: e instanceof Error ? e.message : 'Invalid input.' });
        return;
      }
      if (!isValidAuthEmail(email)) {
        res.status(400).json({ success: false, error: 'Enter a valid email address.' });
        return;
      }
      const existing = await store.findByEmail(email);
      if (existing) {
        // Uniform response: never reveal whether the email is registered.
        // (A real user who forgot will use sign-in; enumeration is blocked.)
        res.status(409).json({ success: false, error: 'An account with this email already exists. Sign in instead.' });
        return;
      }
      const now = new Date().toISOString();
      const user: AuthUser = {
        userId: newAuthUserId(),
        email,
        name,
        passwordHash: hashPassword(password),
        providers: ['password'],
        createdAt: now,
        updatedAt: now,
      };
      await store.create(user);
      // Registry + audit persist in the background: the response below
      // carries only session + status (verified above), already correct
      // without waiting for these writes.
      bg(touchRegistry({ userId: user.userId, name, email }, true));
      bg(auditLog({ adminId: `user:${user.userId}`, action: 'auth.register', targetUserId: user.userId, newValue: 'password' }));
      console.info('[stockly-auth] password registration');
      res.status(200).json({ success: true, data: { session: mint(user.userId), user: publicUser(user, 'active') } });
      return;
    }

    if (action === 'login') {
      if (!loginAllowed(`login:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: 'Too many attempts. Wait a minute and try again.' });
        return;
      }
      const email = normalizeAuthEmail(body.email);
      const password = String(body.password ?? '');
      const user = isValidAuthEmail(email) ? await store.findByEmail(email) : null;
      const hashOk = user && user.passwordHash ? verifyPassword(password, user.passwordHash) && user.providers.includes('password') : false;
      if (!user || !hashOk) {
        // Uniform message: no account-vs-password oracle.
        res.status(401).json({ success: false, error: 'Incorrect email or password.' });
        return;
      }
      const reg = await readRegistryEntry(user.userId);
      const accountStatus = reg?.accountStatus ?? 'active';
      if (accountStatus !== 'active') {
        res.status(403).json({
          success: false,
          error: accountStatus === 'suspended' ? 'This account is suspended. Contact the owner.' : 'This account is deactivated. Contact the owner.',
        });
        return;
      }
      // lastLoginAt + audit persist in the background: the response below
      // carries only session + status (verified above).
      bg(touchRegistry({ userId: user.userId, name: user.name, email: user.email }, true));
      bg(auditLog({ adminId: `user:${user.userId}`, action: 'auth.login', targetUserId: user.userId, newValue: 'password' }));
      res.status(200).json({ success: true, data: { session: mint(user.userId), user: publicUser(user, accountStatus) } });
      return;
    }

    if (action === 'logout') {
      // Sessions are stateless HMAC: logout discards the token client-side.
      // Logged for audit when the caller still presents a valid session.
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (session) {
        await auditLog({ adminId: `user:${session.userId}`, action: 'auth.logout', targetUserId: session.userId });
      }
      res.status(200).json({ success: true, data: { ok: true } });
      return;
    }

    if (action === 'me') {
      const session = verifyAuthSession(bearerToken(req), authSecret);
      if (!session) {
        res.status(401).json({ success: false, error: 'Sign-in required.' });
        return;
      }
      // Both reads key off the verified session — run them together.
      const [user, reg] = await Promise.all([store.findById(session.userId), readRegistryEntry(session.userId)]);
      if (!user) {
        res.status(401).json({ success: false, error: 'Account not found.' });
        return;
      }
      const accountStatus = reg?.accountStatus ?? 'active';
      res.status(200).json({
        success: true,
        data: {
          user: publicUser(user, accountStatus),
          registeredAt: reg?.registeredAt ?? user.createdAt,
          lastLoginAt: reg?.lastLoginAt ?? null,
        },
      });
      return;
    }

    if (action === 'linkAdopt') {
      // Secondary-device bridge: an APPROVED link (primary-approved) plus
      // proof of the linking token mints an auth session for the claimant
      // device. Never merges by email — only by approved link.
      const linkId = String(body.linkId ?? '').trim();
      const token = String(body.token ?? '').trim();
      const deviceId = String(body.deviceId ?? '').trim();
      if (!linkId || !token || !deviceId) {
        res.status(400).json({ success: false, error: 'Invalid link adoption request.' });
        return;
      }
      const rows = await scriptReadTab('DeviceLinks');
      const row = rows.find((r) => r.linkId === linkId) ?? null;
      if (!row) {
        res.status(404).json({ success: false, error: 'Link not found.' });
        return;
      }
      const status = row.status ?? '';
      const storedHash = row.tokenHash ?? '';
      let claimantDeviceId = '';
      try {
        claimantDeviceId = String((JSON.parse(String(row.claimant ?? '')) as { deviceId?: unknown }).deviceId ?? '');
      } catch {
        claimantDeviceId = '';
      }
      const tokenOk = hashEqual(sha256hex(token), storedHash) || hashEqual(sha256hex(token.replace(/[^A-Z0-9]/gi, '').toUpperCase()), storedHash);
      if (status !== 'approved' || !tokenOk || claimantDeviceId !== deviceId) {
        res.status(403).json({ success: false, error: 'This link cannot be used to sign in.' });
        return;
      }
      const userId = row.userId ?? '';
      // Both reads key off the approved link — run them together.
      const [user, reg] = await Promise.all([
        isValidAuthUserId(userId) ? store.findById(userId) : Promise.resolve(null),
        readRegistryEntry(userId),
      ]);
      if (!user) {
        res.status(404).json({ success: false, error: 'Account not found.' });
        return;
      }
      const accountStatus = reg?.accountStatus ?? 'active';
      if (accountStatus !== 'active') {
        res.status(403).json({ success: false, error: 'This account is not active. Contact the owner.' });
        return;
      }
      bg(auditLog({ adminId: `user:${userId}`, action: 'auth.linkAdopt', targetUserId: userId, newValue: deviceId }));
      res.status(200).json({ success: true, data: { session: mint(userId), user: publicUser(user, accountStatus) } });
      return;
    }

    // NOTE: a previous 'checkDevice' action was removed here — it verified
    // only token format and reported revoked devices as OK, which is worse
    // than nothing. Device trust is decided by devices.ts (requireDeviceSession
    // + live revocation re-check on every call), not by a format probe.

    res.status(400).json({ success: false, error: `Unknown action: ${action}` });
    return;
  } catch (e) {
    const status = typeof (e as { status?: unknown }).status === 'number' ? ((e as { status: number }).status as number) : 500;
    if (status === 501) {
      res.status(501).json({
        success: false,
        error: 'Account service is not configured on the server.',
        steps: [
          'Deploy apps-script/Admin.gs on the private admin spreadsheet (tabs are created automatically).',
          'Set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN and AUTH_SESSION_SECRET in Vercel environment variables and redeploy.',
        ],
      });
      return;
    }
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 429) {
      res.status(status).json({ success: false, error: e instanceof Error ? e.message : 'Request failed.' });
      return;
    }
    console.error('[stockly-auth] request failed');
    res.status(500).json({ success: false, error: 'Sign-in failed. Check server logs and try again.' });
  }
}
