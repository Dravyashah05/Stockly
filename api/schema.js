const SCHEMA_TABS = {
  AdminUsers: ["adminId", "email", "role", "status", "createdAt", "updatedAt"],
  UserRegistry: ["userId", "name", "email", "accountStatus", "registeredAt", "lastLoginAt", "updatedAt"],
  AdminLogs: ["logId", "adminId", "action", "targetUserId", "previousValue", "newValue", "timestamp"],
  AppSettings: ["key", "value", "updatedAt"],
  DeviceLinks: ["linkId", "userId", "tokenHash", "method", "status", "expiresAt", "attempts", "claimant", "createdAt", "updatedAt"],
  Devices: ["deviceId", "userId", "name", "platform", "appInfo", "status", "linkedAt", "lastActiveAt"],
  UserAuth: ["userId", "email", "name", "passwordHash", "providers", "createdAt", "updatedAt"],
  UserSheets: ["userId", "spreadsheetId", "execUrl", "status", "verifiedAt", "updatedAt"]
};
import { adminScriptConfigured, scriptCall } from "./apps-script-client.js";
let ensuredAt = 0;
const ENSURE_TTL_MS = 10 * 60 * 1e3;
async function ensureSchemaCached() {
  if (!adminScriptConfigured()) return null;
  if (Date.now() - ensuredAt < ENSURE_TTL_MS) return null;
  const result = await scriptCall("setupSchema");
  ensuredAt = Date.now();
  const created = Array.isArray(result.created) ? result.created.map((t) => String(t)) : [];
  return { created, existing: [] };
}
function resetSchemaCache() {
  ensuredAt = 0;
}
export {
  SCHEMA_TABS,
  ensureSchemaCached,
  resetSchemaCache
};
