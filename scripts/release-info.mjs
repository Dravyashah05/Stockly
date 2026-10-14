#!/usr/bin/env node
/* Release helpers for Stockly's automated pipeline (and local verification).
 *
 * Single source of truth: package.json `version` must equal the Android
 * `versionName`; `versionCode` only ever moves forward (bumped by hand when
 * releasing — never reset, never auto-edited by CI).
 *
 * No secrets, no network calls here. Usage:
 *   node scripts/release-info.mjs check
 *   node scripts/release-info.mjs notes [previous-tag]
 *   node scripts/release-info.mjs write --tag v1.2.0 --apk stockly-1.2.0.apk \
 *     --apk-url https://.../stockly-1.2.0.apk --release-url https://.../tag/v1.2.0 \
 *     --commit abc123 --build debug --notes-file NOTES.md --out release.json
 */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const rootDir = join(here, '..');

export function readVersions(root = rootDir) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const gradle = readFileSync(join(root, 'android/app/build.gradle'), 'utf8');
  const code = gradle.match(/versionCode\s+(\d+)/)?.[1];
  const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  if (!pkg.version) throw new Error('package.json has no version.');
  if (!code || !name) {
    throw new Error('Could not read versionCode/versionName from android/app/build.gradle.');
  }
  return { appVersion: String(pkg.version), versionCode: Number(code), versionName: String(name) };
}

export function assertVersionsMatch(v = readVersions()) {
  if (v.versionName !== v.appVersion) {
    throw new Error(
      `Version mismatch: package.json (${v.appVersion}) !== android versionName (${v.versionName}). ` +
      'Bump both together before releasing.',
    );
  }
  if (!Number.isInteger(v.versionCode) || v.versionCode < 1) {
    throw new Error(`Invalid android versionCode (${v.versionCode}). It must be a positive integer.`);
  }
  return v;
}

/** Parse the first line of `aapt dump badging` output. */
export function parseBadging(line) {
  const get = (k) => line.match(new RegExp(`${k}='([^']*)'`))?.[1] ?? '';
  return {
    applicationId: get('name'),
    versionCode: Number(get('versionCode')),
    versionName: get('versionName'),
  };
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** Human release notes from commits since the previous tag (never invented). */
export function gitNotes(previousTag) {
  try {
    const range = previousTag ? `${previousTag}..HEAD` : 'HEAD';
    const args = ['log', range, '--pretty=format:- %s', '--no-merges', '-n', '30'];
    const out = execFileSync('git', args, { encoding: 'utf8', cwd: rootDir }).trim();
    const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 0) return lines.slice(0, 15);
  } catch {
    /* no history (shallow checkout) — fall through */
  }
  return previousTag ? ['Automated release.'] : ['Initial automated release.'];
}

export function buildReleaseJson({ version, versionCode, build, apkPath, apkUrl, releaseUrl, commit, notes, minimumSupportedVersion = '1.0.0' }) {
  const size = statSync(apkPath).size;
  if (!size) throw new Error(`APK is empty: ${apkPath}`);
  if (!version || !apkUrl || !releaseUrl) throw new Error('version, apkUrl and releaseUrl are required.');
  return {
    app: 'Stockly',
    version,
    versionCode,
    build,
    publishedAt: new Date().toISOString(),
    minimumSupportedVersion,
    releaseNotes: notes,
    apkUrl,
    apkSize: size,
    sha256: sha256File(apkPath),
    releaseUrl,
    commit,
  };
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : (process.argv[i + 1] || '');
}

async function main() {
  const cmd = process.argv[2] || '';
  if (cmd === 'check') {
    const v = assertVersionsMatch();
    console.log(`version=${v.appVersion}`);
    console.log(`versionCode=${v.versionCode}`);
    return;
  }
  if (cmd === 'notes') {
    const prev = process.argv[3] || '';
    for (const line of gitNotes(prev)) console.log(line);
    return;
  }
  if (cmd === 'write') {
    const tag = arg('tag');
    const v = assertVersionsMatch();
    const version = v.appVersion;
    if (tag !== `v${version}`) {
      throw new Error(`Tag ${tag} does not match package version v${version}.`);
    }
    const apkPath = arg('apk');
    const notesFile = arg('notes-file');
    const notes = readFileSync(notesFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const info = buildReleaseJson({
      tag,
      version,
      versionCode: v.versionCode,
      build: arg('build') || 'debug',
      apkPath,
      apkUrl: arg('apk-url'),
      releaseUrl: arg('release-url'),
      commit: arg('commit'),
      notes,
    });
    writeFileSync(arg('out') || 'release.json', JSON.stringify(info, null, 2) + '\n');
    console.log(`wrote ${arg('out') || 'release.json'} for ${tag}`);
    return;
  }
  throw new Error('Usage: release-info.mjs <check|notes [prevTag]|write ...>');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
