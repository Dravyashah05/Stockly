/* Stockly private-admin shared logic (server-side only).
 *
 * Pure, dependency-light helpers used by the Vercel admin API route
 * (api/admin.ts) and by the test suite. The browser bundle MUST NOT import
 * this file: it describes the admin spreadsheet schema and session scheme,
 * and takes secrets as arguments (never bundled values).
 *
 * Authoritative split (must stay consistent everywhere):
 *  - User spreadsheet `Users` tab  → authoritative for PROFILE
 *    (userId, name, email, registeredAt, lastLoginAt).
 *  - Admin spreadsheet             → authoritative for ACCOUNT STATUS
 *    (active/suspended/deactivated), ROLES, and APP SETTINGS.
 * Sync (user → admin) upserts profile fields by stable userId and NEVER
 * overwrites accountStatus except when creating a row (default active).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_TABS = {
  AdminUsers: ['adminId', 'email', 'role', 'status', 'createdAt', 'updatedAt'],
  UserRegistry: ['userId', 'name', 'email', 'accountStatus', 'registeredAt', 'lastLoginAt', 'updatedAt'],
  AdminLogs: ['logId', 'adminId', 'action', 'targetUserId', 'previousValue', 'newValue', 'timestamp'],
  AppSettings: ['key', 'value', 'updatedAt'],
} as const;

export type AdminRole = 'owner' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deactivated';
export type AdminStatus = 'active' | 'suspended';

export interface AdminUser {
  adminId: string;
  email: string;
  role: AdminRole;
  status: AdminStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RegistryUser {
  userId: string;
  name: string;
  email: string;
  accountStatus: AccountStatus;
  registeredAt: string;
  lastLoginAt: string;
  updatedAt: string;
}

export interface AdminLog {
  logId: string;
  adminId: string;
  action: string;
  targetUserId: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
}

export interface AdminSession {
  adminId: string;
  email: string;
  role: AdminRole;
  iat: number;
  exp: number;
}

const ADMIN_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const SETTING_KEY_RE = /^[A-Za-z0-9_.-]{1,64}$/;

/* Account-field rules live in @stockly/shared-validation — one rule set
 * shared with both frontends and the auth handler. Historical names are
 * re-exported so every caller and test keeps working unchanged. */
import { isValidEmail, isValidUserId, normalizeEmail } from '@stockly/shared-validation';

export { isValidEmail, isValidUserId, normalizeEmail };

export function isValidAdminId(id: unknown): boolean {
  return typeof id === 'string' && ADMIN_ID_RE.test(id.trim());
}

export function isValidRole(role: unknown): role is AdminRole {
  return role === 'owner' || role === 'admin';
}

export function isValidAccountStatus(s: unknown): s is AccountStatus {
  return s === 'active' || s === 'suspended' || s === 'deactivated';
}

export function isValidAdminStatus(s: unknown): s is AdminStatus {
  return s === 'active' || s === 'suspended';
}

export function isValidSettingKey(key: unknown): boolean {
  return typeof key === 'string' && SETTING_KEY_RE.test(key.trim());
}

export function validateRegistryInput(input: {
  userId?: unknown;
  name?: unknown;
  email?: unknown;
  registeredAt?: unknown;
  lastLoginAt?: unknown;
}): { userId: string; name: string; email: string; registeredAt: string; lastLoginAt: string } {
  const userId = String(input.userId ?? '').trim();
  if (!isValidUserId(userId)) throw new Error('Invalid userId.');
  const name = String(input.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Name is required.');
  if (name.length > 80) throw new Error('Name is too long (max 80 characters).');
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new Error('Enter a valid email address.');
  const iso = (v: unknown, field: string): string => {
    const s = String(v ?? '').trim();
    if (!s) return '';
    const t = Date.parse(s);
    if (Number.isNaN(t)) throw new Error(`Invalid ${field}.`);
    return new Date(t).toISOString();
  };
  return {
    userId,
    name,
    email,
    registeredAt: iso(input.registeredAt, 'registeredAt'),
    lastLoginAt: iso(input.lastLoginAt, 'lastLoginAt'),
  };
}

/** Authoritative-split merge: profile fields from the user DB win;
 *  accountStatus is preserved on existing rows (admin is authoritative). */
export function mergeRegistryUser(
  existing: RegistryUser | null,
  incoming: { userId: string; name: string; email: string; registeredAt: string; lastLoginAt: string },
  nowIso: string,
): { record: RegistryUser; created: boolean } {
  if (!existing) {
    return {
      created: true,
      record: {
        userId: incoming.userId,
        name: incoming.name,
        email: incoming.email,
        accountStatus: 'active',
        registeredAt: incoming.registeredAt || nowIso,
        lastLoginAt: incoming.lastLoginAt || nowIso,
        updatedAt: nowIso,
      },
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
      updatedAt: nowIso,
    },
  };
}

export function computeUserStats(users: RegistryUser[]): {
  total: number;
  active: number;
  suspended: number;
  deactivated: number;
} {
  let active = 0;
  let suspended = 0;
  let deactivated = 0;
  for (const u of users) {
    if (u.accountStatus === 'suspended') suspended += 1;
    else if (u.accountStatus === 'deactivated') deactivated += 1;
    else active += 1;
  }
  return { total: users.length, active, suspended, deactivated };
}

export function filterRegistry(
  users: RegistryUser[],
  opts: { search?: string; status?: string; limit?: number; offset?: number },
): { users: RegistryUser[]; total: number } {
  const q = String(opts.search ?? '').trim().toLowerCase();
  const status = String(opts.status ?? '').trim();
  const filtered = users.filter((u) => {
    if (status && status !== 'all' && u.accountStatus !== status) return false;
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.userId.toLowerCase().includes(q)
    );
  });
  const total = filtered.length;
  const offset = Math.max(Number(opts.offset) || 0, 0);
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 500);
  return { users: filtered.slice(offset, offset + limit), total };
}

/* ------------------------- session tokens (HMAC) ------------------------- */

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function createSessionToken(
  session: { adminId: string; email: string; role: AdminRole },
  secret: string,
  ttlMs = 12 * 3600 * 1000,
): string {
  if (!secret) throw new Error('Session secret is not configured.');
  const now = Date.now();
  const payload: AdminSession = {
    adminId: session.adminId,
    email: normalizeEmail(session.email),
    role: session.role,
    iat: now,
    exp: now + ttlMs,
  };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: unknown, secret: string): AdminSession | null {
  try {
    if (typeof token !== 'string' || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac('sha256', secret).update(body).digest();
    const got = Buffer.from(sig, 'base64url');
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode(body)) as Partial<AdminSession>;
    if (
      !payload ||
      !isValidAdminId(payload.adminId) ||
      !isValidEmail(payload.email) ||
      !isValidRole(payload.role) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload as AdminSession;
  } catch {
    return null;
  }
}

/** Timing-safe string comparison for setup keys (returns false on length mismatch). */
export function secretsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length || ab.length === 0) return false;
  return timingSafeEqual(ab, bb);
}

/* ------------------------- status envelopes (HMAC) ------------------------- */

export interface StatusEnvelope {
  userId: string;
  accountStatus: AccountStatus;
  issuedAt: string;
  signature: string;
}

export function signStatusEnvelope(
  userId: string,
  accountStatus: AccountStatus,
  mirrorSecret: string,
  issuedAt = new Date().toISOString(),
): StatusEnvelope {
  if (!mirrorSecret) throw new Error('Mirror secret is not configured.');
  if (!isValidUserId(userId)) throw new Error('Invalid userId.');
  if (!isValidAccountStatus(accountStatus)) throw new Error('Invalid account status.');
  const msg = `${userId}|${accountStatus}|${issuedAt}`;
  const signature = createHmac('sha256', mirrorSecret).update(msg).digest('hex');
  return { userId, accountStatus, issuedAt, signature };
}

export function verifyStatusEnvelope(env: StatusEnvelope, mirrorSecret: string): boolean {
  try {
    if (!mirrorSecret) return false;
    const msg = `${env.userId}|${env.accountStatus}|${env.issuedAt}`;
    const expect = createHmac('sha256', mirrorSecret).update(msg).digest();
    const got = Buffer.from(String(env.signature || '').trim(), 'hex');
    if (got.length !== expect.length) return false;
    return timingSafeEqual(got, expect);
  } catch {
    return false;
  }
}

/* ------------------------- audit + ids ------------------------- */

export function sanitizeLogIdPart(part: string): string {
  return String(part || '').trim().replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
}

/** Deterministic log id from a client idempotency key → sheet-backed replay
 *  protection using the fixed AdminLogs schema (no extra column needed). */
export function logIdFor(idempotencyKey: unknown, fallbackId: string): string {
  const clean = sanitizeLogIdPart(String(idempotencyKey ?? ''));
  if (clean.length >= 8) return `log_${clean}`;
  return fallbackId;
}

export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

export function buildLogEntry(args: {
  logId: string;
  adminId: string;
  action: string;
  targetUserId?: string;
  previousValue?: string;
  newValue?: string;
  timestamp?: string;
}): AdminLog {
  return {
    logId: args.logId,
    adminId: String(args.adminId).slice(0, 128),
    action: String(args.action).slice(0, 64),
    targetUserId: String(args.targetUserId ?? '').slice(0, 64),
    previousValue: String(args.previousValue ?? '').slice(0, 500),
    newValue: String(args.newValue ?? '').slice(0, 500),
    timestamp: args.timestamp ?? new Date().toISOString(),
  };
}

/* ------------------------- in-memory store (tests/dev) ------------------------- */

export interface AdminStore {
  listAdmins(): Promise<AdminUser[]>;
  createAdmin(a: AdminUser): Promise<void>;
  updateAdmin(adminId: string, patch: Partial<AdminUser>): Promise<AdminUser | null>;
  listRegistry(): Promise<RegistryUser[]>;
  getRegistry(userId: string): Promise<RegistryUser | null>;
  upsertRegistry(u: RegistryUser): Promise<{ record: RegistryUser; created: boolean }>;
  findLog(logId: string): Promise<AdminLog | null>;
  appendLog(entry: AdminLog): Promise<void>;
  listLogs(limit: number): Promise<AdminLog[]>;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  listSettings(): Promise<{ key: string; value: string; updatedAt: string }[]>;
  getAuthProviders(userId: string): Promise<string[]>;
  getSheetInfo(userId: string): Promise<{ status: string; verifiedAt: string; spreadsheetId: string } | null>;
}

export function createMemoryStore(seed?: {
  admins?: AdminUser[];
  registry?: RegistryUser[];
  logs?: AdminLog[];
  settings?: Record<string, string>;
  providers?: Record<string, string[]>;
  sheets?: Record<string, { status: string; verifiedAt: string; spreadsheetId: string }>;
}): AdminStore {
  const admins = new Map<string, AdminUser>();
  const registry = new Map<string, RegistryUser>();
  const logs = new Map<string, AdminLog>();
  const settings = new Map<string, { value: string; updatedAt: string }>();
  for (const a of seed?.admins ?? []) admins.set(a.adminId, { ...a });
  for (const u of seed?.registry ?? []) registry.set(u.userId, { ...u });
  for (const l of seed?.logs ?? []) logs.set(l.logId, { ...l });
  for (const [k, v] of Object.entries(seed?.settings ?? {})) {
    settings.set(k, { value: v, updatedAt: new Date().toISOString() });
  }
  return {
    async listAdmins() {
      return [...admins.values()];
    },
    async createAdmin(a) {
      if (admins.has(a.adminId)) throw new Error('Admin already exists.');
      admins.set(a.adminId, { ...a });
    },
    async updateAdmin(adminId, patch) {
      const cur = admins.get(adminId);
      if (!cur) return null;
      const next = { ...cur, ...patch, adminId: cur.adminId, updatedAt: new Date().toISOString() };
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
      if (logs.has(entry.logId)) throw new Error('Duplicate log entry.');
      logs.set(entry.logId, { ...entry });
    },
    async listLogs(limit) {
      const all = [...logs.values()].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      return all.slice(0, Math.min(Math.max(limit || 100, 1), 500));
    },
    async getSetting(key) {
      return settings.get(key)?.value ?? null;
    },
    async setSetting(key, value) {
      settings.set(key, { value, updatedAt: new Date().toISOString() });
    },
    async listSettings() {
      return [...settings.entries()].map(([key, v]) => ({ key, value: v.value, updatedAt: v.updatedAt }));
    },
    async getAuthProviders(userId) {
      return [...(seed?.providers?.[userId] ?? [])];
    },
    async getSheetInfo(userId) {
      return seed?.sheets?.[userId] ?? null;
    },
  };
}
