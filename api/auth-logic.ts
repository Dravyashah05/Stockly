/* Stockly account-auth shared logic (server-side only).
 *
 * Email/password identity verified HERE, never in the browser. The
 * browser bundle MUST NOT import this file: it hashes passwords and takes
 * server secrets as arguments.
 *
 * Identity model:
 *  - One Stockly account (stable userId) per human, signed in with
 *    email + password.
 *  - Passwords: scrypt (N=16384, r=8, p=1, 64-byte key, 32-byte salt),
 *    an established memory-hard KDF (RFC 7914). Only hashes are stored;
 *    plaintext passwords never reach any spreadsheet.
 *  - Auth sessions: stateless HMAC tokens (AUTH_SESSION_SECRET), 30-day
 *    TTL, sliding re-issue by the client via `me`.
 */

import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const AUTH_TABS = {
  UserAuth: ['userId', 'email', 'name', 'passwordHash', 'providers', 'createdAt', 'updatedAt'],
} as const;

export type AuthProvider = 'password' | 'google';

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  passwordHash: string;
  providers: AuthProvider[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  userId: string;
  iat: number;
  exp: number;
}

export const AUTH_SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

/* Account-field rules live in @stockly/shared-validation — one rule set
 * shared with both frontends. The historical export names below are kept
 * so every caller and test observes the exact same implementation. */
import {
  isValidEmail,
  isValidUserId,
  normalizeEmail,
  validateDisplayName,
  validatePassword,
} from '@stockly/shared-validation';

// Local aliases keep the historical names this module's logic calls.
const isValidAuthEmail = isValidEmail;
const isValidAuthUserId = isValidUserId;
const normalizeAuthEmail = normalizeEmail;

export {
  isValidAuthEmail,
  isValidAuthUserId,
  normalizeAuthEmail,
  validateDisplayName,
  validatePassword,
};

/* ------------------------- password hashing (scrypt) ------------------------- */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LEN);
  const key = scryptSync(password, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$v1$n${SCRYPT_N}$r${SCRYPT_R}$p${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 7 || parts[0] !== 'scrypt' || parts[1] !== 'v1') return false;
    const n = Number(parts[2].slice(1));
    const r = Number(parts[3].slice(1));
    const p = Number(parts[4].slice(1));
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
    const salt = Buffer.from(parts[5], 'base64');
    const expected = Buffer.from(parts[6], 'base64');
    if (salt.length !== SALT_LEN || expected.length !== KEY_LEN) return false;
    const key = scryptSync(String(password), salt, KEY_LEN, { N: n, r, p });
    if (key.length !== expected.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

/* ------------------------- provider linking ------------------------- */

/** Parse the stored providers column (comma-separated, tolerant).
 *  Only 'password' is issued; other values are preserved read-only for
 *  backwards compatibility with older rows. */
export function parseProviders(raw: unknown): AuthProvider[] {
  const out: AuthProvider[] = [];
  for (const part of String(raw ?? '').split(',')) {
    const p = part.trim().toLowerCase();
    if ((p === 'password' || p === 'google') && !out.includes(p as AuthProvider)) {
      out.push(p as AuthProvider);
    }
  }
  return out;
}

export function serializeProviders(providers: AuthProvider[]): string {
  return [...new Set(providers)].filter((p) => p === 'password' || p === 'google').join(',');
}

/* ------------------------- auth sessions (HMAC) ------------------------- */

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function newAuthUserId(): string {
  return `usr_${randomBytes(12).toString('hex')}`;
}

export function createAuthSession(userId: string, secret: string, ttlMs = AUTH_SESSION_TTL_MS): string {
  if (!secret) throw new Error('Auth session secret is not configured.');
  if (!isValidAuthUserId(userId)) throw new Error('Invalid userId.');
  const now = Date.now();
  const payload: AuthSession = { userId, iat: now, exp: now + ttlMs };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAuthSession(token: unknown, secret: string): AuthSession | null {
  try {
    if (typeof token !== 'string' || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac('sha256', secret).update(body).digest();
    const got = Buffer.from(sig, 'base64url');
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode(body)) as Partial<AuthSession>;
    if (!payload || !isValidAuthUserId(payload.userId) || typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload as AuthSession;
  } catch {
    return null;
  }
}

/* ------------------------- sheet URL helpers ------------------------- */

/** Accept a Google Sheets URL or an Apps Script /exec URL. Returns the
 *  kind plus the extracted id (spreadsheet id or exec id). */
export function parseSheetInput(raw: unknown): { kind: 'sheets' | 'exec'; id: string } | null {
  try {
    const text = String(raw ?? '').trim();
    if (!text) return null;
    const u = new URL(text);
    if (u.protocol !== 'https:') return null;
    if (u.hostname === 'docs.google.com' && u.pathname.startsWith('/spreadsheets/d/')) {
      const id = u.pathname.split('/')[3] ?? '';
      if (/^[A-Za-z0-9_-]{20,}$/.test(id)) return { kind: 'sheets', id };
      return null;
    }
    if (
      u.hostname === 'script.google.com' &&
      !u.port &&
      /^\/macros\/s\/[^/]+\/exec\/?$/.test(u.pathname) &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash
    ) {
      return { kind: 'exec', id: u.pathname.split('/')[3] ?? '' };
    }
    return null;
  } catch {
    return null;
  }
}

export function fingerprint(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

/* ------------------------- in-memory store (tests) ------------------------- */

export interface AuthStore {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(userId: string): Promise<AuthUser | null>;
  create(user: AuthUser): Promise<void>;
  update(user: AuthUser): Promise<void>;
  count(): Promise<number>;
}

export function createMemoryAuthStore(seed?: AuthUser[]): AuthStore {
  const byId = new Map<string, AuthUser>();
  for (const u of seed ?? []) byId.set(u.userId, { ...u, providers: [...u.providers] });
  return {
    async findByEmail(email: string) {
      const want = normalizeAuthEmail(email);
      for (const u of byId.values()) {
        if (normalizeAuthEmail(u.email) === want) return { ...u, providers: [...u.providers] };
      }
      return null;
    },
    async findById(userId: string) {
      const u = byId.get(userId);
      return u ? { ...u, providers: [...u.providers] } : null;
    },
    async create(user: AuthUser) {
      if (byId.has(user.userId)) throw new Error('User already exists.');
      byId.set(user.userId, { ...user, providers: [...user.providers] });
    },
    async update(user: AuthUser) {
      if (!byId.has(user.userId)) throw new Error('User not found.');
      byId.set(user.userId, { ...user, providers: [...user.providers] });
    },
    async count() {
      return byId.size;
    },
  };
}
