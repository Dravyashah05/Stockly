/* Stockly device-linking shared logic (server-side only).
 *
 * WhatsApp-Web-style linking for Stockly-to-Stockly devices (no WhatsApp
 * integration of any kind). The browser bundle MUST NOT import this file:
 * it defines token/hash handling and takes secrets as arguments.
 *
 * Trust model:
 *  - Linking tokens are random + unguessable, short-lived, single-use.
 *    Only SHA-256 hashes are stored (DeviceLinks tab); plaintext tokens
 *    exist only in the two API responses (create → primary screen,
 *    approved poll → secondary device) and are never logged.
 *  - A link completes ONLY after approval from an already-authenticated
 *    device session of the same account. Email claim alone can never link.
 *  - Device sessions are stateless HMAC tokens (like admin sessions).
 *    Revocation is enforced server-side on every validation: revoked
 *    devices fail validation even with a once-valid token.
 *  - Brute force: persistent per-link attempt counter in the sheet
 *    (lockout after MAX_LINK_ATTEMPTS) + in-memory rate limiting per
 *    IP/action in the route handler (best-effort on serverless).
 *  - Sheets hold SUMMARIES + hashes only: no live session tokens, no
 *    linking secrets, no passwords.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const DEVICE_TABS = {
  DeviceLinks: [
    'linkId',
    'userId',
    'tokenHash',
    'method',
    'status',
    'expiresAt',
    'attempts',
    'claimant',
    'createdAt',
    'updatedAt',
  ],
  Devices: [
    'deviceId',
    'userId',
    'name',
    'platform',
    'appInfo',
    'status',
    'linkedAt',
    'lastActiveAt',
  ],
} as const;

export type LinkMethod = 'qr' | 'code';
export type LinkStatus = 'pending' | 'claimed' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type DeviceStatus = 'active' | 'revoked';

export interface DeviceLink {
  linkId: string;
  userId: string;
  tokenHash: string;
  method: LinkMethod;
  status: LinkStatus;
  expiresAt: string;
  attempts: number;
  claimant: string;
  createdAt: string;
  updatedAt: string;
}

export interface LinkedDevice {
  deviceId: string;
  userId: string;
  name: string;
  platform: string;
  appInfo: string;
  status: DeviceStatus;
  linkedAt: string;
  lastActiveAt: string;
}

export interface DeviceSession {
  userId: string;
  deviceId: string;
  iat: number;
  exp: number;
}

/** Short-lived: QR carries the full token (fast to scan); codes are typed. */
export const QR_LINK_TTL_MS = 5 * 60 * 1000;
export const CODE_LINK_TTL_MS = 10 * 60 * 1000;
export const MAX_LINK_ATTEMPTS = 5;
export const DEVICE_SESSION_TTL_MS = 90 * 24 * 3600 * 1000;

const LINK_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const USER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
/** Human-typed linking codes: no 0/O/1/I/L to avoid misreads. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function isValidLinkId(id: unknown): boolean {
  return typeof id === 'string' && LINK_ID_RE.test(id.trim());
}

export function isValidDeviceId(id: unknown): boolean {
  return typeof id === 'string' && DEVICE_ID_RE.test(id.trim());
}

export function isValidUserIdRef(id: unknown): boolean {
  return typeof id === 'string' && USER_ID_RE.test(id.trim());
}

export function isValidLinkMethod(m: unknown): m is LinkMethod {
  return m === 'qr' || m === 'code';
}

export function isValidLinkStatus(s: unknown): s is LinkStatus {
  return (
    s === 'pending' ||
    s === 'claimed' ||
    s === 'approved' ||
    s === 'rejected' ||
    s === 'expired' ||
    s === 'cancelled'
  );
}

/** 256-bit random linking token (hex). Unguessable; single-use. */
export function newLinkToken(): string {
  return randomBytes(32).toString('hex');
}

/** Short human-typed code, e.g. "KQ7D-2MZX" (8 symbols, ~42 bits). */
export function newLinkCode(): string {
  const bytes = randomBytes(8);
  let code = '';
  for (let i = 0; i < 8; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeLinkCode(code: unknown): string {
  return String(code ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function sha256hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hashEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(String(aHex).trim(), 'hex');
    const b = Buffer.from(String(bHex).trim(), 'hex');
    if (a.length !== b.length || a.length === 0) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function newDeviceId(): string {
  return `dev_${randomBytes(12).toString('hex')}`;
}

export function newLinkId(): string {
  return `lnk_${randomBytes(12).toString('hex')}`;
}

/** QR payload scanned by the second device. Versioned envelope carrying
 *  the link id + token (QR links use a full-strength token; typed-code
 *  links use the short code itself as the token — both verify against the
 *  stored tokenHash, and both are attempt-limited). */
export interface QrLinkPayload {
  v: 1;
  app: 'stockly';
  linkId: string;
  token: string;
}

export function buildQrPayload(linkId: string, token: string): string {
  const payload: QrLinkPayload = { v: 1, app: 'stockly', linkId, token };
  return JSON.stringify(payload);
}

export function parseQrPayload(raw: unknown): QrLinkPayload | null {
  try {
    if (typeof raw !== 'string') return null;
    const text = raw.trim();
    if (!text || text.length > 512) return null;
    const p = JSON.parse(text) as Partial<QrLinkPayload>;
    if (
      p.v !== 1 ||
      p.app !== 'stockly' ||
      !isValidLinkId(p.linkId) ||
      typeof p.token !== 'string' ||
      !/^[0-9a-f]{32,128}$/i.test(p.token)
    ) {
      return null;
    }
    return p as QrLinkPayload;
  } catch {
    return null;
  }
}

/* ------------------------- device sessions (HMAC) ------------------------- */

function b64urlEncode(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function b64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function createDeviceSession(
  userId: string,
  deviceId: string,
  secret: string,
  ttlMs = DEVICE_SESSION_TTL_MS,
): string {
  if (!secret) throw new Error('Device session secret is not configured.');
  if (!isValidUserIdRef(userId) || !isValidDeviceId(deviceId)) throw new Error('Invalid session subject.');
  const now = Date.now();
  const payload: DeviceSession = { userId, deviceId, iat: now, exp: now + ttlMs };
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyDeviceSessionFormat(token: unknown, secret: string): DeviceSession | null {
  try {
    if (typeof token !== 'string' || !secret) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expect = createHmac('sha256', secret).update(body).digest();
    const got = Buffer.from(sig, 'base64url');
    if (got.length !== expect.length || !timingSafeEqual(got, expect)) return null;
    const payload = JSON.parse(b64urlDecode(body)) as Partial<DeviceSession>;
    if (
      !payload ||
      !isValidUserIdRef(payload.userId) ||
      !isValidDeviceId(payload.deviceId) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    if (Date.now() > payload.exp) return null;
    return payload as DeviceSession;
  } catch {
    return null;
  }
}

/* ------------------------- link lifecycle (pure) ------------------------- */

export function linkPublicState(link: DeviceLink, now = Date.now()): LinkStatus {
  if ((link.status === 'pending' || link.status === 'claimed') && Date.parse(link.expiresAt) <= now) {
    return 'expired';
  }
  return link.status;
}

export function createLinkRecord(args: {
  userId: string;
  method: LinkMethod;
  tokenHash: string;
  ttlMs: number;
  nowIso?: string;
}): DeviceLink {
  if (!isValidUserIdRef(args.userId)) throw new Error('Invalid userId.');
  if (!isValidLinkMethod(args.method)) throw new Error('Invalid method.');
  const now = args.nowIso ?? new Date().toISOString();
  return {
    linkId: newLinkId(),
    userId: args.userId,
    tokenHash: args.tokenHash,
    method: args.method,
    status: 'pending',
    expiresAt: new Date(Date.parse(now) + args.ttlMs).toISOString(),
    attempts: 0,
    claimant: '',
    createdAt: now,
    updatedAt: now,
  };
}

export type ClaimOutcome =
  | { ok: true; link: DeviceLink }
  | { ok: false; reason: 'not-found' | 'expired' | 'locked' | 'already-used' | 'invalid-token'; link: DeviceLink | null };

/** Atomic single-claim transition: pending → claimed. Every failure mode
 *  is explicit so the route can rate-limit, lock out, and report states. */
export function tryClaimLink(link: DeviceLink | null, token: string, now = Date.now()): ClaimOutcome {
  if (!link) return { ok: false, reason: 'not-found', link: null };
  if (link.status !== 'pending') return { ok: false, reason: 'already-used', link };
  if (Date.parse(link.expiresAt) <= now) return { ok: false, reason: 'expired', link };
  if (link.attempts >= MAX_LINK_ATTEMPTS) return { ok: false, reason: 'locked', link };
  if (!hashEqual(sha256hex(token), link.tokenHash)) {
    return { ok: false, reason: 'invalid-token', link };
  }
  return {
    ok: true,
    link: { ...link, status: 'claimed', updatedAt: new Date(now).toISOString() },
  };
}

export function sanitizeDeviceMeta(input: {
  name?: unknown;
  platform?: unknown;
  appInfo?: unknown;
}): { name: string; platform: string; appInfo: string } {
  const clean = (v: unknown, fallback: string, max: number): string => {
    const s = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
    return s || fallback;
  };
  return {
    name: clean(input.name, 'Linked device', 60),
    platform: clean(input.platform, 'unknown', 40),
    appInfo: clean(input.appInfo, '', 120),
  };
}

/* ------------------------- rate limiting ------------------------- */

/** Sliding-window limiter (per key). Best-effort on serverless: instances do
 *  not share counters, so this complements (never replaces) the persistent
 *  per-link attempt counter + lockout in the sheet. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private readonly maxHits: number;
  private readonly windowMs: number;
  constructor(maxHits: number, windowMs: number) {
    this.maxHits = maxHits;
    this.windowMs = windowMs;
  }
  take(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this.maxHits) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    if (this.hits.size > 5000) {
      const oldest = [...this.hits.keys()][0];
      this.hits.delete(oldest);
    }
    return true;
  }
}

/* ------------------------- in-memory store (tests) ------------------------- */

export interface DeviceStore {
  createLink(link: DeviceLink): Promise<void>;
  getLink(linkId: string): Promise<DeviceLink | null>;
  findLinkByCodeHash(codeHash: string): Promise<DeviceLink | null>;
  updateLink(link: DeviceLink): Promise<void>;
  listLinksForUser(userId: string): Promise<DeviceLink[]>;
  upsertDevice(d: LinkedDevice): Promise<void>;
  getDevice(deviceId: string): Promise<LinkedDevice | null>;
  listDevicesForUser(userId: string): Promise<LinkedDevice[]>;
}

export function createMemoryDeviceStore(seed?: {
  links?: DeviceLink[];
  devices?: LinkedDevice[];
}): DeviceStore {
  const links = new Map<string, DeviceLink>();
  const devices = new Map<string, LinkedDevice>();
  for (const l of seed?.links ?? []) links.set(l.linkId, { ...l });
  for (const d of seed?.devices ?? []) devices.set(d.deviceId, { ...d });
  return {
    async createLink(link) {
      if (links.has(link.linkId)) throw new Error('Link already exists.');
      links.set(link.linkId, { ...link });
    },
    async getLink(linkId) {
      return links.get(linkId) ?? null;
    },
    async findLinkByCodeHash(codeHash) {
      for (const l of links.values()) {
        if (l.tokenHash === codeHash) return { ...l };
      }
      return null;
    },
    async updateLink(link) {
      if (!links.has(link.linkId)) throw new Error('Link not found.');
      links.set(link.linkId, { ...link });
    },
    async listLinksForUser(userId) {
      return [...links.values()].filter((l) => l.userId === userId).map((l) => ({ ...l }));
    },
    async upsertDevice(d) {
      devices.set(d.deviceId, { ...d });
    },
    async getDevice(deviceId) {
      return devices.get(deviceId) ?? null;
    },
    async listDevicesForUser(userId) {
      return [...devices.values()].filter((d) => d.userId === userId).map((d) => ({ ...d }));
    },
  };
}
