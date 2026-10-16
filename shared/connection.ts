/* User-sheet connection client (browser side).
 *
 * Talks ONLY to the same-origin trusted route `/api/sheets`. The verified
 * spreadsheet association lives server-side; the browser only submits a
 * candidate URL for verification and reads back status. It never holds,
 * stores, or forwards an exec URL — inventory calls go through the same
 * gateway, which resolves the target from the authenticated session.
 */

import { SHEETS_API_ROUTE, apiUrl } from './config';
import { getAuthSession } from './auth';
import { getDeviceSession } from './devices';

export type SheetConnState = 'verified' | 'failed' | 'revoked';

export interface SheetConnection {
  connected: boolean;
  status: SheetConnState | null;
  spreadsheetId: string | null;
  verifiedAt: string | null;
  version?: string;
}

export class SheetsApiError extends Error {
  status?: number;
  reason?: string;
  constructor(message: string, status?: number, reason?: string) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
    this.reason = reason;
  }
}

function authedHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const session = getAuthSession();
  if (!session) throw new SheetsApiError('Sign-in required.', 401);
  headers.Authorization = `Bearer ${session}`;
  const deviceSession = getDeviceSession();
  if (deviceSession) headers['X-Device-Session'] = deviceSession;
  return headers;
}

async function callSheets<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(SHEETS_API_ROUTE), {
      method: 'POST',
      headers: authedHeaders(),
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {
    throw new SheetsApiError('Could not reach the sheet service. Check your connection and deployment.');
  }
  let json: { success?: boolean; data?: unknown; error?: unknown; reason?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new SheetsApiError(`Sheet service returned HTTP ${res.status}.`, res.status);
  }
  if (!json.success) {
    const msg = typeof json.error === 'string' && json.error ? json.error : `Request failed (HTTP ${res.status}).`;
    throw new SheetsApiError(msg, res.status, typeof json.reason === 'string' ? json.reason : undefined);
  }
  return json.data as T;
}

export const sheetsApi = {
  getConnection: () => callSheets<SheetConnection>('getConnection'),
  connectSheet: (execUrl: string) =>
    callSheets<SheetConnection & { version: string }>('connectSheet', { execUrl }),
  reverify: () => callSheets<SheetConnection & { version: string }>('reverify'),
};
