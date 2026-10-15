import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_LINK_ATTEMPTS,
  QR_LINK_TTL_MS,
  RateLimiter,
  buildQrPayload,
  createDeviceSession,
  createLinkRecord,
  createMemoryDeviceStore,
  hashEqual,
  newDeviceId,
  newLinkCode,
  newLinkId,
  newLinkToken,
  normalizeLinkCode,
  parseQrPayload,
  sanitizeDeviceMeta,
  sha256hex,
  tryClaimLink,
  verifyDeviceSessionFormat,
  type DeviceLink,
} from '../api/device-logic.ts';

const SECRET = 'test-device-secret-0123456789abcdef';

function pendingLink(overrides: Partial<DeviceLink> = {}): DeviceLink {
  const now = Date.now();
  return {
    linkId: newLinkId(),
    userId: 'usr_test1234',
    tokenHash: sha256hex('sometoken'),
    method: 'qr',
    status: 'pending',
    expiresAt: new Date(now + QR_LINK_TTL_MS).toISOString(),
    attempts: 0,
    claimant: '',
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
    ...overrides,
  };
}

test('linking tokens are random, unguessable, and unique', () => {
  const a = newLinkToken();
  const b = newLinkToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  const record = createLinkRecord({ userId: 'usr_test1234', method: 'qr', tokenHash: sha256hex(a), ttlMs: QR_LINK_TTL_MS });
  assert.equal(record.tokenHash, sha256hex(a));
  assert.doesNotMatch(JSON.stringify(record), new RegExp(a));
});

test('linking codes are short, unambiguous, and normalise safely', () => {
  const code = newLinkCode();
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.doesNotMatch(code, /[01ILO]/);
  assert.equal(normalizeLinkCode('kq7d-2mzx'), 'KQ7D2MZX');
  assert.equal(normalizeLinkCode('  kq7d 2mzx '), 'KQ7D2MZX');
});

test('QR payloads round-trip and foreign QR codes are rejected', () => {
  const text = buildQrPayload('lnk_abc12345', newLinkToken());
  const parsed = parseQrPayload(text);
  assert.ok(parsed);
  assert.equal(parsed?.linkId, 'lnk_abc12345');
  const badList = [
    'https://web.whatsapp.com/',
    '{"v":1,"app":"whatsapp","linkId":"x","token":"y"}',
    '{"v":2,"app":"stockly","linkId":"lnk_abc12345","token":"abc"}',
    '{"app":"stockly","linkId":"lnk_abc12345","token":"abc"}',
    'not json at all',
    'x'.repeat(600),
  ];
  for (const bad of badList) {
    assert.equal(parseQrPayload(bad), null);
  }
  assert.equal(parseQrPayload(''), null);
});

test('claim moves pending to claimed exactly once; duplicates rejected', () => {
  const token = newLinkToken();
  const link = pendingLink({ tokenHash: sha256hex(token) });
  const first = tryClaimLink(link, token);
  assert.equal(first.ok, true);
  if (first.ok === false) return;
  assert.equal(first.link.status, 'claimed');
  const second = tryClaimLink(first.link, token);
  assert.equal(second.ok, false);
  if (second.ok === true) return;
  assert.equal(second.reason, 'already-used');
});

test('approved links cannot be claimed again (replay rejected)', async () => {
  const store = createMemoryDeviceStore();
  const token = newLinkToken();
  const link = pendingLink({ tokenHash: sha256hex(token) });
  await store.createLink(link);
  const claimed = tryClaimLink(await store.getLink(link.linkId), token);
  assert.equal(claimed.ok, true);
  if (claimed.ok === false) return;
  await store.updateLink(claimed.link);
  await store.updateLink({ ...claimed.link, status: 'approved' });
  const replay = tryClaimLink(await store.getLink(link.linkId), token);
  assert.equal(replay.ok, false);
});

test('wrong tokens fail; attempts lock out after the maximum', () => {
  let link = pendingLink();
  for (let i = 0; i < MAX_LINK_ATTEMPTS; i++) {
    const r = tryClaimLink(link, 'wrong-token');
    assert.equal(r.ok, false);
    if (r.ok === true) return;
    assert.equal(r.reason, 'invalid-token');
    link = { ...link, attempts: link.attempts + 1 };
  }
  const locked = tryClaimLink(link, 'wrong-token');
  assert.equal(locked.ok, false);
  if (locked.ok === true) return;
  assert.equal(locked.reason, 'locked');
  const correct = tryClaimLink({ ...link, tokenHash: sha256hex('right') }, 'right');
  assert.equal(correct.ok, false);
});

test('expired links are rejected, never approved', () => {
  const link = pendingLink({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  const r = tryClaimLink(link, 'sometoken');
  assert.equal(r.ok, false);
  if (r.ok === true) return;
  assert.equal(r.reason, 'expired');
});

test('device sessions verify; tampered and expired sessions fail', () => {
  const token = createDeviceSession('usr_test1234', 'dev_abc12345', SECRET);
  const session = verifyDeviceSessionFormat(token, SECRET);
  assert.ok(session);
  assert.equal(session?.userId, 'usr_test1234');
  assert.equal(session?.deviceId, 'dev_abc12345');
  const parts = token.split('.');
  assert.equal(verifyDeviceSessionFormat(parts[0].slice(0, -2) + 'AA.' + parts[1], SECRET), null);
  assert.equal(verifyDeviceSessionFormat(token, 'wrong-secret'), null);
  assert.equal(verifyDeviceSessionFormat('garbage', SECRET), null);
  const expired = createDeviceSession('usr_test1234', 'dev_abc12345', SECRET, -1000);
  assert.equal(verifyDeviceSessionFormat(expired, SECRET), null);
});

test('revoked devices stay revoked without duplicating rows', async () => {
  const store = createMemoryDeviceStore();
  const now = new Date().toISOString();
  const base = {
    deviceId: 'dev_revoked1',
    userId: 'usr_test1234',
    name: 'Old phone',
    platform: 'android-web',
    appInfo: '',
    linkedAt: now,
    lastActiveAt: now,
  };
  await store.upsertDevice({ ...base, status: 'active' });
  await store.upsertDevice({ ...base, status: 'revoked' });
  const device = await store.getDevice('dev_revoked1');
  assert.equal(device?.status, 'revoked');
  assert.equal((await store.listDevicesForUser('usr_test1234')).length, 1);
});

test('rate limiter blocks bursts and recovers over time', () => {
  const limiter = new RateLimiter(3, 60_000);
  const t = Date.now();
  assert.equal(limiter.take('k', t), true);
  assert.equal(limiter.take('k', t), true);
  assert.equal(limiter.take('k', t), true);
  assert.equal(limiter.take('k', t), false);
  assert.equal(limiter.take('other', t), true);
  assert.equal(limiter.take('k', t + 61_000), true);
});

test('device metadata is bounded and never carries secrets', () => {
  const meta = sanitizeDeviceMeta({ name: '  My   Phone  ', platform: 'android-app', appInfo: 'x'.repeat(500) });
  assert.equal(meta.name, 'My Phone');
  assert.ok(meta.appInfo.length <= 120);
  assert.doesNotMatch(JSON.stringify(meta), /password|token|secret/i);
});

test('only hashes are compared, timing-safely', () => {
  assert.equal(hashEqual(sha256hex('abc'), sha256hex('abc')), true);
  assert.equal(hashEqual(sha256hex('abc'), sha256hex('abd')), false);
  assert.equal(hashEqual('nothex!!', sha256hex('abc')), false);
});

test('ids are unique and well-formed', () => {
  assert.notEqual(newDeviceId(), newDeviceId());
  assert.notEqual(newLinkId(), newLinkId());
  assert.match(newDeviceId(), /^dev_[0-9a-f]+$/);
  assert.match(newLinkId(), /^lnk_[0-9a-f]+$/);
});

test('user Apps Script enforces device sessions on every write path', async () => {
  const { readFileSync } = await import('node:fs');
  const code = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
  assert.match(code, /function requireDevice_/);
  assert.match(code, /function setDeviceSecrets/);
  assert.match(code, /DEVICE_SESSION_SECRET/);
  assert.match(code, /DEVICE_VALIDATE_URL/);
  // Sessions are verified transiently (HMAC + live check) — never written
  // to any sheet: no session/password columns may exist in Users headers.
  assert.match(code, /Users: \['userId', 'name', 'email', 'accountStatus',/);
  const names = ['createProduct_', 'updateProduct_', 'deleteProduct_', 'createCategory_', 'updateCategory_', 'deleteCategory_', 'stockIn_', 'stockOut_'];
  for (const fn of names) {
    const start = code.indexOf('function ' + fn + '(');
    assert.ok(start !== -1, fn + ' exists');
    const rest = code.slice(start);
    const nextFn = rest.search(/\r?\nfunction [A-Za-z_][A-Za-z0-9_]*\(/);
    const body = nextFn === -1 ? rest : rest.slice(0, nextFn);
    assert.match(body, /requireDevice_/, fn + ' must enforce device sessions');
  }
});
