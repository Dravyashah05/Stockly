import assert from 'node:assert/strict';
import test from 'node:test';
import { interpretApiResponse } from '../src/lib/api-response.ts';
import { isAppsScriptExecUrl } from '../src/lib/config.ts';

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
  assert.equal(isAppsScriptExecUrl('https://script.google.com/macros/s/AKfycb123/exec?x=1'), false);
  assert.equal(isAppsScriptExecUrl('https://example.com/macros/s/AKfycb123/exec'), false);
  assert.equal(isAppsScriptExecUrl('not a url'), false);
});
