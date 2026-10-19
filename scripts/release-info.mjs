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
  const gradle = readFileSync(join(root, 'apps/mobile/android/app/build.gradle'), 'utf8');
  const code = gradle.match(/versionCode\s+(\d+)/)?.[1];
  const name = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  if (!pkg.version) throw new Error('package.json has no version.');
  if (!code || !name) {
    throw new Error('Could not read versionCode/versionName from apps/mobile/android/app/build.gradle.');
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

export function bumpVersion(type = 'patch', root = rootDir) {
  const v = assertVersionsMatch(readVersions(root));
  const parts = v.appVersion.split('.').map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    parts[2] += 1;
  }
  const nextVersion = parts.join('.');
  const nextCode = v.versionCode + 1;

  // 1. package.json
  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = nextVersion;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // 2. apps/mobile/android/app/build.gradle
  const gradlePath = join(root, 'apps/mobile/android/app/build.gradle');
  let gradle = readFileSync(gradlePath, 'utf8');
  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${nextCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
  writeFileSync(gradlePath, gradle);

  // 3. packages/shared-client/src/config.ts
  const configPath = join(root, 'packages/shared-client/src/config.ts');
  try {
    let conf = readFileSync(configPath, 'utf8');
    conf = conf.replace(/export const APP_VERSION = '[^']+';/, `export const APP_VERSION = '${nextVersion}';`);
    if (/export const APP_VERSION_CODE = \d+;/.test(conf)) {
      conf = conf.replace(/export const APP_VERSION_CODE = \d+;/, `export const APP_VERSION_CODE = ${nextCode};`);
    } else {
      conf = conf.replace(
        `export const APP_VERSION = '${nextVersion}';`,
        `export const APP_VERSION = '${nextVersion}';\nexport const APP_VERSION_CODE = ${nextCode};`,
      );
    }
    writeFileSync(configPath, conf);
  } catch {
    /* ignore if missing in test roots */
  }

  return { appVersion: nextVersion, versionCode: nextCode, versionName: nextVersion };
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

/** Required CLI flag: fails with a helpful message instead of a downstream ENOENT. */
function requireArg(name) {
  const v = arg(name);
  if (!v) throw new Error(`Missing required --${name} argument.`);
  return v;
}

async function main() {
  const cmd = process.argv[2] || '';
  if (cmd === 'check') {
    const v = assertVersionsMatch();
    console.log(`version=${v.appVersion}`);
    console.log(`versionCode=${v.versionCode}`);
    return;
  }
  if (cmd === 'bump') {
    const type = process.argv[3] || 'patch';
    const v = bumpVersion(type);
    console.log(`version=${v.appVersion}`);
    console.log(`versionCode=${v.versionCode}`);
    console.log(`tag=v${v.appVersion}`);
    return;
  }
  if (cmd === 'notes') {
    const prev = process.argv[3] || '';
    for (const line of gitNotes(prev)) console.log(line);
    return;
  }
  if (cmd === 'write') {
    const tag = requireArg('tag');
    const v = assertVersionsMatch();
    const version = v.appVersion;
    if (tag !== `v${version}`) {
      throw new Error(`Tag ${tag} does not match package version v${version}.`);
    }
    const apkPath = requireArg('apk');
    const notesFile = requireArg('notes-file');
    const outFile = requireArg('out');
    const notes = readFileSync(notesFile, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
    const info = buildReleaseJson({
      version,
      versionCode: v.versionCode,
      build: arg('build') || 'debug',
      apkPath,
      apkUrl: requireArg('apk-url'),
      releaseUrl: requireArg('release-url'),
      commit: requireArg('commit'),
      notes,
    });
    writeFileSync(outFile, JSON.stringify(info, null, 2) + '\n');
    console.log(`wrote ${outFile} for ${tag}`);
    return;
  }
  throw new Error('Usage: release-info.mjs <check|bump [type]|notes [prevTag]|write ...>');
}

/**
 * Direct-execution check that is safe for every invocation style.
 * `process.argv[1]` is undefined under `node -e` (and in some embeddings),
 * so the unguarded comparison used to throw at import time — breaking any
 * `import` of this module, including the workflow's `node -e` verifier.
 */
function isDirectExecution() {
  const entry = process.argv[1];
  if (typeof entry !== 'string' || entry === '') return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  await main();
}
