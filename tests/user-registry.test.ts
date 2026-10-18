import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computeUserStats,
  filterRegistry,
  mergeRegistryUser,
  validateRegistryInput,
  type RegistryUser,
} from '../api/admin-logic.ts';

function user(overrides: Partial<RegistryUser> = {}): RegistryUser {
  return {
    userId: 'usr_test1234',
    name: 'Asha',
    email: 'asha@example.com',
    accountStatus: 'active',
    registeredAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

test('registration input requires a stable userId, name, and valid email', () => {
  const ok = validateRegistryInput({ userId: 'usr_abc12345', name: '  Asha  K ', email: 'ASHA@Example.com ' });
  assert.equal(ok.userId, 'usr_abc12345');
  assert.equal(ok.name, 'Asha K');
  assert.equal(ok.email, 'asha@example.com');
  for (const bad of [
    { userId: '', name: 'A', email: 'a@b.c' },
    { userId: 'short', name: 'A', email: 'a@b.c' },
    { userId: 'usr_abc12345', name: '', email: 'a@b.c' },
    { userId: 'usr_abc12345', name: 'A', email: 'not-an-email' },
    { userId: 'usr_abc12345', name: 'A', email: '' },
  ]) {
    assert.throws(() => validateRegistryInput(bad), /Invalid|required|valid email/);
  }
});

test('sync creates new rows as active with profile data', () => {
  const now = '2026-02-01T00:00:00.000Z';
  const { record, created } = mergeRegistryUser(
    null,
    { userId: 'usr_new12345', name: 'Bala', email: 'bala@example.com', registeredAt: '', lastLoginAt: '' },
    now,
  );
  assert.equal(created, true);
  assert.equal(record.accountStatus, 'active');
  assert.equal(record.name, 'Bala');
  assert.equal(record.updatedAt, now);
});

test('sync NEVER overwrites accountStatus on existing rows (admin is authoritative)', () => {
  const now = '2026-03-01T00:00:00.000Z';
  for (const status of ['suspended', 'deactivated'] as const) {
    const { record, created } = mergeRegistryUser(
      user({ accountStatus: status }),
      { userId: 'usr_test1234', name: 'Asha New', email: 'new@example.com', registeredAt: '2020-01-01T00:00:00.000Z', lastLoginAt: now },
      now,
    );
    assert.equal(created, false);
    assert.equal(record.accountStatus, status);
    assert.equal(record.name, 'Asha New');
    assert.equal(record.email, 'new@example.com');
  }
});

test('retries with the same stable userId do not duplicate records', () => {
  const now = '2026-04-01T00:00:00.000Z';
  const incoming = { userId: 'usr_dup12345', name: 'Dev', email: 'dev@example.com', registeredAt: '', lastLoginAt: '' };
  const first = mergeRegistryUser(null, incoming, now);
  const second = mergeRegistryUser(first.record, incoming, now);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.record.userId, first.record.userId);
});

test('user counts split active / suspended / deactivated', () => {
  const stats = computeUserStats([
    user({ userId: 'u1' }),
    user({ userId: 'u2', accountStatus: 'suspended' }),
    user({ userId: 'u3', accountStatus: 'suspended' }),
    user({ userId: 'u4', accountStatus: 'deactivated' }),
  ]);
  assert.deepEqual(stats, { total: 4, active: 1, suspended: 2, deactivated: 1 });
});

test('user Apps Script backend exposes profile actions and enforces suspension', async () => {
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  for (const action of ['registerUser', 'updateUserProfile', 'reportLogin', 'mirrorStatus', 'getUser', 'getUserByEmail']) {
    assert.match(code, new RegExp(`case '${action}'`), `backend must handle '${action}'`);
  }
  assert.match(code, /Users/, 'backend must define the Users tab');
  assert.match(code, /requireActiveUser_/, 'writes must be guarded by suspension enforcement');
  assert.match(code, /USER_SYNC_SECRET/, 'status mirror must use a server-side secret, never frontend code');
  // The Users tab stores profiles only: no password/token/secret columns,
  // and device sessions are verified transiently, never written to sheets.
  assert.match(code, /Users: \['userId', 'name', 'email', 'accountStatus',/);
  assert.doesNotMatch(code, /passwordHash|userPassword|linkingSecret/);
  assert.doesNotMatch(code, /appendRow\([^)]*(password|sessionToken)/i);
});

test('search and status filters work without leaking other rows', () => {
  const all = [
    user({ userId: 'usr_aaa11111', name: 'Asha', email: 'asha@example.com' }),
    user({ userId: 'usr_bbb22222', name: 'Bala', email: 'bala@example.com', accountStatus: 'suspended' }),
  ];
  const byName = filterRegistry(all, { search: 'bala' });
  assert.equal(byName.total, 1);
  assert.equal(byName.users[0].userId, 'usr_bbb22222');
  const suspended = filterRegistry(all, { status: 'suspended' });
  assert.equal(suspended.total, 1);
  const active = filterRegistry(all, { status: 'active' });
  assert.equal(active.total, 1);
});
