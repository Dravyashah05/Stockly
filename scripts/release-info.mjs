#!/usr/bin/env node
/* Stockly release metadata helper (CI only — never bundled into the app).
 *
 * The release workflow needs four small, side-effect-free operations that are
 * easier to keep correct in one reviewed file than as inline shell inside YAML:
 *
 *   check   — read package.json + android/app/build.gradle, fail fast when the
 *             two version identities disagree, and print `key=value` pairs the
 *             workflow forwards into $GITHUB_OUTPUT.
 *   notes   — render the commit range since the previous tag as markdown.
 *   write   — assemble release.json (the machine-readable asset the in-app
 *             updater prefers) from the built APK and the run context.
 *
 * Exports (used by the workflow's APK-identity verification step):
 *   readVersions()   — { versionName, versionCode } from the Gradle file.
 *   parseBadging(l)  — { applicationId, versionCode, versionName } from the
 *                      first line of `aapt dump badging`.
 *
 * No network access, no secrets, no writes outside an explicit --out path.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGE_JSON = resolve(ROOT, 'package.json');
const GRADLE = resolve(ROOT, 'mobile-app/android/app/build.gradle');
const APP_ID = 'com.stockly.inventory';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** package.json `version` is the single source of truth for the marketing version. */
export function readPackageVersion() {
  const v = String(readJson(PACKAGE_JSON).version || '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(v)) {
    throw new Error(`package.json version "${v}" is not a semver x.y.z string.`);
  }
  return v;
}

/** android/app/build.gradle is the single source of truth for the Android identity. */
export function readVersions() {
  const gradle = readFileSync(GRADLE, 'utf8');
  const code = /^\s*versionCode\s+(\d+)\s*$/m.exec(gradle);
  const name = /^\s*versionName\s+"([^"]+)"\s*$/m.exec(gradle);
  if (!code || !name) {
    throw new Error('Could not read versionCode/versionName from android/app/build.gradle.');
  }
  return { versionName: name[1].trim(), versionCode: Number(code[1]) };
}

/** First line of `aapt dump badging <apk>`. */
export function parseBadging(line) {
  const appId = /package: name='([^']+)'/.exec(line);
  const vCode = /versionCode='([^']+)'/.exec(line);
  const vName = /versionName='([^']+)'/.exec(line);
  if (!appId || !vCode || !vName) {
    throw new Error('Could not parse aapt badging output: ' + line.slice(0, 200));
  }
  return {
    applicationId: appId[1],
    versionCode: Number(vCode[1]),
    versionName: vName[1],
  };
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function flagValue(name) {
  const argv = process.argv;
  const i = argv.indexOf(name);
  if (i === -1 || i === argv.length - 1) {
    throw new Error(`Missing required argument ${name}`);
  }
  return argv[i + 1];
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/* Release notes: one bullet per commit since the previous tag, newest first.
 * Falls back to the last 20 commits when no previous tag exists (first release). */
function renderNotes(prevTag) {
  const range = prevTag ? `${prevTag}..HEAD` : 'HEAD';
  const log = git('log', '--no-merges', '--pretty=format:%s', '--max-count=40', range);
  const subjects = log.split('\n').map((s) => s.trim()).filter(Boolean);
  const lines = subjects.length
    ? subjects.map((s) => `- ${s}`)
    : ['- Initial release.'];
  return lines.slice(0, 30).join('\n');
}

function check() {
  const versionName = readPackageVersion();
  const gradle = readVersions();
  if (gradle.versionName !== versionName) {
    throw new Error(
      `Version mismatch: package.json says ${versionName} but android versionName says ` +
        `${gradle.versionName}. Bump both together (and raise versionCode).`,
    );
  }
  process.stdout.write(`version=${versionName}\nversionCode=${gradle.versionCode}\n`);
}

function notes() {
  process.stdout.write(renderNotes(process.argv[3] || '') + '\n');
}

function write() {
  const tag = flagValue('--tag').replace(/^v/i, '');
  const apk = flagValue('--apk');
  const apkUrl = flagValue('--apk-url');
  const releaseUrl = flagValue('--release-url');
  const commit = flagValue('--commit');
  const build = flagValue('--build');
  const notesFile = flagValue('--notes-file');
  const out = flagValue('--out');

  const notesBody = readFileSync(notesFile, 'utf8');
  const releaseNotes = notesBody
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.replace(/^-\s*/, ''))
    .slice(0, 12);

  const meta = {
    tag,
    version: tag,
    versionCode: readVersions().versionCode,
    build,
    publishedAt: new Date().toISOString(),
    minimumSupportedVersion: '1.0.0',
    releaseNotes,
    apkUrl,
    apkSize: statSync(apk).size,
    sha256: sha256File(apk),
    releaseUrl,
    commit,
  };

  writeFileSync(out, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  process.stdout.write(`Wrote ${out} for v${tag} (${APP_ID}).\n`);
}

const command = process.argv[2];
try {
  switch (command) {
    case 'check':
      check();
      break;
    case 'notes':
      notes();
      break;
    case 'write':
      write();
      break;
    default:
      throw new Error(`Unknown command "${command ?? ''}". Use: check | notes [prevTag] | write`);
  }
} catch (error) {
  process.stderr.write(`[release-info] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
