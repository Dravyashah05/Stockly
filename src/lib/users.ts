/* Server-verified account management.
 *
 * Identity is established by /api/auth (password scrypt / Google ID
 * token verified server-side). The user spreadsheet is now purely a data
 * store reached through the session-bound /api/sheets gateway; the admin
 * spreadsheet remains authoritative for account status.
 */

import { LS_KEYS, setCurrentUserId } from './config';
import { authApi, getAuthSession, setAuthSession } from './auth';
import { devicesApi, setDeviceSession } from './devices';
import type { UserProfile } from './types';

export type { UserProfile };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateAccountInput(name: string, email: string): { name: string; email: string } {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!n) throw new Error('Enter your name.');
  if (n.length > 80) throw new Error('Name is too long (max 80 characters).');
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) throw new Error('Enter a valid email address.');
  return { name: n, email: e };
}

export function getCachedProfile(): UserProfile | null {
  try {
    const raw = localStorage.getItem(LS_KEYS.userProfile);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (typeof parsed.userId !== 'string' || !parsed.userId) return null;
    return parsed as UserProfile;
  } catch {
    return null;
  }
}

function cacheProfile(profile: UserProfile | null): void {
  try {
    if (profile) localStorage.setItem(LS_KEYS.userProfile, JSON.stringify(profile));
    else localStorage.removeItem(LS_KEYS.userProfile);
  } catch {
    /* storage unavailable */
  }
}

export async function registerAccount(name: string, email: string, password: string): Promise<UserProfile> {
  const input = validateAccountInput(name, email);
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  const res = await authApi.register({ ...input, password });
  setAuthSession(res.session);
  setCurrentUserId(res.user.userId);
  const profile = toUserProfile(res.user);
  cacheProfile(profile);
  await ensureDeviceEnrolled(res.user.userId);
  return profile;
}

function toUserProfile(u: { userId: string; email: string; name: string; accountStatus: string }): UserProfile {
  const now = new Date().toISOString();
  const st = u.accountStatus === 'suspended' || u.accountStatus === 'deactivated' ? u.accountStatus : 'active';
  return { userId: u.userId, name: u.name, email: u.email, accountStatus: st, createdAt: now, updatedAt: now, lastLoginAt: now };
}

/** Enroll this device as the account's primary device (bootstrap trust:
 *  this device just created/claimed the account). Later devices MUST use
 *  the link flow — the server rejects direct enrollment for them.
 *  Never throws: when the device service is unconfigured the app keeps
 *  working in legacy single-device mode. */
export async function ensureDeviceEnrolled(userId: string): Promise<'enrolled' | 'link-required' | 'unavailable'> {
  try {
    const res = await devicesApi.enrollPrimary(userId);
    setDeviceSession(res.deviceSession);
    await devicesApi.touchDevice();
    return 'enrolled';
  } catch (e) {
    const reason = (e as { reason?: string })?.reason;
    if ((e as { status?: number })?.status === 409 || reason === 'link-required') return 'link-required';
    return 'unavailable';
  }
}

export async function loginAccount(email: string, password: string): Promise<UserProfile> {
  const e = email.trim().toLowerCase();
  if (!e) throw new Error('Enter a valid email address.');
  const res = await authApi.login({ email: e, password });
  setAuthSession(res.session);
  setCurrentUserId(res.user.userId);
  const profile = toUserProfile(res.user);
  cacheProfile(profile);
  await ensureDeviceEnrolled(res.user.userId);
  return getCachedProfile() ?? profile;
}

export async function refreshMyProfile(): Promise<UserProfile | null> {
  if (!getAuthSession()) return getCachedProfile();
  try {
    const res = await authApi.me();
    const profile = toUserProfile(res.user);
    setCurrentUserId(res.user.userId);
    cacheProfile(profile);
    return profile;
  } catch {
    return getCachedProfile();
  }
}

export function signOutAccount(): void {
  try {
    void authApi.logout();
  } catch {
    /* best-effort server audit */
  }
  setAuthSession(null);
  setCurrentUserId('');
  cacheProfile(null);
}

/** Complete enrollment on a SECONDARY device after its link is approved.
 *  The approved link + token proof is exchanged server-side for a real
 *  auth session (linkAdopt) — never by email claim. */
export async function adoptLinkedAccount(args: {
  linkId: string;
  token: string;
  deviceId: string;
  deviceSession: string;
  name: string;
  email: string;
}): Promise<UserProfile> {
  const res = await authApi.linkAdopt({ linkId: args.linkId, token: args.token, deviceId: args.deviceId });
  setAuthSession(res.session);
  setCurrentUserId(res.user.userId);
  setDeviceSession(args.deviceSession);
  try {
    localStorage.setItem(LS_KEYS.deviceId, args.deviceId);
  } catch {
    /* storage unavailable */
  }
  const profile = toUserProfile({ ...res.user, name: res.user.name || args.name, email: res.user.email || args.email });
  cacheProfile(profile);
  try {
    await devicesApi.touchDevice();
  } catch {
    /* best-effort */
  }
  return profile;
}
