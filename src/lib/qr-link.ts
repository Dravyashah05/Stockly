/* QR device-linking helpers (Settings → Cloud database).
 *
 * The QR payload is ONLY the public-by-design Apps Script `/exec` URL —
 * never passwords, sheet contents, tokens, or credentials. Acceptance is
 * decided by the existing `isAppsScriptExecUrl` check; this module only
 * adds machine-readable reject reasons so the UI can explain failures.
 * Nothing here logs the scanned value.
 */

import { isAppsScriptExecUrl } from './config.ts';

export type ScannedEndpoint = { ok: true; url: string } | { ok: false; reason: 'empty' | 'not-url' | 'protocol' | 'host' | 'path' };

/** Validate raw scanner/paste input. Returns the trimmed URL or a reason. */
export function parseScannedEndpoint(raw: unknown): ScannedEndpoint {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, reason: 'empty' };
  if (isAppsScriptExecUrl(text)) return { ok: true, url: text };
  let u: URL | null = null;
  try {
    u = new URL(text);
  } catch {
    u = null;
  }
  if (!u) return { ok: false, reason: 'not-url' };
  if (u.protocol !== 'https:') return { ok: false, reason: 'protocol' };
  if (u.hostname !== 'script.google.com') return { ok: false, reason: 'host' };
  return { ok: false, reason: 'path' };
}

/** User-facing explanation for a reject reason (never echoes the input). */
export function scannedEndpointMessage(reason: string): string {
  switch (reason) {
    case 'empty':
      return 'Nothing readable was scanned — try again or paste the link.';
    case 'not-url':
      return 'That QR code doesn’t contain a Stockly database link.';
    case 'protocol':
      return 'Only secure https links are accepted — that code was rejected.';
    case 'host':
      return 'That link isn’t a Google Apps Script web-app URL.';
    case 'path':
      return 'That link isn’t a deployed /exec web-app URL. Use the /exec address from a working Stockly setup (not a /dev test link).';
    default:
      return 'That QR code couldn’t be used to connect.';
  }
}
