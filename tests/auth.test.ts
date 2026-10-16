import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAuthSession,
  createMemoryAuthStore,
  fingerprint,
  hashPassword,
  isValidAuthEmail,
  newAuthUserId,
  normalizeAuthEmail,
  parseProviders,
  parseSheetInput,
  serializeProviders,
  validateDisplayName,
  validatePassword,
  verifyAuthSession,
  verifyPassword,
  type AuthUser,
} from '../api/auth-logic.ts';

const SECRET = 'test-auth-secret-0123456789abcdef';

function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  const now = new Date().toISOString();
  return {
    userId: 'usr_test1234abcd',
    email: 'asha@example.com',
    name: 'Asha',
    passwordHash: hashPassword('Secret123'),
    providers: ['password'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('passwords hash uniquely and verify correctly', () => {
  const a = hashPassword('Secret123');
  const b = hashPassword('Secret123');
  assert.notEqual(a, b);
  assert.match(a, /^scrypt\$v1\$/);
  assert.equal(verifyPassword('Secret123', a), true);
  assert.equal(verifyPassword('secret123', a), false);
  assert.equal(verifyPassword('', a), false);
  assert.equal(verifyPassword('Secret123', 'not-a-hash'), false);
  assert.equal(verifyPassword('Secret123', ''), false);
  // Stored form never contains the plaintext.
  assert.doesNotMatch(a, /Secret123/);
});

test('password policy rejects weak secrets', () => {
  assert.throws(() => validatePassword('short1'), /at least 8/);
  assert.throws(() => validatePassword('alllettersno'), /letters and numbers/);
  assert.throws(() => validatePassword('123456789'), /letters and numbers/);
  assert.equal(validatePassword('Good1234'), 'Good1234');
  assert.throws(() => validateDisplayName('   '), /name/i);
  assert.throws(() => validateDisplayName('x'.repeat(81)), /too long/);
  assert.equal(isValidAuthEmail('A@Example.COM'), true);
  assert.equal(normalizeAuthEmail('A@Example.COM '), 'a@example.com');
  assert.equal(isValidAuthEmail('nope'), false);
});

test('auth sessions verify; forged and expired sessions fail', () => {
  const token = createAuthSession('usr_test1234abcd', SECRET);
  const session = verifyAuthSession(token, SECRET);
  assert.ok(session);
  assert.equal(session?.userId, 'usr_test1234abcd');
  const parts = token.split('.');
  assert.equal(verifyAuthSession(parts[0].slice(0, -2) + 'AA.' + parts[1], SECRET), null);
  assert.equal(verifyAuthSession(token, 'wrong-secret'), null);
  assert.equal(verifyAuthSession('garbage', SECRET), null);
  assert.equal(verifyAuthSession(createAuthSession('usr_test1234abcd', SECRET, -1000), SECRET), null);
});

test('provider columns round-trip tolerantly (legacy values preserved read-only)', () => {
  assert.deepEqual(parseProviders('password,google'), ['password', 'google']);
  assert.deepEqual(parseProviders(' google ,google,,bogus'), ['google']);
  assert.deepEqual(parseProviders(null), []);
  assert.equal(serializeProviders(['google', 'password', 'google']), 'google,password');
});

test('memory auth store isolates accounts by id and normalized email', async () => {
  const store = createMemoryAuthStore([authUser()]);
  assert.ok(await store.findByEmail('ASHA@EXAMPLE.COM'));
  assert.equal(await store.findByEmail('nobody@example.com'), null);
  assert.ok(await store.findById('usr_test1234abcd'));
  const second = authUser({ userId: newAuthUserId(), email: 'bala@example.com', providers: ['password'], passwordHash: hashPassword('Other1234') });
  await store.create(second);
  assert.equal(await store.count(), 2);
  assert.notEqual((await store.findById(second.userId))?.email, (await store.findById('usr_test1234abcd'))?.email);
});

test('sheet input parsing accepts exec deployments, rejects the rest', () => {
  const exec = parseSheetInput('https://script.google.com/macros/s/AKfycb1234567890/exec');
  assert.ok(exec && exec.kind === 'exec' && exec.id === 'AKfycb1234567890');
  const sheet = parseSheetInput('https://docs.google.com/spreadsheets/d/1AbCdefGhIjKlMnOpQrSt/edit#gid=0');
  assert.ok(sheet && sheet.kind === 'sheets' && sheet.id === '1AbCdefGhIjKlMnOpQrSt');
  for (const bad of [
    'https://script.google.com/macros/s/AKfycb123/dev',
    'https://script.google.com/macros/s/AKfycb123/exec?x=1',
    'http://script.google.com/macros/s/AKfycb123/exec',
    'https://example.com/spreadsheets/d/1AbCdefGhIjKlMnOpQrSt/edit',
    'https://docs.google.com/spreadsheets/d/short/edit',
    'not a url',
    '',
  ]) {
    assert.equal(parseSheetInput(bad), null);
  }
});

test('user isolation: one user cannot resolve another user record', async () => {
  const store = createMemoryAuthStore([
    authUser(),
    authUser({ userId: 'usr_other5678efgh', email: 'other@example.com' }),
  ]);
  const a = await store.findById('usr_test1234abcd');
  const b = await store.findById('usr_other5678efgh');
  assert.ok(a && b && a.userId !== b.userId);
  // Sessions are bound to a single userId; cross-use fails closed.
  const tokenA = createAuthSession(a.userId, SECRET);
  const session = verifyAuthSession(tokenA, SECRET);
  assert.ok(session && session.userId !== b.userId);
});

test('fingerprints are stable and reveal nothing', () => {
  assert.equal(fingerprint('x'), fingerprint('x'));
  assert.notEqual(fingerprint('x'), fingerprint('y'));
  assert.match(fingerprint('x'), /^[0-9a-f]{16}$/);
});

test('Apps Script exposes describe + idempotent setup for verification', async () => {
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  assert.match(code, /case 'describe'/);
  assert.match(code, /function describe_\(\)/);
  assert.match(code, /spreadsheetId/);
  assert.match(code, /case 'setupDatabase'/);
});

test('Google sign-in is fully removed (server + client)', async () => {
  const { readFileSync } = await import('node:fs');
  const route = readFileSync(new URL('../api/auth.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(route, /googleLogin|verifyGoogleIdToken|GoogleTokenInfo|GOOGLE_CLIENT_ID|resolveGoogleAccount/);
  const logic = readFileSync(new URL('../api/auth-logic.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(logic, /resolveGoogleAccount|verifyGoogleIdToken|tokeninfo/);
  const client = readFileSync(new URL('../shared/auth.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(client, /googleLogin|gsi\/client|renderGoogleButton|loadGoogleIdentity/);
  const screen = readFileSync(new URL('../src/app/screens/AuthScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(screen, /googleLogin|Google sign-in|continue with Google|gsi\/client|GOOGLE_CLIENT_ID|loginWithGoogle/);
  const config = readFileSync(new URL('../shared/config.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(config, /VITE_GOOGLE_CLIENT_ID/);
});

test('inventory client never holds or forwards raw exec URLs', async () => {  const { readFileSync } = await import('node:fs');
  const api = readFileSync(new URL('../shared/api.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(api, /script\.google\.com/);
  assert.doesNotMatch(api, /getApiUrl|LS_KEYS\.apiUrl/);
  assert.match(api, /\/api\/sheets/);
  assert.match(api, /X-Device-Session/);
  const store = readFileSync(new URL('../shared/store.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /setApiUrl|getApiUrl\(\)/);
});

test('login verifies against the stored hash, and guards bind one account', async () => {  const { readFileSync } = await import('node:fs');
  const route = readFileSync(new URL('../api/auth.ts', import.meta.url), 'utf8');
  assert.match(route, /verifyPassword\(password, user\.passwordHash\)/);
  assert.match(route, /Incorrect email or password/);
  const gateway = readFileSync(new URL('../api/sheets.ts', import.meta.url), 'utf8');
  assert.match(gateway, /delete payload\.userId/);
  assert.match(gateway, /k !== 'action'/);
  assert.match(gateway, /reason.*sheet-not-connected|sheet-not-connected.*reason/);
});

test('native builds route API calls to the deployed backend; web stays same-origin', async () => {
  const config = await import('../shared/config.ts');
  assert.equal(typeof config.apiUrl, 'function');
  assert.equal(config.apiUrl('/api/auth'), '/api/auth');
  const { readFileSync } = await import('node:fs');
  for (const f of ['../shared/api.ts', '../shared/auth.ts', '../shared/connection.ts', '../shared/devices.ts', '../shared/admin-api.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(src, /fetch\(apiUrl\(/, f + ' must route through apiUrl()');
  }
});

test('API routes answer CORS preflight for native WebViews', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['../api/auth.ts', '../api/sheets.ts', '../api/devices.ts', '../api/admin.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(src, /applyApiCors\(req, res\)/, f + ' must use the shared origin policy');
    assert.match(src, /req\.method === 'OPTIONS'/, f + ' must answer preflight');
  }
  const cors = readFileSync(new URL('../api/cors.ts', import.meta.url), 'utf8');
  assert.match(cors, /Access-Control-Allow-Origin/);
  assert.match(cors, /X-Device-Session/);
  assert.match(cors, /capacitor:\/\/localhost/);
  assert.doesNotMatch(cors, /'\*'/, 'CORS must not allow every origin');
});

test('every gate phase hides the native splash screen', async () => {
  const { readFileSync } = await import('node:fs');
  const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8');
  const gateBlock = app.slice(app.indexOf('function Gate()'));
  assert.ok(/SplashScreen/.test(gateBlock) && /hide\(\)/.test(gateBlock));
});

test('admin schema defines every required tab with exact headers', async () => {
  const { SCHEMA_TABS } = await import('../api/schema.ts');
  const expected: Record<string, string[]> = {
    AdminUsers: ['adminId', 'email', 'role', 'status', 'createdAt', 'updatedAt'],
    UserRegistry: ['userId', 'name', 'email', 'accountStatus', 'registeredAt', 'lastLoginAt', 'updatedAt'],
    AdminLogs: ['logId', 'adminId', 'action', 'targetUserId', 'previousValue', 'newValue', 'timestamp'],
    AppSettings: ['key', 'value', 'updatedAt'],
    DeviceLinks: ['linkId', 'userId', 'tokenHash', 'method', 'status', 'expiresAt', 'attempts', 'claimant', 'createdAt', 'updatedAt'],
    Devices: ['deviceId', 'userId', 'name', 'platform', 'appInfo', 'status', 'linkedAt', 'lastActiveAt'],
    UserAuth: ['userId', 'email', 'name', 'passwordHash', 'providers', 'createdAt', 'updatedAt'],
    UserSheets: ['userId', 'spreadsheetId', 'execUrl', 'status', 'verifiedAt', 'updatedAt'],
  };
  assert.deepEqual(Object.keys(SCHEMA_TABS).sort(), Object.keys(expected).sort());
  for (const [tab, headers] of Object.entries(expected)) {
    assert.deepEqual([...SCHEMA_TABS[tab]], headers, tab + ' headers must match exactly');
  }
});

test('schema provisioning delegates tab creation to the admin script (cached)', async () => {
  const { ensureSchemaCached, resetSchemaCache } = await import('../api/schema.ts');
  resetSchemaCache();
  const calls: { url: string; init?: RequestInit }[] = [];
  const realFetch = globalThis.fetch;
  (globalThis as unknown as { fetch: unknown }).fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(String((init as { body?: unknown })?.body ?? '{}')) as Record<string, unknown>;
    } catch {
      body = {};
    }
    if (body.action === 'setupSchema') {
      return { ok: true, json: () => Promise.resolve({ success: true, data: { created: ['UserAuth', 'UserSheets'] } }) };
    }
    return { ok: false, status: 500, json: () => Promise.resolve({ success: false }) };
  }) as typeof fetch;
  const prevUrl = process.env.ADMIN_SCRIPT_URL;
  const prevToken = process.env.ADMIN_SCRIPT_TOKEN;
  process.env.ADMIN_SCRIPT_URL = 'https://script.google.com/macros/s/TEST/exec';
  process.env.ADMIN_SCRIPT_TOKEN = 'test-token-0123456789abcdef';
  try {
    const first = await ensureSchemaCached();
    assert.ok(first);
    assert.deepEqual(first?.created, ['UserAuth', 'UserSheets']);
    // One script call only — the Admin.gs project owns tab creation.
    assert.equal(calls.length, 1);
    assert.ok(String(calls[0].url).includes('/macros/s/TEST/exec'));
    assert.ok(String(calls[0].init?.body).includes('setupSchema'));
    // The token travels in the POST body (server-to-server), never in the URL.
    assert.doesNotMatch(String(calls[0].url), /test-token/);
    // Cached: second call performs no network.
    const second = await ensureSchemaCached();
    assert.equal(second, null);
    assert.equal(calls.length, 1);
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
    if (prevUrl === undefined) delete process.env.ADMIN_SCRIPT_URL;
    else process.env.ADMIN_SCRIPT_URL = prevUrl;
    if (prevToken === undefined) delete process.env.ADMIN_SCRIPT_TOKEN;
    else process.env.ADMIN_SCRIPT_TOKEN = prevToken;
    resetSchemaCache();
  }
});

test('Admin.gs guards every action with the server token and stores no secrets', async () => {
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../apps-script/Admin.gs', import.meta.url), 'utf8');
  assert.match(code, /function setAdminScriptToken/);
  assert.match(code, /requireToken_\(body\.token\)/);
  assert.match(code, /case 'setupSchema'/);
  assert.match(code, /case 'readTab'/);
  assert.match(code, /case 'appendRow'/);
  assert.match(code, /case 'updateRow'/);
  // Exactly one secret is ever persisted (the server token, owner-set);
  // nothing else is written to Script Properties or sheet cells as secrets.
  assert.equal((code.match(/setProperty/g) ?? []).length, 1);
  assert.doesNotMatch(code, /AKfyc/);
  // Script headers must match the server contract exactly.
  const { SCHEMA_TABS } = await import('../api/schema.ts');
  for (const [tab, headers] of Object.entries(SCHEMA_TABS)) {
    assert.match(code, new RegExp(tab + ": \\['" + [...headers].join("', '") + "'\\]"), tab + ' headers must match');
  }
});

test('upstream timeout budget is tunable within safe bounds', async () => {
  const { upstreamTimeoutMs, isUpstreamTimeout } = await import('../api/upstream.ts');
  const prev = process.env.STOCKLY_UPSTREAM_TIMEOUT_MS;
  try {
    delete process.env.STOCKLY_UPSTREAM_TIMEOUT_MS;
    assert.equal(upstreamTimeoutMs(), 50_000);
    process.env.STOCKLY_UPSTREAM_TIMEOUT_MS = '7000';
    assert.equal(upstreamTimeoutMs(), 7000);
    process.env.STOCKLY_UPSTREAM_TIMEOUT_MS = '1000';
    assert.equal(upstreamTimeoutMs(), 5000, 'clamped to the floor');
    process.env.STOCKLY_UPSTREAM_TIMEOUT_MS = '9999999';
    assert.equal(upstreamTimeoutMs(), 120_000, 'clamped to the ceiling');
    process.env.STOCKLY_UPSTREAM_TIMEOUT_MS = 'not-a-number';
    assert.equal(upstreamTimeoutMs(), 50_000, 'garbage falls back to default');
  } finally {
    if (prev === undefined) delete process.env.STOCKLY_UPSTREAM_TIMEOUT_MS;
    else process.env.STOCKLY_UPSTREAM_TIMEOUT_MS = prev;
  }
  assert.equal(isUpstreamTimeout(new DOMException('x', 'TimeoutError')), true);
  assert.equal(isUpstreamTimeout(new Error('nope')), false);
  assert.equal(isUpstreamTimeout('TimeoutError'), false);
});

test('admin-script calls carry an abort signal and map timeouts to 502', async () => {
  const { scriptCall } = await import('../api/apps-script-client.ts');
  const realFetch = globalThis.fetch;
  let seenSignal: unknown;
  (globalThis as unknown as { fetch: unknown }).fetch = (async (_url: unknown, init?: RequestInit) => {
    seenSignal = init?.signal;
    throw new DOMException('The operation timed out', 'TimeoutError');
  }) as typeof fetch;
  const prevUrl = process.env.ADMIN_SCRIPT_URL;
  const prevToken = process.env.ADMIN_SCRIPT_TOKEN;
  process.env.ADMIN_SCRIPT_URL = 'https://script.google.com/macros/s/TEST/exec';
  process.env.ADMIN_SCRIPT_TOKEN = 'test-token-0123456789abcdef';
  try {
    await assert.rejects(() => scriptCall('readTab', { tab: 'UserAuth' }), (e: unknown) => {
      const err = e as { status?: unknown; message?: unknown };
      assert.equal(err.status, 502);
      assert.match(String(err.message), /timed out/i);
      return true;
    });
    assert.ok(seenSignal instanceof AbortSignal, 'every upstream call races a timeout signal');
  } finally {
    (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
    if (prevUrl === undefined) delete process.env.ADMIN_SCRIPT_URL;
    else process.env.ADMIN_SCRIPT_URL = prevUrl;
    if (prevToken === undefined) delete process.env.ADMIN_SCRIPT_TOKEN;
    else process.env.ADMIN_SCRIPT_TOKEN = prevToken;
  }
});
