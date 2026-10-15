export interface ApiResponseMeta {
  status: number;
  ok: boolean;
  contentType: string;
  url: string;
  redirected: boolean;
  upstreamHost?: string;
}

export type ApiResponseResult =
  | { ok: true; data: unknown }
  | { ok: false; message: string; status?: number; unknownOutcome: boolean };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function failed(message: string, meta: ApiResponseMeta, unknownOutcome = true): ApiResponseResult {
  return { ok: false, message, status: meta.status || undefined, unknownOutcome };
}

function isGoogleAccessPage(meta: ApiResponseMeta, text: string): boolean {
  const sample = text.slice(0, 16_000).toLowerCase();
  let responseHost: string | undefined;
  try {
    responseHost = new URL(
      meta.redirected && meta.upstreamHost ? `https://${meta.upstreamHost}` : meta.url,
    ).hostname;
  } catch {
    responseHost = meta.upstreamHost;
  }
  return (
    responseHost === 'accounts.google.com' ||
    /accounts\.google\.com|servicelogin|request access|sign in to continue|authorization required|you need access/.test(sample)
  );
}

function safeBackendError(message: unknown): string {
  if (typeof message !== 'string') return 'Apps Script rejected the request. Check the request details and database setup.';
  if (/unknown action/i.test(message)) {
    return 'Unknown action on this Apps Script deployment. Deploy the latest Code.gs version and try again.';
  }
  if (/no spreadsheet connected/i.test(message)) {
    return 'Apps Script is reachable, but no spreadsheet is connected. Bind the script to a Sheet or configure its spreadsheet ID.';
  }
  if (/missing tab/i.test(message)) {
    return 'The spreadsheet is missing Stockly database tabs. Run setupDatabase in Apps Script, then try again.';
  }
  if (/invalid json body/i.test(message)) {
    return 'Apps Script could not read the request. Refresh the app and try again.';
  }
  if (/product not found/i.test(message)) {
    return 'That product no longer exists. Sync the latest inventory and try again.';
  }
  if (/account is suspended/i.test(message)) {
    return 'This account is suspended. Contact the owner to reactivate it.';
  }
  if (/account is deactivated/i.test(message)) {
    return 'This account is deactivated. Contact the owner.';
  }
  if (/account is not active|unknown user/i.test(message)) {
    return 'This account cannot make changes right now. Contact the owner.';
  }
  if (/already registered/i.test(message)) {
    return 'This email is already registered. Sign in with it instead.';
  }
  if (/user not found/i.test(message)) {
    return 'Account not found on this database. Register again or contact the owner.';
  }
  if (/sign-in required/i.test(message)) {
    return 'Your session expired. Sign in again.';
  }
  if (/no verified sheet connection|connect your google sheet/i.test(message)) {
    return 'Connect your Google Sheet before using inventory.';
  }
  if (/device is not authorized|device session is (incomplete|no longer valid)|device and account do not match/i.test(message)) {
    return 'This device is not authorized. Re-link it from Settings → Linked Devices.';
  }
  if (/device.*(not linked|unlinked|re-link|no longer valid)|device session is (incomplete|no longer valid)|device and account do not match|no longer linked/i.test(message)) {
    return 'This device is no longer linked. Re-link it from Settings → Linked Devices.';
  }
  if (/could not verify this device/i.test(message)) {
    return 'Could not verify this device right now. Check your connection and try again.';
  }
  // Do not put arbitrary exception text, spreadsheet IDs, or submitted data in UI errors.
  return 'Apps Script rejected the request. Check the entered values and the database setup.';
}

/** Interpret a response without ever returning or logging its raw body. */
export function interpretApiResponse(meta: ApiResponseMeta, text: string): ApiResponseResult {
  if (meta.status === 401 || meta.status === 403) {
    return failed(
      'Google denied access to the Apps Script Web App. Deploy it to execute as you, set access to Anyone, and use its deployed /exec URL.',
      meta,
    );
  }

  if (meta.status === 404 && !meta.upstreamHost) {
    return failed(
      'Stockly’s Vercel API route returned 404. Confirm the deployment includes api/stockly.ts and the /__stockly_api rewrite, then redeploy.',
      meta,
    );
  }

  if (!meta.ok && meta.status >= 500) {
    return failed(
      `The Vercel proxy or Apps Script returned HTTP ${meta.status}. Check Vercel function logs and Apps Script availability, then retry.`,
      meta,
    );
  }

  if (!meta.ok && meta.status === 404) {
    return failed(
      'The configured Apps Script endpoint returned 404. Confirm Settings contains the deployed /exec URL and redeploy the Web App.',
      meta,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    if (isGoogleAccessPage(meta, text)) {
      return failed(
        'Google returned a sign-in or access page instead of the API response. Deploy the Web App to execute as you, set access to Anyone, and save its /exec URL in Settings.',
        meta,
      );
    }
    const html = /html/i.test(meta.contentType) || /^\s*<(?:!doctype\s+html|html|head|body)\b/i.test(text);
    if (html) {
      return failed(
        'The saved URL reached an HTML app page, not Stockly’s API. It may point to another Apps Script project or an outdated deployment. In Settings, use this project’s deployed /exec URL, execute as you, and set access to Anyone.',
        meta,
      );
    }
    const looksJson = /json/i.test(meta.contentType) || /^\s*(?:\{|\[)/.test(text);
    if (looksJson) {
      return failed(
        `The API returned malformed JSON (HTTP ${meta.status}). Redeploy the latest Apps Script code and check the Vercel function logs.`,
        meta,
      );
    }
    return failed(
      `The API returned a non-JSON response (HTTP ${meta.status}). Confirm the deployed /exec URL and check Vercel function logs.`,
      meta,
    );
  }

  if (!meta.ok) {
    return failed(
      `The API returned HTTP ${meta.status}. Check the Apps Script deployment and Vercel function logs, then retry.`,
      meta,
    );
  }

  if (!record(payload) || typeof payload.success !== 'boolean') {
    return failed(
      'The API returned JSON in an unexpected format. Confirm Settings points to Stockly’s deployed /exec endpoint and deploy the latest Code.gs.',
      meta,
    );
  }
  if (payload.success === false) {
    return {
      ok: false,
      message: safeBackendError(payload.error),
      status: meta.status || undefined,
      unknownOutcome: false,
    };
  }
  if (!Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return failed(
      'The API response is missing its data field. Deploy the latest Stockly Code.gs version and try again.',
      meta,
    );
  }
  return { ok: true, data: payload.data };
}
