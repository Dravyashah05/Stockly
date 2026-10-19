import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cmpVersions, fetchLatestRelease, formatApkSize, isNewerVersion, isReleaseInfoLike, mapReleasePayload } from '../packages/shared-client/src/releases.ts';
import { assertVersionsMatch, buildReleaseJson, bumpVersion, parseBadging, readVersions } from '../scripts/release-info.mjs';


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

test('cmpVersions compares semantic versions correctly', () => {
  assert.ok(cmpVersions('1.0.1', '1.0.0') > 0);
  assert.ok(cmpVersions('1.1.0', '1.0.9') > 0);
  assert.ok(cmpVersions('2.0.0', '1.9.9') > 0);
  assert.equal(cmpVersions('1.0.0', '1.0.0'), 0);
  assert.ok(cmpVersions('1.0.0', '1.0.1') < 0);
  assert.ok(cmpVersions('v1.0.1', '1.0.0') > 0);
});

test('isNewerVersion detects updates via version or versionCode', () => {
  assert.equal(isNewerVersion('1.0.1', '1.0.0'), true);
  assert.equal(isNewerVersion('1.0.0', '1.0.0'), false);
  assert.equal(isNewerVersion('1.0.0', '1.0.1'), false);
  // Higher versionCode wins even if semver is identical
  assert.equal(isNewerVersion('1.0.0', '1.0.0', 2, 1), true);
  assert.equal(isNewerVersion('1.0.0', '1.0.0', 1, 1), false);
});

test('bumpVersion increments patch and versionCode safely in isolated tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stockly-bump-'));
  try {
    const pkg = { name: 'stockly', version: '1.2.3' };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
    const appDir = join(dir, 'apps/mobile/android/app');
    mkdirSync(appDir, { recursive: true });

    writeFileSync(join(appDir, 'build.gradle'), 'defaultConfig {\n  versionCode 4\n  versionName "1.2.3"\n}\n');
    const confDir = join(dir, 'packages/shared-client/src');
    mkdirSync(confDir, { recursive: true });
    writeFileSync(join(confDir, 'config.ts'), "export const APP_VERSION = '1.2.3';\nexport const APP_VERSION_CODE = 4;\n");

    const bumped = bumpVersion('patch', dir);
    assert.equal(bumped.appVersion, '1.2.4');
    assert.equal(bumped.versionCode, 5);

    const reRead = readVersions(dir);
    assert.equal(reRead.appVersion, '1.2.4');
    assert.equal(reRead.versionCode, 5);
    assert.equal(reRead.versionName, '1.2.4');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, ['scripts/release-info.mjs', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout: stdout as string, stderr: '' };
  } catch (e) {
    const err = e as { status?: number; stdout?: unknown; stderr?: unknown };
    return {
      status: typeof err.status === 'number' ? err.status : 1,
      stdout: typeof err.stdout === 'string' ? err.stdout : String(err.stdout ?? ''),
      stderr: typeof err.stderr === 'string' ? err.stderr : String(err.stderr ?? ''),
    };
  }
}

test('CLI direct invocation: check reports versions', () => {
  const r = runCli(['check']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^version=\d+\.\d+\.\d+$/m);
  assert.match(r.stdout, /^versionCode=\d+$/m);
});

test('CLI with no command reports usage and fails', () => {
  const r = runCli([]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Usage: release-info\.mjs/);
});

test('CLI write without required flags reports a helpful error', () => {
  const v = readVersions();
  const r = runCli(['write', '--tag', `v${v.appVersion}`]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /Missing required --apk argument/);
});

test('CLI write generates real release metadata end to end', () => {
  const v = readVersions();
  const dir = mkdtempSync(join(tmpdir(), 'stockly-rel-'));
  try {
    const apk = join(dir, 'fake.apk');
    const notesFile = join(dir, 'NOTES.md');
    const outFile = join(dir, 'release.json');
    writeFileSync(apk, Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    writeFileSync(notesFile, '- CLI note one\n- CLI note two\n');
    const tag = `v${v.appVersion}`;
    const r = runCli([
      'write',
      '--tag', tag,
      '--apk', apk,
      '--apk-url', `https://example.com/r/download/${tag}/stockly-${v.appVersion}.apk`,
      '--release-url', `https://example.com/r/tag/${tag}`,
      '--commit', 'cli-test',
      '--build', 'debug',
      '--notes-file', notesFile,
      '--out', outFile,
    ]);
    assert.equal(r.status, 0);
    const info = JSON.parse(readFileSync(outFile, 'utf8')) as Record<string, unknown>;
    assert.equal(info.version, v.appVersion);
    assert.equal(info.versionCode, v.versionCode);
    assert.equal(info.build, 'debug');
    assert.equal(info.apkSize, 8);
    assert.match(String(info.sha256), /^[0-9a-f]{64}$/);
    assert.deepEqual(info.releaseNotes, ['- CLI note one', '- CLI note two']);
    assert.equal(info.commit, 'cli-test');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('importing the module never runs the CLI (node -e regression)', () => {
  // Reproduces the workflow failure: `node -e` leaves process.argv[1]
  // undefined, which used to crash the entry-point check at import time.
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', "import('./scripts/release-info.mjs').then((m) => console.log(typeof m.buildReleaseJson))"],
    { encoding: 'utf8' },
  );
  assert.match(String(out), /function/);
});

test('isReleaseInfoLike gates static payloads strictly', () => {
  assert.equal(isReleaseInfoLike({ version: '1.0.0', apkUrl: 'https://x/y.apk' }), true);
  for (const bad of [null, [], {}, { version: '' }, { apkUrl: 'https://x/y.apk' }, { version: '1.0.0' }, 'x', 42]) {
    assert.equal(isReleaseInfoLike(bad), false);
  }
});

/** Minimal browser globals so fetchLatestRelease can run under node. */
function stubBrowser(handler: (url: string) => { status: number; body: unknown } | null) {
  const g = globalThis as Record<string, unknown>;
  const prevWindow = g.window;
  const prevStorage = g.localStorage;
  const prevNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const prevFetchDesc = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  const calls: string[] = [];
  const store = new Map<string, string>();
  (g as Record<string, unknown>).window = {
    setTimeout: (...a: [unknown, ...unknown[]]) => setTimeout(a[0] as never, ...(a.slice(1) as [])),
    clearTimeout: (id: unknown) => clearTimeout(id as never),
  };
  (g as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'fetch', {
    value: async (url: string) => {
      calls.push(String(url));
      const route = handler(String(url));
      if (!route) throw new Error('network down');
      return {
        ok: route.status >= 200 && route.status < 300,
        status: route.status,
        json: async () => route.body,
        text: async () => JSON.stringify(route.body),
      };
    },
    configurable: true,
    writable: true,
  });
  return {
    calls,
    restore: () => {
      if (prevWindow === undefined) delete (g as Record<string, unknown>).window;
      else (g as Record<string, unknown>).window = prevWindow;
      if (prevStorage === undefined) delete (g as Record<string, unknown>).localStorage;
      else (g as Record<string, unknown>).localStorage = prevStorage;
      if (prevNavigatorDesc) Object.defineProperty(globalThis, 'navigator', prevNavigatorDesc);
      else delete (globalThis as Record<string, unknown>).navigator;
      if (prevFetchDesc) Object.defineProperty(globalThis, 'fetch', prevFetchDesc);
      else delete (globalThis as Record<string, unknown>).fetch;
    },
  };
}

test('static release.json is preferred and the API is never called', async () => {
  const stub = stubBrowser((url) =>
    url === 'release.json'
      ? { status: 200, body: { version: '9.9.9', apkUrl: 'https://example.com/r/a.apk', releaseNotes: ['Static note'] } }
      : null,
  );
  try {
    const info = await fetchLatestRelease({ noCache: true });
    assert.equal(info.version, '9.9.9');
    assert.equal(info.source, 'release.json');
    assert.equal(info.versionCode, 0);
    assert.deepEqual(info.releaseNotes, ['Static note']);
    assert.ok(stub.calls.every((c) => !c.includes('api.github.com')));
  } finally {
    stub.restore();
  }
});

test('an invalid static file falls back to the Releases API', async () => {
  const meta = releaseJson();
  const stub = stubBrowser((url) => {
    if (url === 'release.json') return { status: 200, body: { nope: true } };
    if (url.includes('/releases/latest')) return { status: 200, body: ghRelease() };
    if (url.includes('release.json')) return { status: 200, body: meta };
    return null;
  });
  try {
    const info = await fetchLatestRelease({ noCache: true });
    assert.equal(info.version, '1.2.0');
    assert.equal(info.source, 'release.json');
    assert.ok(stub.calls.some((c) => c.includes('api.github.com')));
  } finally {
    stub.restore();
  }
});
