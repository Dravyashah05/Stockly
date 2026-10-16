import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLogEntry,
  createMemoryStore,
  createSessionToken,
  isValidAccountStatus,
  isValidRole,
  logIdFor,
  secretsEqual,
  signStatusEnvelope,
  verifySessionToken,
  verifyStatusEnvelope,
} from '../api/admin-logic.ts';

const SECRET = 'test-session-secret-0123456789';
const MIRROR = 'test-mirror-secret-0123456789';

test('admin session tokens verify, and tampered tokens fail', () => {
  const token = createSessionToken({ adminId: 'adm_abc12345', email: 'Owner@Example.com', role: 'owner' }, SECRET);
  const session = verifySessionToken(token, SECRET);
  assert.ok(session);
  assert.equal(session?.email, 'owner@example.com');
  assert.equal(session?.role, 'owner');

  // Tampered payload must not verify.
  const [body, sig] = token.split('.');
  void sig;
  const forged = `${body.slice(0, -2)}AA.${token.split('.')[1]}`;
  assert.equal(verifySessionToken(forged, SECRET), null);
  // Wrong secret must not verify (a normal user cannot mint admin access).
  assert.equal(verifySessionToken(token, 'wrong-secret'), null);
  // Garbage is rejected, not thrown.
  assert.equal(verifySessionToken('not-a-token', SECRET), null);
  assert.equal(verifySessionToken(null, SECRET), null);
});

test('expired admin sessions are rejected', () => {
  const token = createSessionToken({ adminId: 'adm_abc12345', email: 'o@e.com', role: 'admin' }, SECRET, -1000);
  assert.equal(verifySessionToken(token, SECRET), null);
});

test('setup-key comparison is exact', () => {
  assert.equal(secretsEqual('correct-key', 'correct-key'), true);
  assert.equal(secretsEqual('correct-key', 'wrong-key!'), false);
  assert.equal(secretsEqual('correct-key', ''), false);
});

test('status envelopes verify and detect forgery', () => {
  const env = signStatusEnvelope('usr_test1234', 'suspended', MIRROR, '2026-05-01T00:00:00.000Z');
  assert.equal(verifyStatusEnvelope(env, MIRROR), true);
  // A normal user cannot escalate themselves: flipping the status breaks the signature.
  assert.equal(verifyStatusEnvelope({ ...env, accountStatus: 'active' }, MIRROR), false);
  assert.equal(verifyStatusEnvelope(env, 'wrong-secret'), false);
});

test('only owner/admin roles and known statuses are accepted', () => {
  assert.equal(isValidRole('owner'), true);
  assert.equal(isValidRole('admin'), true);
  assert.equal(isValidRole('superuser'), false);
  assert.equal(isValidRole(''), false);
  assert.equal(isValidAccountStatus('active'), true);
  assert.equal(isValidAccountStatus('suspended'), true);
  assert.equal(isValidAccountStatus('deactivated'), true);
  assert.equal(isValidAccountStatus('banned'), false);
});

test('idempotency keys map to deterministic log ids (replay protection)', () => {
  const key = '550e8400-e29b-41d4-a716-446655440000';
  assert.equal(logIdFor(key, 'log_fallback'), logIdFor(key, 'log_other'));
  assert.ok(logIdFor(key, 'log_fallback').startsWith('log_'));
  assert.equal(logIdFor('short', 'log_fallback'), 'log_fallback');
  assert.equal(logIdFor(undefined, 'log_fallback'), 'log_fallback');
});

test('audit entries never carry secrets, only ids and values', () => {
  const entry = buildLogEntry({
    logId: 'log_1',
    adminId: 'adm_1',
    action: 'user.suspend',
    targetUserId: 'usr_1',
    previousValue: 'active',
    newValue: 'suspended',
  });
  assert.equal(entry.action, 'user.suspend');
  assert.equal(entry.targetUserId, 'usr_1');
  const blob = JSON.stringify(entry);
  assert.doesNotMatch(blob, /setup-key|private_key|Bearer/i);
});

test('suspension/reactivation round-trips through the store without duplicates', async () => {
  const store = createMemoryStore({
    registry: [
      {
        userId: 'usr_round1234',
        name: 'Reena',
        email: 'reena@example.com',
        accountStatus: 'active',
        registeredAt: '2026-01-01T00:00:00.000Z',
        lastLoginAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  });
  const before = await store.getRegistry('usr_round1234');
  assert.equal(before?.accountStatus, 'active');
  await store.upsertRegistry({ ...before!, accountStatus: 'suspended', updatedAt: '2026-02-01T00:00:00.000Z' });
  assert.equal((await store.getRegistry('usr_round1234'))?.accountStatus, 'suspended');
  await store.upsertRegistry({ ...before!, accountStatus: 'active', updatedAt: '2026-03-01T00:00:00.000Z' });
  assert.equal((await store.getRegistry('usr_round1234'))?.accountStatus, 'active');
  assert.equal((await store.listRegistry()).length, 1);
});

test('unauthorized callers get no session without the server secret', () => {
  // Simulates a normal user forging a token-shaped string: verification needs
  // the server-side ADMIN_SESSION_SECRET they never see.
  assert.equal(verifySessionToken('eyJhZG1pbklkIjoieCJ9.fakesig', SECRET), null);
});

test('adminLogin and bootstrap throttle setup-key guessing per IP', async () => {
  const { default: handler } = await import('../api/admin.ts');
  process.env.ADMIN_SETUP_KEY = 'correct-horse-setup-key';
  process.env.ADMIN_SESSION_SECRET = 'test-admin-session-secret-xyz';
  async function call(action: string, ip: string) {
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
    };
    await handler(
      { method: 'POST', headers: { 'x-forwarded-for': ip }, body: { action, setupKey: 'wrong-key' } },
      res,
    );
    return { status, payload };
  }
  async function expectThrottled(action: string) {
    // Random TEST-NET IP per action so the per-IP buckets never collide
    // with other runs in the same process.
    const ip = `203.0.113.${1 + Math.floor(Math.random() * 200)}`;
    for (let i = 0; i < 10; i++) {
      const r = await call(action, ip);
      assert.equal(r.status, 401, `${action}: wrong setup key must fail closed before the limit`);
    }
    const limited = await call(action, ip);
    assert.equal(limited.status, 429);
    assert.match(String((limited.payload as { error?: unknown })?.error ?? ''), /too many attempts/i);
  }
  await expectThrottled('adminLogin');
  await expectThrottled('bootstrap');
});
