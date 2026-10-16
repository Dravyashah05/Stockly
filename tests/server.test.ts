import assert from 'node:assert/strict';
import test from 'node:test';

// The server module listens on import unless NODE_ENV=test (same guard the
// dev runner relies on). Set it before the first import, restore after.
const prevNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = 'test';
const { missingEnvVars } = await import('../server/src/index.ts');
if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = prevNodeEnv;

const FULL = {
  ADMIN_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec',
  ADMIN_SCRIPT_TOKEN: 'token',
  ADMIN_SETUP_KEY: 'setup',
  ADMIN_SESSION_SECRET: 'a',
  DEVICE_SESSION_SECRET: 'b',
  AUTH_SESSION_SECRET: 'c',
};

test('startup env check reports missing secret names only', () => {
  assert.deepEqual(missingEnvVars({ ...FULL }), []);
  assert.deepEqual(missingEnvVars({}), [
    'ADMIN_SCRIPT_URL',
    'ADMIN_SCRIPT_TOKEN',
    'ADMIN_SETUP_KEY',
    'ADMIN_SESSION_SECRET',
    'DEVICE_SESSION_SECRET',
    'AUTH_SESSION_SECRET',
  ]);
  assert.deepEqual(missingEnvVars({ ...FULL, AUTH_SESSION_SECRET: '   ' }), ['AUTH_SESSION_SECRET']);
  // Values are never echoed — only names.
  const names = missingEnvVars({ ...FULL, ADMIN_SETUP_KEY: 's3cr3t-value' });
  assert.deepEqual(names, []);
});

test('server module loads without listening in test scope', async () => {
  const mod = await import('../server/src/index.ts');
  assert.equal(typeof mod.createApp, 'function');
  assert.equal(typeof mod.missingEnvVars, 'function');
});

test('legacy apps-script proxy throttles per IP without touching upstream', async () => {
  const { default: handler } = await import('../api/stockly.ts');
  const ip = `198.51.100.${1 + Math.floor(Math.random() * 200)}`;
  async function call() {
    let status = 0;
    let payload: unknown;
    const res = {
      status(code: number) {
        status = code;
        return res;
      },
      setHeader() {},
      json(body: unknown) {
        payload = body;
      },
      send(body: unknown) {
        payload = body;
      },
    };
    await handler(
      { method: 'POST', headers: { 'x-forwarded-for': ip }, query: { target: 'https://example.com/not-an-exec-url' }, body: {} },
      res,
    );
    return { status, payload };
  }
  for (let i = 0; i < 60; i++) {
    const r = await call();
    assert.equal(r.status, 400, 'invalid target is rejected before any upstream fetch');
  }
  const limited = await call();
  assert.equal(limited.status, 429);
  assert.match(String((limited.payload as { error?: unknown })?.error ?? ''), /too many requests/i);
});
