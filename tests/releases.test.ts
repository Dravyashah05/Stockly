import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchLatestRelease, formatApkSize, mapReleasePayload } from '../src/lib/releases.ts';
import { assertVersionsMatch, buildReleaseJson, parseBadging, readVersions } from '../scripts/release-info.mjs';

function ghRelease(overrides = {}) {
  return {
    tag_name: 'v1.2.0',
    body: '## Changes\n- Fixed things',
    published_at: '2026-10-14T00:00:00Z',
    html_url: 'https://github.com/Dravyashah05/Stockly/releases/tag/v1.2.0',
    assets: [
      { name: 'stockly-v1.2.0.apk', size: 4314200, browser_download_url: 'https://github.com/x/y/releases/download/v1.2.0/stockly-v1.2.0.apk' },
      { name: 'SHA256SUMS.txt', size: 99, browser_download_url: 'https://github.com/x/y/releases/download/v1.2.0/SHA256SUMS.txt' },
      { name: 'release.json', size: 400, browser_download_url: 'https://github.com/x/y/releases/download/v1.2.0/release.json' },
    ],
    ...overrides,
  };
}

function releaseJson(overrides = {}) {
  return {
    app: 'Stockly',
    version: '1.2.0',
    versionCode: 12,
    build: 'release',
    publishedAt: '2026-10-14T00:00:00Z',
    minimumSupportedVersion: '1.0.0',
    releaseNotes: ['Improved desktop responsiveness', 'Fixed inventory layout issues'],
    apkUrl: 'https://github.com/x/y/releases/download/v1.2.0/stockly-v1.2.0.apk',
    apkSize: 4314200,
    sha256: 'a'.repeat(64),
    releaseUrl: 'https://github.com/x/y/releases/tag/v1.2.0',
    commit: 'abc123',
    ...overrides,
  };
}

test('maps a complete release.json payload to release info', () => {
  const info = mapReleasePayload(ghRelease(), releaseJson());
  assert.equal(info.version, '1.2.0');
  assert.equal(info.versionCode, 12);
  assert.equal(info.build, 'release');
  assert.equal(info.apkUrl, 'https://github.com/x/y/releases/download/v1.2.0/stockly-v1.2.0.apk');
  assert.equal(info.apkSize, 4314200);
  assert.equal(info.sha256, 'a'.repeat(64));
  assert.deepEqual(info.releaseNotes, ['Improved desktop responsiveness', 'Fixed inventory layout issues']);
  assert.equal(info.source, 'release.json');
});

test('falls back to release assets when release.json is missing', () => {
  const info = mapReleasePayload(ghRelease(), null);
  assert.equal(info.version, '1.2.0');
  assert.equal(info.source, 'assets');
  assert.equal(info.apkUrl, 'https://github.com/x/y/releases/download/v1.2.0/stockly-v1.2.0.apk');
  assert.equal(info.apkSize, 4314200);
  assert.equal(info.sha256, null);
});

test('rejects malformed release.json without inventing values', () => {
  const info = mapReleasePayload(ghRelease(), { version: 42, notes: 'nope' });
  assert.equal(info.source, 'assets');
  assert.equal(info.apkUrl, 'https://github.com/x/y/releases/download/v1.2.0/stockly-v1.2.0.apk');
  const noApk = mapReleasePayload(ghRelease({ assets: [] }), null);
  assert.equal(noApk.apkUrl, '');
});

test('rejects malformed checksums instead of surfacing them', () => {
  const info = mapReleasePayload(ghRelease(), releaseJson({ sha256: 'not-a-digest' }));
  assert.equal(info.sha256, null);
  const upper = mapReleasePayload(ghRelease(), releaseJson({ sha256: 'B'.repeat(64) }));
  assert.equal(upper.sha256, 'b'.repeat(64));
});

test('formats APK sizes for download UI', () => {
  assert.equal(formatApkSize(0), '');
  assert.equal(formatApkSize(512), '512 B');
  assert.equal(formatApkSize(20480), '20 KB');
  assert.equal(formatApkSize(4314200), '4.1 MB');
});

test('fetchLatestRelease is a function (network covered by mapping tests)', () => {
  assert.equal(typeof fetchLatestRelease, 'function');
});

test('release versions stay consistent (web, Android name, sane code)', () => {
  const v = readVersions();
  assert.match(v.appVersion, /^[0-9]+\.[0-9]+\.[0-9]+$/);
  assert.equal(v.versionName, v.appVersion);
  assert.ok(Number.isInteger(v.versionCode) && v.versionCode >= 1);
  assert.deepEqual(assertVersionsMatch(v), v);
});

test('parses aapt badging output for APK verification', () => {
  const info = parseBadging(
    "package: name='com.stockly.inventory' versionCode='12' versionName='1.2.0' platformBuildVersionName='36'",
  );
  assert.equal(info.applicationId, 'com.stockly.inventory');
  assert.equal(info.versionCode, 12);
  assert.equal(info.versionName, '1.2.0');
});

test('buildReleaseJson refuses empty APKs and missing fields', () => {
  assert.throws(() => buildReleaseJson({ tag: 'v9.9.9', version: '', versionCode: 1, build: 'debug', apkPath: 'package.json', apkUrl: '', releaseUrl: '', commit: '', notes: [] }));
  const info = buildReleaseJson({
    tag: 'v9.9.9', version: '9.9.9', versionCode: 7, build: 'debug',
    apkPath: 'package.json',
    apkUrl: 'https://github.com/o/r/releases/download/v9.9.9/stockly-v9.9.9.apk',
    releaseUrl: 'https://github.com/o/r/releases/tag/v9.9.9',
    commit: 'deadbee', notes: ['Test build'],
  });
  assert.equal(info.version, '9.9.9');
  assert.equal(info.build, 'debug');
  assert.ok(info.apkSize > 0);
  assert.match(info.sha256, /^[0-9a-f]{64}$/);
  assert.ok(Date.parse(info.publishedAt) > 0);
});
