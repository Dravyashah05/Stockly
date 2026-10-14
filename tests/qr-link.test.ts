import assert from 'node:assert/strict';
import test from 'node:test';
import { parseScannedEndpoint, scannedEndpointMessage } from '../src/lib/qr-link.ts';

const GOOD = 'https://script.google.com/macros/s/AKfycb1234567890/exec';

test('accepts a valid deployed /exec URL', () => {
  assert.deepEqual(parseScannedEndpoint(GOOD), { ok: true, url: GOOD });
});

test('accepts trailing slashes and surrounding whitespace', () => {
  assert.equal(parseScannedEndpoint(`  ${GOOD}/  \n`).ok, true);
});

test('rejects empty and non-string input without details', () => {
  for (const raw of ['', '   ', null, undefined, 42, {}]) {
    const r = parseScannedEndpoint(raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'empty');
  }
});

test('rejects plain text and JSON payloads as not-a-URL', () => {
  for (const raw of ['hello world', '{"url":"https://example.com"}', 'Stockly']) {
    const r = parseScannedEndpoint(raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'not-url');
  }
});

test('rejects dangerous and non-https schemes', () => {
  for (const raw of [
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'file:///etc/passwd',
    'http://script.google.com/macros/s/AKfycb123/exec',
  ]) {
    const r = parseScannedEndpoint(raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'protocol');
  }
});

test('rejects unrelated domains', () => {
  for (const raw of [
    'https://example.com/macros/s/AKfycb123/exec',
    'https://script.googleusercontent.com/macros/echo?x=1',
    'https://googlescript.example.com/macros/s/AKfycb123/exec',
  ]) {
    const r = parseScannedEndpoint(raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'host');
  }
});

test('rejects dev URLs, query strings, and wrong paths', () => {
  for (const raw of [
    'https://script.google.com/macros/s/AKfycb123/dev',
    'https://script.google.com/macros/s/AKfycb123/exec?x=1',
    'https://script.google.com/macros/s/AKfycb123/exec#frag',
    'https://script.google.com/macros/s//exec',
    'https://script.google.com/',
  ]) {
    const r = parseScannedEndpoint(raw);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'path');
  }
});

test('explains rejections without echoing the scanned value', () => {
  const secret = 'SECRET-ABC-123';
  for (const reason of ['empty', 'not-url', 'protocol', 'host', 'path', 'bogus']) {
    const msg = scannedEndpointMessage(reason);
    assert.equal(typeof msg, 'string');
    assert.ok(msg.length > 10);
    assert.doesNotMatch(msg, /SECRET-ABC-123/);
  }
  const hostile = parseScannedEndpoint(`https://example.com/${secret}`);
  assert.equal(hostile.ok, false);
});
