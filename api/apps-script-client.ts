/* Stockly admin-script client (server-side only).
 *
 * The private admin spreadsheet is touched ONLY through the bound Apps
 * Script project (apps-script/Admin.gs), called here server-to-server.
 * Every call carries ADMIN_SCRIPT_TOKEN (Script Properties on the Google
 * side, Vercel env on this side). The browser never sees the script URL
 * or the token — it only talks to the /api/* routes.
 */

function scriptUrl(): string {
  return (process.env.ADMIN_SCRIPT_URL || '').trim();
}

function scriptToken(): string {
  return process.env.ADMIN_SCRIPT_TOKEN || '';
}

export function adminScriptConfigured(): boolean {
  return Boolean(scriptUrl() && scriptToken());
}

function httpError(message: string, status: number): Error & { status?: number } {
  return Object.assign(new Error(message), { status });
}

/** Raw call to the admin script. Responses are { success, data | error }. */
export async function scriptCall<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = scriptUrl();
  const token = scriptToken();
  if (!url || !token) {
    throw httpError('Private admin storage is not configured on the server.', 501);
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, action, ...payload }),
      redirect: 'follow',
    });
  } catch {
    throw httpError('Admin spreadsheet request failed.', 502);
  }
  let json: { success?: boolean; data?: unknown; error?: unknown };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw httpError('Admin spreadsheet returned a non-JSON response.', 502);
  }
  if (!json || json.success !== true) {
    const msg = typeof json?.error === 'string' && json.error ? json.error : 'Admin spreadsheet request failed.';
    if (/^Unauthorized\.?$/.test(msg)) throw httpError('Unauthorized.', 401);
    if (/Row not found/.test(msg)) throw httpError(msg, 404);
    throw httpError(msg, 502);
  }
  return json.data as T;
}

/** Whole tab as objects keyed by header name. */
export async function scriptReadTab(tab: string): Promise<Record<string, string>[]> {
  const data = await scriptCall<{ headers?: unknown; rows?: unknown }>('readTab', { tab });
  const headers = Array.isArray(data.headers) ? data.headers.map((h) => String(h)) : [];
  const rows = Array.isArray(data.rows) ? data.rows : [];
  return (rows as unknown[][])
    .map((r) => {
      const o: Record<string, string> = {};
      headers.forEach((h, i) => {
        o[h] = r[i] === undefined || r[i] === null ? '' : String(r[i]);
      });
      return o;
    })
    .filter((r) => Object.values(r).some((v) => v !== ''));
}

export async function scriptAppendRow(tab: string, row: (string | number)[]): Promise<void> {
  await scriptCall('appendRow', { tab, row });
}

export async function scriptUpdateRowById(tab: string, id: string, row: (string | number)[]): Promise<void> {
  await scriptCall('updateRow', { tab, id, row });
}
