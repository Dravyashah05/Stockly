/* Linked-device client (browser side).
 *
 * Talks ONLY to the same-origin trusted route `/api/devices`. Linking
 * tokens are short-lived + single-use; device sessions are server-issued
 * HMAC tokens verified on every call. No server secrets ever reach this
 * bundle. The device id + session are per-device localStorage entries
 * (this device's credential — never synced, never put in Sheets).
 */

import { DEVICES_API_ROUTE, LS_KEYS, apiUrl } from './config';
import { getAuthSession } from './auth';

export type LinkStatus = 'pending' | 'claimed' | 'approved' | 'rejected' | 'expired' | 'cancelled';

export interface DeviceInfo {
  deviceId: string;
  userId: string;
  name: string;
  platform: string;
  appInfo: string;
  status: 'active' | 'revoked';
  linkedAt: string;
  lastActiveAt: string;
}

export interface CreatedLink {
  linkId: string;
  method: 'qr' | 'code';
  /** Plaintext secret: QR token or typed code. Shown once, never stored. */
  token: string;
  code?: string;
  expiresAt: string;
}

export interface LinkView {
  linkId: string;
  method: 'qr' | 'code';
  status: LinkStatus;
  expiresAt: string;
  attempts: number;
  claimantName: string;
}

export class DevicesApiError extends Error {
  status?: number;
  reason?: string;
  constructor(message: string, status?: number, reason?: string) {
    super(message);
    this.name = 'DevicesApiError';
    this.status = status;
    this.reason = reason;
  }
}

function newLocalId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  }
  const rand = Math.floor(Math.random() * 1e12).toString(36);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Stable per-device id, generated once on this device. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(LS_KEYS.deviceId);
    if (!id) {
      id = newLocalId('dev');
      localStorage.setItem(LS_KEYS.deviceId, id);
    }
    return id;
  } catch {
    return newLocalId('dev');
  }
}

export function getDeviceSession(): string | null {
  try {
    return localStorage.getItem(LS_KEYS.deviceSession);
  } catch {
    return null;
  }
}

export function setDeviceSession(token: string | null): void {
  try {
    if (token) localStorage.setItem(LS_KEYS.deviceSession, token);
    else localStorage.removeItem(LS_KEYS.deviceSession);
  } catch {
    /* storage unavailable */
  }
}

export function deviceDisplayName(): string {
  try {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'Android device';
    if (/iphone|ipad/i.test(ua)) return 'iPhone';
    if (/windows/i.test(ua)) return 'Windows PC';
    if (/macintosh|mac os/i.test(ua)) return 'Mac';
    if (/linux/i.test(ua)) return 'Linux PC';
    return 'My device';
  } catch {
    return 'My device';
  }
}

export function devicePlatform(): string {
  try {
    const w = window as unknown as { Capacitor?: unknown };
    if (w.Capacitor) return 'android-app';
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android-web';
    if (/iphone|ipad/i.test(ua)) return 'ios-web';
    if (/mobile/i.test(ua)) return 'mobile-web';
    return 'desktop-web';
  } catch {
    return 'unknown';
  }
}

async function callDevices<T>(
  action: string,
  payload: Record<string, unknown> = {},
  opts: { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const token = getDeviceSession();
    if (!token) throw new DevicesApiError('This device is not linked. Link it first.', 401, 'no-session');
    headers.Authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(apiUrl(DEVICES_API_ROUTE), {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new DevicesApiError('Could not reach the device service. Check your connection and deployment.');
  }
  let json: { success?: boolean; data?: unknown; error?: unknown; reason?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new DevicesApiError(`Device service returned HTTP ${res.status}.`, res.status);
  }
  if (!json.success) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `Device request failed (HTTP ${res.status}).`;
    throw new DevicesApiError(msg, res.status, typeof json.reason === 'string' ? json.reason : undefined);
  }
  return json.data as T;
}

const auth = (extra: Record<string, unknown> = {}) => ({
  deviceId: getDeviceId(),
  deviceName: deviceDisplayName(),
  platform: devicePlatform(),
  appInfo: (() => {
    try {
      return navigator.userAgent.slice(0, 120);
    } catch {
      return '';
    }
  })(),
  ...extra,
});

export const devicesApi = {
  status: () => callDevices<{ configured: boolean }>('status', {}, { auth: false }),

  enrollPrimary: async (userId: string) => {
    // First-device enrollment is bound to the authenticated account: the
    // AUTH session (not a device session) authorizes this call.
    const authSession = getAuthSession();
    if (!authSession) throw new DevicesApiError('Sign-in required to enroll this device.', 401);
    let res: Response;
    try {
      res = await fetch(apiUrl(DEVICES_API_ROUTE), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession}` },
        body: JSON.stringify({ action: 'enrollPrimary', userId, ...auth() }),
      });
    } catch {
      throw new DevicesApiError('Could not reach the device service. Check your connection and deployment.');
    }
    const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: unknown; reason?: unknown };
    if (!json.success) {
      throw new DevicesApiError(
        typeof json.error === 'string' && json.error ? json.error : `Enrollment failed (HTTP ${res.status}).`,
        res.status,
        typeof json.reason === 'string' ? json.reason : undefined,
      );
    }
    return json.data as { deviceSession: string; deviceId: string; userId: string };
  },

  createLink: (method: 'qr' | 'code') => callDevices<CreatedLink>('createLink', { method }),

  getLink: (linkId: string) => callDevices<LinkView>('getLink', { linkId }),

  cancelLink: (linkId: string) =>
    callDevices<{ linkId: string; status: LinkStatus }>('cancelLink', { linkId }),

  refreshLink: (linkId: string) => callDevices<CreatedLink>('refreshLink', { linkId }),

  approveLink: (linkId: string) =>
    callDevices<{ linkId: string; status: LinkStatus; deviceId: string }>('approveLink', { linkId }),

  rejectLink: (linkId: string) =>
    callDevices<{ linkId: string; status: LinkStatus }>('rejectLink', { linkId }),

  claimLink: (args: { linkId?: string; token?: string; code?: string }) =>
    callDevices<{ linkId: string; status: LinkStatus; expiresAt: string }>(
      'claimLink',
      { ...auth(), ...args },
      { auth: false },
    ),

  pollLink: (args: { linkId: string; token: string }) =>
    callDevices<
      | { status: 'pending' | 'claimed'; expiresAt: string }
      | { status: 'approved'; deviceSession: string; userId: string; deviceId: string; profile: { name: string; email: string } | null }
      | { status: 'rejected' | 'expired' | 'cancelled' }
    >('pollLink', args, { auth: false }),

  listDevices: () =>
    callDevices<{ devices: DeviceInfo[]; currentDeviceId: string }>('listDevices'),

  revokeDevice: (deviceId: string) =>
    callDevices<{ device: DeviceInfo; replayed: boolean }>('revokeDevice', { deviceId }),

  revokeOthers: () => callDevices<{ revoked: number }>('revokeOthers'),

  touchDevice: () =>
    callDevices<{ ok: boolean }>('touchDevice').catch(() => ({ ok: false })),

  unlinkSelf: () => callDevices<{ ok: boolean }>('unlinkSelf'),

  // Owner endpoints (admin token, routed to the same trusted backend).
  adminListDevices: (adminToken: string, userId: string) =>
    callDevicesWith<{ devices: DeviceInfo[] }>('adminListDevices', { userId }, adminToken),
  adminRevokeDevice: (adminToken: string, deviceId: string) =>
    callDevicesWith('adminRevokeDevice', { deviceId }, adminToken),
  adminDeviceStats: (adminToken: string) =>
    callDevicesWith<{
      totalActive: number;
      usersWithDevices: number;
      perUser: { userId: string; count: number }[];
    }>('adminDeviceStats', {}, adminToken),
};

async function callDevicesWith<T>(action: string, payload: Record<string, unknown>, adminToken: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(DEVICES_API_ROUTE), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new DevicesApiError('Could not reach the device service. Check your connection and deployment.');
  }
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; data?: unknown; error?: unknown };
  if (!json.success) {
    throw new DevicesApiError(
      typeof json.error === 'string' && json.error ? json.error : `Device request failed (HTTP ${res.status}).`,
      res.status,
    );
  }
  return json.data as T;
}

/** QR payload helpers (shared shape with the server; no secrets inside). */
export function buildQrText(linkId: string, token: string): string {
  return JSON.stringify({ v: 1, app: 'stockly', linkId, token });
}

export function parseQrText(raw: string): { linkId: string; token: string } | null {
  try {
    const text = raw.trim();
    if (!text || text.length > 512) return null;
    const p = JSON.parse(text) as { v?: unknown; app?: unknown; linkId?: unknown; token?: unknown };
    if (p.v !== 1 || p.app !== 'stockly' || typeof p.linkId !== 'string' || typeof p.token !== 'string') {
      return null;
    }
    if (!p.linkId.trim() || !/^[0-9a-f]{32,128}$/i.test(p.token)) return null;
    return { linkId: p.linkId.trim(), token: p.token };
  } catch {
    return null;
  }
}
