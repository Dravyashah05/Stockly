/* Stockly account authentication (browser side).
 *
 * Talks ONLY to the same-origin trusted route `/api/auth`. Passwords are
 * sent over HTTPS to the server for scrypt verification and are never
 * stored client-side. The auth session token lives in localStorage (it is
 * long-lived by design, 30 days) — it is a bearer for THIS device only
 * and is cleared on logout/expiry. No server secrets ever reach this bundle.
 */

import { LS_KEYS, apiUrl } from './config';

export const AUTH_API_ROUTE = '/api/auth';

export interface AuthAccount {
  userId: string;
  email: string;
  name: string;
  providers: ('password' | 'google')[];
  accountStatus: 'active' | 'suspended' | 'deactivated';
}

export class AuthApiError extends Error {
  status?: number;
  reason?: string;
  constructor(message: string, status?: number, reason?: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.reason = reason;
  }
}

export function getAuthSession(): string | null {
  try {
    return localStorage.getItem(LS_KEYS.authSession);
  } catch {
    return null;
  }
}

export function setAuthSession(token: string | null): void {
  try {
    if (token) localStorage.setItem(LS_KEYS.authSession, token);
    else localStorage.removeItem(LS_KEYS.authSession);
  } catch {
    /* storage unavailable */
  }
}

async function callAuth<T>(action: string, payload: Record<string, unknown> = {}, opts: { auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const token = getAuthSession();
    if (!token) throw new AuthApiError('Sign-in required.', 401);
    headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(AUTH_API_ROUTE), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new AuthApiError('Could not reach the sign-in service. Check your connection and deployment.');
  }
  let json: { success?: boolean; data?: unknown; error?: unknown; reason?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new AuthApiError(`Sign-in service returned HTTP ${res.status}.`, res.status);
  }
  if (!json.success) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `Request failed (HTTP ${res.status}).`;
    throw new AuthApiError(msg, res.status, typeof json.reason === 'string' ? json.reason : undefined);
  }
  return json.data as T;
}

export interface AuthResult {
  session: string;
  user: AuthAccount;
  linked?: boolean;
}

export const authApi = {
  status: () =>
    callAuth<{ configured: boolean }>('status', {}, { auth: false }),
  register: (args: { name: string; email: string; password: string }) =>
    callAuth<AuthResult>('register', args, { auth: false }),
  login: (args: { email: string; password: string }) =>
    callAuth<AuthResult>('login', args, { auth: false }),
  logout: () => callAuth<{ ok: boolean }>('logout').catch(() => ({ ok: true })),
  me: () =>
    callAuth<{ user: AuthAccount; registeredAt: string; lastLoginAt: string | null }>('me'),
  linkAdopt: (args: { linkId: string; token: string; deviceId: string }) =>
    callAuth<AuthResult>('linkAdopt', args, { auth: false }),
};
