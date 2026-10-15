import { ensureSchemaCached } from './schema.ts';
import { adminScriptConfigured, scriptAppendRow, scriptReadTab, scriptUpdateRowById } from './apps-script-client.ts';
/* Stockly device-linking API (Vercel serverless, server-side only).
 *
 * WhatsApp-Web-style Stockly-to-Stockly linking (no WhatsApp integration).
 * The ONLY issuer of linking tokens and device sessions. Storage goes
 * through the bound Apps Script project (apps-script/Admin.gs); the
 * browser never sees the script URL, the token, or any server secret.
 *
 * Device summaries + token HASHES live in two extra tabs of the private
 * admin spreadsheet (same deployment as api/admin.ts):
 *   DeviceLinks linkId,userId,tokenHash,method,status,expiresAt,attempts,claimant,createdAt,updatedAt
 *   Devices     deviceId,userId,name,platform,appInfo,status,linkedAt,lastActiveAt
 * No live session tokens, linking secrets, or passwords are ever stored.
 *
 * Required Vercel env vars (server-side only, never VITE_*):
 *   ADMIN_SCRIPT_URL + ADMIN_SCRIPT_TOKEN (bound Admin.gs deployment).
 *   DEVICE_SESSION_SECRET   HMAC secret for device session tokens.
 * ADMIN_SESSION_SECRET / ADMIN_SETUP_KEY are read for the owner-only
 * device-management actions (dual auth: device session OR admin session).
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { ADMIN_TABS, buildLogEntry, isValidEmail, newId } from './admin-logic.ts';
import {
  CODE_LINK_TTL_MS,
  DEVICE_SESSION_TTL_MS,
  DEVICE_TABS,
  QR_LINK_TTL_MS,
  RateLimiter,
  createDeviceSession,
  createLinkRecord,
  createMemoryDeviceStore,
  hashEqual,
  isValidDeviceId,
  isValidLinkId,
  isValidLinkMethod,
  isValidUserIdRef,
  linkPublicState,
  newLinkCode,
  newLinkId,
  newLinkToken,
  normalizeLinkCode,
  sanitizeDeviceMeta,
  sha256hex,
  tryClaimLink,
  verifyDeviceSessionFormat,
  type DeviceLink,
  type DeviceStore,
  type DeviceSession,
  type LinkMethod,
  type LinkedDevice,
} from './device-logic.ts';
import { verifyAuthSession } from './auth-logic.ts';

type QueryValue = string | string[] | undefined;

interface DevicesReq {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  query?: Record<string, QueryValue>;
  body?: unknown;
}

interface DevicesRes {
  status: (code: number) => DevicesRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

function readBody(req: DevicesReq): Record<string, unknown> {
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

function header(req: DevicesReq, name: string): string {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').trim();
}

function bearerToken(req: DevicesReq): string | null {
  const value = header(req, 'authorization');
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value);
  return match ? match[1].trim() : null;
}

function clientIp(req: DevicesReq): string {
  const fwd = header(req, 'x-forwarded-for');
  return (fwd.split(',')[0] ?? '').trim() || 'unknown';
}

/* ------------------------- Admin script store ------------------------- */
/* Storage goes through the bound Apps Script project (apps-script/Admin.gs)
 * via api/apps-script-client.ts — no service-account keys anywhere. */

function httpError(message: string, status: number): Error & { status?: number } {
  return Object.assign(new Error(message), { status });
}

function toLink(r: Record<string, string>): DeviceLink {
  return {
    linkId: r.linkId,
    userId: r.userId,
    tokenHash: r.tokenHash,
    method: r.method === 'code' ? 'code' : 'qr',
    status: (
      ['pending', 'claimed', 'approved', 'rejected', 'expired', 'cancelled'] as const
    ).includes(r.status as DeviceLink['status'])
      ? (r.status as DeviceLink['status'])
      : 'pending',
    expiresAt: r.expiresAt,
    attempts: Number(r.attempts) || 0,
    claimant: r.claimant ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toDevice(r: Record<string, string>): LinkedDevice {
  return {
    deviceId: r.deviceId,
    userId: r.userId,
    name: r.name,
    platform: r.platform,
    appInfo: r.appInfo ?? '',
    status: r.status === 'revoked' ? 'revoked' : 'active',
    linkedAt: r.linkedAt,
    lastActiveAt: r.lastActiveAt,
  };
}

const linkRow = (l: DeviceLink): (string | number)[] =>
  DEVICE_TABS.DeviceLinks.map((h) => (l as unknown as Record<string, string | number>)[h] ?? '');
const deviceRow = (d: LinkedDevice): (string | number)[] =>
  DEVICE_TABS.Devices.map((h) => (d as unknown as Record<string, string>)[h] ?? '');

function createScriptDeviceStore(): DeviceStore {
  return {
    async createLink(link) {
      await scriptAppendRow('DeviceLinks', linkRow(link));
    },
    async getLink(linkId) {
      const rows = await scriptReadTab('DeviceLinks');
      const hit = rows.map(toLink).find((l) => l.linkId === linkId);
      return hit ?? null;
    },
    async findLinkByCodeHash(codeHash) {
      const rows = await scriptReadTab('DeviceLinks');
      const hit = rows.map(toLink).find((l) => hashEqual(l.tokenHash, codeHash));
      return hit ?? null;
    },
    async updateLink(link) {
      await scriptUpdateRowById('DeviceLinks', link.linkId, linkRow(link));
    },
    async listLinksForUser(userId) {
      const rows = await scriptReadTab('DeviceLinks');
      return rows.map(toLink).filter((l) => l.userId === userId);
    },
    async upsertDevice(d) {
      const rows = await scriptReadTab('Devices');
      if (rows.some((r) => r.deviceId === d.deviceId)) {
        await scriptUpdateRowById('Devices', d.deviceId, deviceRow(d));
        return;
      }
      await scriptAppendRow('Devices', deviceRow(d));
    },
    async getDevice(deviceId) {
      const rows = await scriptReadTab('Devices');
      const hit = rows.map(toDevice).find((d) => d.deviceId === deviceId);
      return hit ?? null;
    },
    async listDevicesForUser(userId) {
      const rows = await scriptReadTab('Devices');
      return rows.map(toDevice).filter((d) => d.userId === userId);
    },
  };
}

async function readRegistryUser(
  userId: string,
): Promise<{ userId: string; name: string; email: string; accountStatus: string } | null> {
  const rows = await scriptReadTab('UserRegistry');
  const hit = rows.find((r) => r.userId === userId);
  if (!hit) return null;
  return { userId, name: hit.name ?? '', email: hit.email ?? '', accountStatus: hit.accountStatus ?? 'active' };
}

async function auditLog(
  entry: { adminId: string; action: string; targetUserId?: string; previousValue?: string; newValue?: string; logId?: string },
): Promise<void> {
  try {
    const row = ADMIN_TABS.AdminLogs.map(
      (h) =>
        (
          buildLogEntry({
            logId: entry.logId ?? newLinkId().replace('lnk_', 'log_'),
            adminId: entry.adminId,
            action: entry.action,
            targetUserId: entry.targetUserId,
            previousValue: entry.previousValue,
            newValue: entry.newValue,
          }) as unknown as Record<string, string>
        )[h] ?? '',
    );
    await scriptAppendRow('AdminLogs', row);
  } catch {
    /* audit failures must not mask the primary result */
  }
}

function getStore(): { store: DeviceStore } {
  if (!adminScriptConfigured()) {
    throw httpError('Device storage is not configured on the server.', 501);
  }
  return { store: createScriptDeviceStore() };
}


export function getDeviceTestStore(): DeviceStore {
  return createMemoryDeviceStore();
}

function deviceSecret(): string {
  return process.env.DEVICE_SESSION_SECRET || '';
}

function requireDeviceSession(req: DevicesReq): DeviceSession {
  const session = verifyDeviceSessionFormat(bearerToken(req), deviceSecret());
  if (!session) throw httpError('Device authentication required.', 401);
  return session;
}

function requireAdminSession(req: DevicesReq): { adminId: string; email: string; role: string } {
  // Owner-only path: reuse the admin session scheme (verified with the
  // server-side admin secret the browser never sees).
  const token = bearerToken(req);
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (!token || !secret) throw httpError('Admin authentication required.', 401);
  const parts = token.split('.');
  if (parts.length !== 2) throw httpError('Admin authentication required.', 401);
  // Delegate full verification to the shared shape: payload must carry an
  // adminId + role. (Signature check duplicated here to avoid importing the
  // whole admin route; uses only server-side secrets.)
  const expect = createHmac('sha256', secret).update(parts[0]).digest();
  let got: Buffer;
  try {
    got = Buffer.from(parts[1], 'base64url');
  } catch {
    throw httpError('Admin authentication required.', 401);
  }
  if (got.length !== expect.length || !timingSafeEqual(got, expect)) {
    throw httpError('Admin authentication required.', 401);
  }
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
      adminId?: unknown;
      email?: unknown;
      role?: unknown;
      exp?: unknown;
    };
    if (
      typeof payload.adminId !== 'string' ||
      (payload.role !== 'owner' && payload.role !== 'admin') ||
      typeof payload.exp !== 'number' ||
      Date.now() > payload.exp
    ) {
      throw httpError('Admin authentication required.', 401);
    }
    return { adminId: payload.adminId, email: String(payload.email ?? ''), role: payload.role };
  } catch (e) {
    if (e && typeof e === 'object' && 'status' in e) throw e;
    throw httpError('Admin authentication required.', 401);
  }
}

// In-memory rate limiters (best-effort per instance; persistent attempt
// counters in the sheet provide the hard brute-force guarantee).
const claimLimiter = new RateLimiter(20, 60_000);
const pollLimiter = new RateLimiter(60, 60_000);
const createLimiter = new RateLimiter(30, 60_000);

function setupHelp(): Record<string, string[]> {
  return {
    steps: [
      'Tabs are created automatically in the PRIVATE admin spreadsheet on first contact (see docs/admin-setup.md).',
      'Set ADMIN_SCRIPT_URL, ADMIN_SCRIPT_TOKEN and DEVICE_SESSION_SECRET in Vercel environment variables and redeploy.',
      'For inventory-path revocation checks, run setDeviceSecrets(...) once in the user-sheet Apps Script (see docs/device-linking.md).',
    ],
  };
}

export default async function handler(req: DevicesReq, res: DevicesRes): Promise<void> {
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
    if (!action || action === 'status') {
      const configured = Boolean(adminScriptConfigured() && deviceSecret());
      res.status(200).json({ success: true, data: { configured } });
      return;
    }

    /* ------------------------- public: claim / poll / validate ------------------------- */

    if (action === 'claimLink') {
      if (!claimLimiter.take(`claim:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: 'Too many attempts. Wait a minute and try again.' });
        return;
      }
      const { store } = getStore();
      const rawCode = typeof body.code === 'string' && body.code.trim() ? body.code : null;
      let link: DeviceLink | null = null;
      let token = '';
      if (rawCode) {
        const code = normalizeLinkCode(rawCode);
        if (code.length < 6) {
          res.status(400).json({ success: false, error: 'Enter the complete linking code.' });
          return;
        }
        link = await store.findLinkByCodeHash(sha256hex(code));
        token = code;
      } else {
        const linkId = String(body.linkId ?? '').trim();
        token = String(body.token ?? '').trim();
        if (!isValidLinkId(linkId) || !token) {
          res.status(400).json({ success: false, error: 'Invalid linking request.' });
          return;
        }
        link = await store.getLink(linkId);
      }
      const outcome = tryClaimLink(link, token);
      if (outcome.ok === false) {
        // Persist failed attempts so brute force is locked out in storage.
        if (outcome.link && (outcome.reason === 'invalid-token' || outcome.reason === 'locked')) {
          try {
            const attempts = outcome.link.attempts + (outcome.reason === 'invalid-token' ? 1 : 0);
            await store.updateLink({ ...outcome.link, attempts, updatedAt: new Date().toISOString() });
          } catch {
            /* best-effort */
          }
        } else if (outcome.link && outcome.reason === 'expired' && outcome.link.status === 'pending') {
          try {
            await store.updateLink({ ...outcome.link, status: 'expired', updatedAt: new Date().toISOString() });
          } catch {
            /* best-effort */
          }
        }
        const messages: Record<string, string> = {
          'not-found': 'Link not found. Ask the primary device for a fresh code.',
          expired: 'This code has expired. Ask the primary device for a fresh one.',
          locked: 'Too many wrong attempts. Ask the primary device for a fresh code.',
          'already-used': 'This code was already used. Ask the primary device for a fresh one.',
          'invalid-token': 'Incorrect code. Check and try again.',
        };
        const status = outcome.reason === 'not-found' ? 404 : outcome.reason === 'invalid-token' ? 401 : 410;
        res.status(status).json({ success: false, error: messages[outcome.reason], reason: outcome.reason });
        return;
      }
      const meta = sanitizeDeviceMeta({ name: body.deviceName, platform: body.platform, appInfo: body.appInfo });
      const claimantDeviceId = String(body.deviceId ?? '').trim();
      if (!isValidDeviceId(claimantDeviceId)) {
        res.status(400).json({ success: false, error: 'Invalid device.' });
        return;
      }
      const claimed: DeviceLink = {
        ...outcome.link,
        claimant: JSON.stringify({ deviceId: claimantDeviceId, ...meta }),
        updatedAt: new Date().toISOString(),
      };
      await store.updateLink(claimed);
      res.status(200).json({
        success: true,
        data: { linkId: claimed.linkId, status: 'claimed' as const, expiresAt: claimed.expiresAt },
      });
      return;
    }

    if (action === 'pollLink') {
      if (!pollLimiter.take(`poll:${clientIp(req)}`)) {
        res.status(429).json({ success: false, error: 'Too many attempts. Wait a moment and try again.' });
        return;
      }
      const { store } = getStore();
      const linkId = String(body.linkId ?? '').trim();
      const token = String(body.token ?? body.code ?? '').trim();
      if (!isValidLinkId(linkId) || !token) {
        res.status(400).json({ success: false, error: 'Invalid linking request.' });
        return;
      }
      const link = await store.getLink(linkId);
      // The token may be the full QR token (hex) or the typed code: accept
      // whichever matches the stored hash. Never reveal which one failed.
      const presented = token.trim();
      const matches =
        !!link &&
        (hashEqual(sha256hex(presented), link.tokenHash) ||
          hashEqual(sha256hex(normalizeLinkCode(presented)), link.tokenHash));
      if (!link || !matches) {
        res.status(404).json({ success: false, error: 'Link not found.', reason: 'not-found' });
        return;
      }
      const state = linkPublicState(link!);
      if (state === 'approved') {
        let claimantDeviceId = '';
        try {
          claimantDeviceId = String((JSON.parse(link!.claimant) as { deviceId?: unknown }).deviceId ?? '');
        } catch {
          claimantDeviceId = '';
        }
        if (!isValidDeviceId(claimantDeviceId)) {
          res.status(410).json({ success: false, error: 'Link is no longer valid.', reason: 'already-used' });
          return;
        }
        const profile = await readRegistryUser(link!.userId);
        const session = createDeviceSession(link!.userId, claimantDeviceId, deviceSecret(), DEVICE_SESSION_TTL_MS);
        res.status(200).json({
          success: true,
          data: {
            status: 'approved' as const,
            deviceSession: session,
            userId: link!.userId,
            deviceId: claimantDeviceId,
            profile: profile ? { name: profile.name, email: profile.email } : null,
          },
        });
        return;
      }
      if (state === 'pending' || state === 'claimed') {
        res.status(200).json({ success: true, data: { status: state, expiresAt: link!.expiresAt } });
        return;
      }
      res.status(200).json({ success: true, data: { status: state } });
      return;
    }

    if (action === 'validateDevice') {
      // Server-to-server check used by Apps Script before honoring a
      // device session on inventory writes. Auth = the session token
      // itself (a per-device bearer the caller must already hold).
      const userId = String(body.userId ?? '').trim();
      const deviceId = String(body.deviceId ?? '').trim();
      const sessionToken = String(body.sessionToken ?? '').trim();
      const parsed = verifyDeviceSessionFormat(sessionToken, deviceSecret());
      if (!parsed || parsed.userId !== userId || parsed.deviceId !== deviceId) {
        res.status(200).json({ success: true, data: { valid: false, reason: 'invalid-session' } });
        return;
      }
      const { store } = getStore();
      const device = await store.getDevice(deviceId);
      if (!device || device.userId !== userId || device.status !== 'active') {
        res.status(200).json({ success: true, data: { valid: false, reason: 'revoked' } });
        return;
      }
      const reg = await readRegistryUser(userId);
      if (!reg || reg.accountStatus !== 'active') {
        res.status(200).json({ success: true, data: { valid: false, reason: 'suspended' } });
        return;
      }
      res.status(200).json({ success: true, data: { valid: true } });
      return;
    }

    /* ------------------------- device-session actions ------------------------- */

    if (action === 'enrollPrimary') {
      // First-device enrollment is bound to the authenticated account:
      // the caller presents a valid AUTH session (from register/login)
      // and may only enroll for its own userId. Later devices must use
      // the approved link flow — never direct enrollment.
      const authSession = verifyAuthSession(bearerToken(req), process.env.AUTH_SESSION_SECRET || '');
      if (!authSession) {
        res.status(401).json({ success: false, error: 'Sign-in required to enroll this device.' });
        return;
      }
      const deviceId = String(body.deviceId ?? '').trim();
      if (!isValidUserIdRef(body.userId) || String(body.userId) !== authSession.userId || !isValidDeviceId(deviceId)) {
        res.status(400).json({ success: false, error: 'Invalid enrollment request.' });
        return;
      }
      const userId = authSession.userId;
      const { store } = getStore();
      const reg = await readRegistryUser(userId);
      if (!reg) {
        res.status(404).json({ success: false, error: 'Account not found. Register first, then try again.' });
        return;
      }
      if (reg.accountStatus !== 'active') {
        res.status(403).json({ success: false, error: 'This account is not active. Contact the owner.' });
        return;
      }
      const existing = (await store.listDevicesForUser(userId)).filter((d) => d.status === 'active');
      if (existing.length > 0 && !existing.some((d) => d.deviceId === deviceId)) {
        res.status(409).json({
          success: false,
          error: 'This account already has linked devices. Use Link Existing Account on the new device.',
          reason: 'link-required',
        });
        return;
      }
      const meta = sanitizeDeviceMeta({ name: body.deviceName, platform: body.platform, appInfo: body.appInfo });
      const now = new Date().toISOString();
      const prior = await store.getDevice(deviceId);
      await store.upsertDevice({
        deviceId,
        userId,
        name: meta.name,
        platform: meta.platform,
        appInfo: meta.appInfo,
        status: 'active',
        linkedAt: prior?.linkedAt ?? now,
        lastActiveAt: now,
      });
      await auditLog({
        adminId: `device:${deviceId}`,
        action: 'device.enrollPrimary',
        targetUserId: userId,
        newValue: meta.name,
      });
      const session = createDeviceSession(userId, deviceId, deviceSecret(), DEVICE_SESSION_TTL_MS);
      res.status(200).json({ success: true, data: { deviceSession: session, deviceId, userId } });
      return;
    }

    // All actions below require an authenticated device session (or, where
    // noted, an admin session).
    const adminAct =
      action === 'adminListDevices' || action === 'adminRevokeDevice' || action === 'adminDeviceStats';
    let session: DeviceSession | null = null;
    let admin: { adminId: string; email: string; role: string } | null = null;
    if (adminAct) {
      try {
        session = requireDeviceSession(req);
      } catch {
        session = null;
      }
      if (!session) admin = requireAdminSession(req);
    } else {
      session = requireDeviceSession(req);
    }

    if (adminAct && admin) {
      const { store } = getStore();
      if (action === 'adminDeviceStats') {
        // Counts across users require a full scan (admin sheet is small).
        const rows = await scriptReadTab('Devices');
        const perUser = new Map<string, number>();
        let totalActive = 0;
        for (const r of rows) {
          if (r.status !== 'active') continue;
          totalActive += 1;
          perUser.set(r.userId, (perUser.get(r.userId) ?? 0) + 1);
        }
        res.status(200).json({
          success: true,
          data: { totalActive, usersWithDevices: perUser.size, perUser: [...perUser.entries()].map(([userId, count]) => ({ userId, count })) },
        });
        return;
      }
      if (action === 'adminListDevices') {
        const userId = String(body.userId ?? '').trim();
        if (!isValidUserIdRef(userId)) {
          res.status(400).json({ success: false, error: 'Invalid userId.' });
          return;
        }
        const devices = await store.listDevicesForUser(userId);
        res.status(200).json({ success: true, data: { devices } });
        return;
      }
      // adminRevokeDevice
      const deviceId = String(body.deviceId ?? '').trim();
      if (!isValidDeviceId(deviceId)) {
        res.status(400).json({ success: false, error: 'Invalid deviceId.' });
        return;
      }
      const device = await store.getDevice(deviceId);
      if (!device) {
        res.status(404).json({ success: false, error: 'Device not found.' });
        return;
      }
      if (device.status === 'revoked') {
        res.status(200).json({ success: true, data: { device, replayed: true } });
        return;
      }
      const next: LinkedDevice = { ...device, status: 'revoked' };
      await store.upsertDevice(next);
      await auditLog({
        adminId: admin.adminId,
        action: 'device.revoke',
        targetUserId: device.userId,
        previousValue: 'active',
        newValue: `revoked:${deviceId}`,
      });
      console.info('[stockly-devices] admin revoked device');
      res.status(200).json({ success: true, data: { device: next, replayed: false } });
      return;
    }

    if (!session) throw httpError('Device authentication required.', 401);
    const { store } = getStore();
    // The device must still be enrolled and active: revocation takes
    // effect HERE on every call, not just in the UI.
    const caller = await store.getDevice(session.deviceId);
    if (!caller || caller.userId !== session.userId || caller.status !== 'active') {
      res.status(401).json({ success: false, error: 'This device is no longer linked. Link it again to continue.' });
      return;
    }
    const reg = await readRegistryUser(session.userId);
    if (!reg || reg.accountStatus !== 'active') {
      res.status(403).json({ success: false, error: 'This account is not active. Contact the owner.' });
      return;
    }

    switch (action) {
      case 'createLink': {
        if (!createLimiter.take(`create:${session.deviceId}`)) {
          res.status(429).json({ success: false, error: 'Too many codes. Wait a minute and try again.' });
          return;
        }
        const method: LinkMethod = body.method === 'code' ? 'code' : 'qr';
        if (body.method !== undefined && !isValidLinkMethod(body.method)) {
          res.status(400).json({ success: false, error: 'Invalid method.' });
          return;
        }
        // Cancel this device's stale pending links (one live link at a time).
        const mine = await store.listLinksForUser(session.userId);
        const nowIso = new Date().toISOString();
        for (const l of mine) {
          if (l.status === 'pending' || l.status === 'claimed') {
            try {
              await store.updateLink({ ...l, status: 'cancelled', updatedAt: nowIso });
            } catch {
              /* best-effort */
            }
          }
        }
        const secret = method === 'code' ? newLinkCode() : newLinkToken();
        const record = createLinkRecord({
          userId: session.userId,
          method,
          tokenHash: sha256hex(method === 'code' ? normalizeLinkCode(secret) : secret),
          ttlMs: method === 'code' ? CODE_LINK_TTL_MS : QR_LINK_TTL_MS,
          nowIso,
        });
        await store.createLink(record);
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: 'device.linkCreate',
          targetUserId: session.userId,
          newValue: `${method}:${record.linkId}`,
        });
        res.status(200).json({
          success: true,
          data: {
            linkId: record.linkId,
            method,
            token: secret,
            code: method === 'code' ? secret : undefined,
            expiresAt: record.expiresAt,
          },
        });
        return;
      }
      case 'getLink': {
        const linkId = String(body.linkId ?? '').trim();
        if (!isValidLinkId(linkId)) {
          res.status(400).json({ success: false, error: 'Invalid linkId.' });
          return;
        }
        const link = await store.getLink(linkId);
        if (!link || link.userId !== session.userId) {
          res.status(404).json({ success: false, error: 'Link not found.' });
          return;
        }
        const state = linkPublicState(link);
        if (state === 'expired' && link.status !== 'expired') {
          try {
            await store.updateLink({ ...link, status: 'expired', updatedAt: new Date().toISOString() });
          } catch {
            /* best-effort */
          }
        }
        let claimantName = '';
        try {
          claimantName = String((JSON.parse(link.claimant) as { name?: unknown }).name ?? '');
        } catch {
          claimantName = '';
        }
        res.status(200).json({
          success: true,
          data: { linkId, method: link.method, status: state, expiresAt: link.expiresAt, attempts: link.attempts, claimantName },
        });
        return;
      }
      case 'cancelLink':
      case 'refreshLink': {
        const linkId = String(body.linkId ?? '').trim();
        if (!isValidLinkId(linkId)) {
          res.status(400).json({ success: false, error: 'Invalid linkId.' });
          return;
        }
        const link = await store.getLink(linkId);
        if (!link || link.userId !== session.userId) {
          res.status(404).json({ success: false, error: 'Link not found.' });
          return;
        }
        const nowIso = new Date().toISOString();
        if (link.status === 'pending' || link.status === 'claimed') {
          await store.updateLink({ ...link, status: 'cancelled', updatedAt: nowIso });
        }
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: action === 'cancelLink' ? 'device.linkCancel' : 'device.linkRefresh',
          targetUserId: session.userId,
          newValue: linkId,
        });
        if (action === 'cancelLink') {
          res.status(200).json({ success: true, data: { linkId, status: 'cancelled' as const } });
          return;
        }
        const method: LinkMethod = link.method;
        const secret = method === 'code' ? newLinkCode() : newLinkToken();
        const record = createLinkRecord({
          userId: session.userId,
          method,
          tokenHash: sha256hex(method === 'code' ? normalizeLinkCode(secret) : secret),
          ttlMs: method === 'code' ? CODE_LINK_TTL_MS : QR_LINK_TTL_MS,
          nowIso,
        });
        await store.createLink(record);
        res.status(200).json({
          success: true,
          data: {
            linkId: record.linkId,
            method,
            token: secret,
            code: method === 'code' ? secret : undefined,
            expiresAt: record.expiresAt,
          },
        });
        return;
      }
      case 'approveLink':
      case 'rejectLink': {
        const linkId = String(body.linkId ?? '').trim();
        if (!isValidLinkId(linkId)) {
          res.status(400).json({ success: false, error: 'Invalid linkId.' });
          return;
        }
        const link = await store.getLink(linkId);
        if (!link || link.userId !== session.userId) {
          res.status(404).json({ success: false, error: 'Link not found.' });
          return;
        }
        const state = linkPublicState(link);
        if (state !== 'claimed') {
          res.status(409).json({ success: false, error: `This request is ${state}. Nothing to approve.` });
          return;
        }
        let claimantDeviceId = '';
        let claimantMeta = { name: 'Linked device', platform: 'unknown', appInfo: '' };
        try {
          const c = JSON.parse(link.claimant) as { deviceId?: unknown; name?: unknown; platform?: unknown; appInfo?: unknown };
          claimantDeviceId = String(c.deviceId ?? '');
          claimantMeta = sanitizeDeviceMeta(c);
        } catch {
          res.status(410).json({ success: false, error: 'Claim data is invalid. Ask for a fresh code.' });
          return;
        }
        if (!isValidDeviceId(claimantDeviceId) || claimantDeviceId === session.deviceId) {
          res.status(400).json({ success: false, error: 'Invalid claimant device.' });
          return;
        }
        const nowIso = new Date().toISOString();
        if (action === 'rejectLink') {
          await store.updateLink({ ...link, status: 'rejected', updatedAt: nowIso });
          await auditLog({
            adminId: `device:${session.deviceId}`,
            action: 'device.linkReject',
            targetUserId: session.userId,
            newValue: linkId,
          });
          res.status(200).json({ success: true, data: { linkId, status: 'rejected' as const } });
          return;
        }
        // Approve: single-use — the link can never be approved twice.
        const dup = await store.getLink(linkId);
        if (!dup || dup.status !== 'claimed') {
          res.status(409).json({ success: false, error: 'This request was already handled.' });
          return;
        }
        await store.upsertDevice({
          deviceId: claimantDeviceId,
          userId: session.userId,
          name: claimantMeta.name,
          platform: claimantMeta.platform,
          appInfo: claimantMeta.appInfo,
          status: 'active',
          linkedAt: nowIso,
          lastActiveAt: nowIso,
        });
        await store.updateLink({ ...link, status: 'approved', updatedAt: nowIso });
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: 'device.linkApprove',
          targetUserId: session.userId,
          newValue: `${linkId}->${claimantDeviceId}`,
        });
        console.info('[stockly-devices] link approved');
        res.status(200).json({ success: true, data: { linkId, status: 'approved' as const, deviceId: claimantDeviceId } });
        return;
      }
      case 'listDevices': {
        const devices = await store.listDevicesForUser(session.userId);
        devices.sort((a, b) => (a.linkedAt < b.linkedAt ? 1 : -1));
        res.status(200).json({
          success: true,
          data: { devices, currentDeviceId: session.deviceId },
        });
        return;
      }
      case 'revokeDevice': {
        const deviceId = String(body.deviceId ?? '').trim();
        if (!isValidDeviceId(deviceId)) {
          res.status(400).json({ success: false, error: 'Invalid deviceId.' });
          return;
        }
        if (deviceId === session.deviceId) {
          res.status(400).json({ success: false, error: 'Use sign-out to remove this device.' });
          return;
        }
        const device = await store.getDevice(deviceId);
        if (!device || device.userId !== session.userId) {
          res.status(404).json({ success: false, error: 'Device not found.' });
          return;
        }
        if (device.status === 'revoked') {
          res.status(200).json({ success: true, data: { device, replayed: true } });
          return;
        }
        const next: LinkedDevice = { ...device, status: 'revoked' };
        await store.upsertDevice(next);
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: 'device.revoke',
          targetUserId: session.userId,
          previousValue: 'active',
          newValue: `revoked:${deviceId}`,
        });
        console.info('[stockly-devices] device revoked');
        res.status(200).json({ success: true, data: { device: next, replayed: false } });
        return;
      }
      case 'revokeOthers': {
        const devices = await store.listDevicesForUser(session.userId);
        let revoked = 0;
        for (const d of devices) {
          if (d.deviceId !== session.deviceId && d.status === 'active') {
            await store.upsertDevice({ ...d, status: 'revoked' });
            revoked += 1;
          }
        }
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: 'device.revokeOthers',
          targetUserId: session.userId,
          newValue: `revoked=${revoked}`,
        });
        res.status(200).json({ success: true, data: { revoked } });
        return;
      }
      case 'touchDevice': {
        const device = await store.getDevice(session.deviceId);
        if (device) {
          await store.upsertDevice({ ...device, lastActiveAt: new Date().toISOString() });
        }
        res.status(200).json({ success: true, data: { ok: true } });
        return;
      }
      case 'unlinkSelf': {
        // Sign this device out everywhere: revoke its record, then the
        // client discards the session. The device must re-link to return.
        const device = await store.getDevice(session.deviceId);
        if (device && device.status === 'active') {
          await store.upsertDevice({ ...device, status: 'revoked' });
        }
        await auditLog({
          adminId: `device:${session.deviceId}`,
          action: 'device.unlinkSelf',
          targetUserId: session.userId,
          newValue: session.deviceId,
        });
        res.status(200).json({ success: true, data: { ok: true } });
        return;
      }
      default: {
        res.status(400).json({ success: false, error: `Unknown action: ${action}` });
        return;
      }
    }
  } catch (e) {
    const status =
      typeof (e as { status?: unknown }).status === 'number'
        ? ((e as { status: number }).status as number)
        : 500;
    if (status === 501) {
      res.status(501).json({ success: false, error: 'Device storage is not configured on the server.', ...setupHelp() });
      return;
    }
    if (status === 400 || status === 401 || status === 403 || status === 404 || status === 409 || status === 410 || status === 429) {
      res.status(status).json({
        success: false,
        error: e instanceof Error ? e.message : 'Request failed.',
      });
      return;
    }
    console.error('[stockly-devices] request failed');
    res.status(500).json({ success: false, error: 'Device request failed. Check server logs and try again.' });
  }
}
