/* Private-admin API client (browser side).
 *
 * Talks ONLY to the same-origin server route `/api/admin`. The admin
 * spreadsheet id, Google credentials, setup key, and session secret never
 * leave the server. The session token lives in sessionStorage (cleared when
 * the tab closes) — never in localStorage, never in Google Sheets.
 */

import { ADMIN_API_ROUTE, SS_KEYS, apiUrl } from './config';

export interface AdminSessionInfo {
  adminId: string;
  email: string;
  role: 'owner' | 'admin';
}

export interface RegistryUser {
  userId: string;
  name: string;
  email: string;
  accountStatus: 'active' | 'suspended' | 'deactivated';
  registeredAt: string;
  lastLoginAt: string;
  updatedAt: string;
  providers?: string[];
  sheetStatus?: string | null;
  sheetVerifiedAt?: string | null;
}

export interface UserStats {
  total: number;
  active: number;
  suspended: number;
  deactivated: number;
}

export interface AdminLogEntry {
  logId: string;
  adminId: string;
  action: string;
  targetUserId: string;
  previousValue: string;
  newValue: string;
  timestamp: string;
}

export class AdminApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

export function getAdminToken(): string | null {
  try {
    return sessionStorage.getItem(SS_KEYS.adminToken);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null, email?: string): void {
  try {
    if (token) {
      sessionStorage.setItem(SS_KEYS.adminToken, token);
      if (email) sessionStorage.setItem(SS_KEYS.adminEmail, email);
    } else {
      sessionStorage.removeItem(SS_KEYS.adminToken);
      sessionStorage.removeItem(SS_KEYS.adminEmail);
    }
  } catch {
    /* storage unavailable */
  }
}

export function getAdminEmail(): string | null {
  try {
    return sessionStorage.getItem(SS_KEYS.adminEmail);
  } catch {
    return null;
  }
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `key_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

async function callAdmin<T>(action: string, payload: Record<string, unknown> = {}, opts: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const token = getAdminToken();
    if (!token) throw new AdminApiError('Admin sign-in required.', 401);
    headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(ADMIN_API_ROUTE), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new AdminApiError('Could not reach the admin API. Check your connection and deployment.');
  }
  let json: { success?: boolean; data?: unknown; error?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new AdminApiError(`Admin API returned HTTP ${res.status}.`, res.status);
  }
  if (!json.success) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `Admin request failed (HTTP ${res.status}).`;
    throw new AdminApiError(msg, res.status);
  }
  return json.data as T;
}

export const adminApi = {
  status: () =>
    callAdmin<{ configured: boolean; bootstrapAvailable: boolean | null }>('status', {}, { auth: false }),
  bootstrap: (args: { setupKey: string; email: string; name?: string; idempotencyKey?: string }) =>
    callAdmin<{ token: string; admin: AdminSessionInfo }>('bootstrap', args, { auth: false }),
  login: (args: { email: string; setupKey: string }) =>
    callAdmin<{ token: string; admin: AdminSessionInfo }>('adminLogin', args, { auth: false }),
  me: () => callAdmin<{ admin: AdminSessionInfo & { status: string } }>('adminMe'),
  listUsers: (args: { search?: string; status?: string; limit?: number; offset?: number } = {}) =>
    callAdmin<{ users: RegistryUser[]; total: number; stats: UserStats }>('listUsers', args),
  getUser: (userId: string) => callAdmin<{ user: RegistryUser }>('getUser', { userId }),
  setUserStatus: (args: { userId: string; accountStatus: string; idempotencyKey?: string }) =>
    callAdmin<{ user: RegistryUser; replayed: boolean }>('setUserStatus', {
      idempotencyKey: newIdempotencyKey(),
      ...args,
    }),
  backfill: (users: { userId: string; name: string; email: string; registeredAt?: string; lastLoginAt?: string }[]) =>
    callAdmin<{ created: number; updated: number; skipped: number }>('backfill', { users, idempotencyKey: newIdempotencyKey() }),
  listAdmins: () => callAdmin<{ admins: (AdminSessionInfo & { status: string })[] }>('listAdmins'),
  setAdminRole: (args: { adminId: string; role: string }) =>
    callAdmin<{ admin: AdminSessionInfo }>('setAdminRole', { idempotencyKey: newIdempotencyKey(), ...args }),
  listLogs: (limit = 100) => callAdmin<{ logs: AdminLogEntry[] }>('listLogs', { limit }),
  getSettings: () => callAdmin<{ settings: { key: string; value: string; updatedAt: string }[] }>('getSettings'),
  setSetting: (key: string, value: string) =>
    callAdmin<{ key: string; value: string }>('setSetting', { key, value, idempotencyKey: newIdempotencyKey() }),
};
