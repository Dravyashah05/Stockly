import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretApiResponse } from '../src/shared/api-response.ts';
import { isAppsScriptExecUrl } from '../src/shared/config.ts';

function meta(overrides: Partial<Parameters<typeof interpretApiResponse>[0]> = {}) {
  return {
    status: 200,
    ok: true,
    contentType: 'application/json; charset=utf-8',
    url: 'https://stockly.example/__stockly_api',
    redirected: false,
    upstreamHost: 'script.googleusercontent.com',
    ...overrides,
  };
}

test('accepts the Stockly JSON success envelope', () => {
  const result = interpretApiResponse(meta(), '{"success":true,"data":{"version":"1.0.2"}}');
  assert.deepEqual(result, { ok: true, data: { version: '1.0.2' } });
});

test('classifies HTTP permission failures without returning the body', () => {
  const result = interpretApiResponse(
    meta({ status: 403, ok: false, contentType: 'text/html' }),
    '<html>private page contents</html>',
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /execute as you.*Anyone.*\/exec/i);
  assert.doesNotMatch(result.message, /private page contents/);
  assert.equal(result.status, 403);
});

test('classifies a Google sign-in page delivered with HTTP 200', () => {
  const result = interpretApiResponse(
    meta({ contentType: 'text/html' }),
    '<html><a href="https://accounts.google.com/ServiceLogin">Sign in</a></html>',
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /sign-in or access page/i);
  assert.doesNotMatch(result.message, /ServiceLogin/);
});

test('distinguishes unexpected HTML from a Google access page', () => {
  const result = interpretApiResponse(meta({ contentType: 'text/html' }), '<html><body>Vercel 404</body></html>');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /HTML app page, not Stockly’s API/i);
  assert.match(result.message, /\/exec/);
});

test('classifies malformed JSON without surfacing its contents', () => {
  const result = interpretApiResponse(meta(), '{"success":true,"secret":"sheet-data"');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /malformed JSON/i);
  assert.doesNotMatch(result.message, /sheet-data/);
});

test('provides an actionable message for proxy and Apps Script server errors', () => {
  const result = interpretApiResponse(meta({ status: 502, ok: false }), '{"success":false,"error":"secret detail"}');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /HTTP 502.*Vercel function logs/i);
  assert.doesNotMatch(result.message, /secret detail/);
  assert.equal(result.unknownOutcome, true);
});

test('maps Apps Script exceptions to safe actionable messages', () => {
  const result = interpretApiResponse(meta(), '{"success":false,"error":"No spreadsheet connected: PRIVATE_ID"}');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /no spreadsheet is connected/i);
  assert.doesNotMatch(result.message, /PRIVATE_ID/);
  assert.equal(result.unknownOutcome, false);
});

test('preserves the legacy sync fallback for old Apps Script deployments', () => {
  const result = interpretApiResponse(meta(), '{"success":false,"error":"Unknown action: sync"}');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /unknown action/i);
  assert.match(result.message, /Deploy the latest Code\.gs/);
});

test('accepts only deployed Apps Script /exec URLs', () => {
  assert.equal(isAppsScriptExecUrl('https://script.google.com/macros/s/AKfycb123/exec'), true);
  assert.equal(isAppsScriptExecUrl('https://script.google.com/macros/s/AKfycb123/dev'), false);
  assert.equal(isAppsScriptExecUrl('https://script.google.com:444/macros/s/AKfycb123/exec'), false);
  assert.equal(isAppsScriptExecUrl('https://script.google.com/macros/s/AKfycb123/exec?x=1'), false);
  assert.equal(isAppsScriptExecUrl('https://example.com/macros/s/AKfycb123/exec'), false);
  assert.equal(isAppsScriptExecUrl('not a url'), false);
});

test('detects a Google sign-in redirect via upstream host headers', () => {
  // Production Vercel proxy follows Google's redirect and reports the final
  // host: a login-gated deployment lands on accounts.google.com with HTTP 200.
  const result = interpretApiResponse(
    meta({ redirected: true, upstreamHost: 'accounts.google.com', contentType: 'text/html' }),
    '<html><body>generic login page without keywords</body></html>',
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /sign-in or access page/i);
  assert.equal(result.unknownOutcome, true);
});

test('reports unauthenticated HTTP 401 as a deployment access problem', () => {
  const result = interpretApiResponse(
    meta({ status: 401, ok: false, contentType: 'text/html' }),
    '<html>secret gated content</html>',
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /execute as you.*Anyone/i);
  assert.doesNotMatch(result.message, /secret gated content/);
  assert.equal(result.status, 401);
});

test('reports a missing Vercel API route distinctly from a bad exec URL', () => {
  const missingRoute = interpretApiResponse(
    meta({ status: 404, ok: false, upstreamHost: undefined }),
    'Cannot GET /__stockly_api',
  );
  assert.equal(missingRoute.ok, false);
  if (missingRoute.ok) return;
  assert.match(missingRoute.message, /Vercel API route.*404/i);

  const badExec = interpretApiResponse(
    meta({ status: 404, ok: false, upstreamHost: 'script.googleusercontent.com' }),
    'Not found',
  );
  assert.equal(badExec.ok, false);
  if (badExec.ok) return;
  assert.match(badExec.message, /deployed \/exec URL/i);
});

test('classifies plain-text failures without leaking the body', () => {
  const result = interpretApiResponse(
    meta({ status: 200, ok: true, contentType: 'text/plain' }),
    'Service unavailable: internal sheet SECRET_ID',
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /non-JSON response/i);
  assert.doesNotMatch(result.message, /SECRET_ID/);
});

test('rejects JSON in an unexpected shape without leaking contents', () => {
  const result = interpretApiResponse(meta(), '["secret", "sheet-data"]');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /unexpected format/i);
  assert.doesNotMatch(result.message, /sheet-data/);
});

test('rejects a success envelope missing its data field', () => {
  const result = interpretApiResponse(meta(), '{"success":true}');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /missing its data field/i);
});

test('maps unknown Apps Script errors to a generic safe message', () => {
  const result = interpretApiResponse(meta(), '{"success":false,"error":"Exception: sheet SECRET_XYZ blew up"}');
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.message, /rejected the request/i);
  assert.doesNotMatch(result.message, /SECRET_XYZ/);
  assert.equal(result.unknownOutcome, false);
});

test('Apps Script backend implements the frontend contract (read-only check)', async () => {
  // Static contract check only: reads Code.gs, never executes it and never
  // touches spreadsheet data. Fails if the backend drops an action the
  // frontend actually requests (api.ts) or changes the JSON envelope.
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const action of ['health', 'listProducts', 'getProduct', 'listCategories', 'listTransactions', 'dashboard', 'sync']) {
    assert.match(code, new RegExp(`case '${action}'`), `doGet must handle '${action}'`);
  }
  for (const action of ['createProduct', 'updateProduct', 'deleteProduct', 'createCategory', 'updateCategory', 'deleteCategory', 'stockIn', 'stockOut']) {
    assert.match(code, new RegExp(`case '${action}'`), `doPost must handle '${action}'`);
  }
  assert.match(code, /\{\s*success:\s*true,\s*data/, 'backend must return { success: true, data }');
  assert.match(code, /\{\s*success:\s*false,\s*error/, 'backend must return { success: false, error }');
  assert.doesNotMatch(code, /script\.google\.com\/macros\/s\/.+\/exec/, 'backend must not hardcode a deployment URL');
});
