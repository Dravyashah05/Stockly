/* Stockly admin-spreadsheet schema auto-provisioning (server-side only).
 *
 * The private admin spreadsheet starts life as a completely EMPTY sheet:
 * on first contact the backend asks the bound Apps Script project to
 * create every tab it needs with the exact headers below, leaving
 * existing tabs/rows untouched (never overwrites). The browser never
 * touches this. See apps-script/Admin.gs (source of truth on the
 * Google side).
 */

export const SCHEMA_TABS: Record<string, readonly string[]> = {
  AdminUsers: ['adminId', 'email', 'role', 'status', 'createdAt', 'updatedAt'],
  UserRegistry: ['userId', 'name', 'email', 'accountStatus', 'registeredAt', 'lastLoginAt', 'updatedAt'],
  AdminLogs: ['logId', 'adminId', 'action', 'targetUserId', 'previousValue', 'newValue', 'timestamp'],
  AppSettings: ['key', 'value', 'updatedAt'],
  DeviceLinks: ['linkId', 'userId', 'tokenHash', 'method', 'status', 'expiresAt', 'attempts', 'claimant', 'createdAt', 'updatedAt'],
  Devices: ['deviceId', 'userId', 'name', 'platform', 'appInfo', 'status', 'linkedAt', 'lastActiveAt'],
  UserAuth: ['userId', 'email', 'name', 'passwordHash', 'providers', 'createdAt', 'updatedAt'],
  UserSheets: ['userId', 'spreadsheetId', 'execUrl', 'status', 'verifiedAt', 'updatedAt'],
};

export interface SchemaResult {
  created: string[];
  existing: string[];
}

import { adminScriptConfigured, scriptCall } from './apps-script-client.js';

// Per-instance cache: one setup call per 10 minutes, not per request.
// Serverless instances are ephemeral; the guard only avoids repeat work
// on warm instances.
let ensuredAt = 0;
const ENSURE_TTL_MS = 10 * 60 * 1000;

export async function ensureSchemaCached(): Promise<SchemaResult | null> {
  if (!adminScriptConfigured()) return null;
  if (Date.now() - ensuredAt < ENSURE_TTL_MS) return null;
  const result = await scriptCall<{ created?: unknown }>('setupSchema');
  ensuredAt = Date.now();
  const created = Array.isArray(result.created) ? result.created.map((t) => String(t)) : [];
  return { created, existing: [] };
}

/** Test hook: reset the per-instance cache. */
export function resetSchemaCache(): void {
  ensuredAt = 0;
}
