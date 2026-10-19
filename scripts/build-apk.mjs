#!/usr/bin/env node
/* Build the Android debug APK from the repository root, on any OS.
 *
 *   node scripts/build-apk.mjs            assembleDebug (debug APK)
 *   node scripts/build-apk.mjs --release  assembleRelease (unsigned unless
 *                                         ANDROID_* signing is configured)
 *
 * Output (debug):
 *   apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
 *
 * Uses the Gradle wrapper committed with the native project; requires the
 * Android SDK (ANDROID_HOME) and a JDK 17+ (Java 21 verified). */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(rootDir, 'apps', 'mobile', 'android');
const isWin = process.platform === 'win32';
const release = process.argv.includes('--release');

if (!existsSync(androidDir)) {
  console.error(`[android] native project not found at ${androidDir}`);
  process.exit(1);
}

const gradlew = join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
if (!existsSync(gradlew)) {
  console.error(`[android] Gradle wrapper missing: ${gradlew}`);
  process.exit(1);
}

const task = release ? 'assembleRelease' : 'assembleDebug';
if (isWin) {
  try {
    spawnSync('attrib', ['-r', join(androidDir, 'app', 'build', 'intermediates', '*'), '/s', '/d'], {
      stdio: 'ignore',
      shell: true,
    });
  } catch {
    /* ignore attribute clearance errors */
  }
}
console.log(`[android] cd apps/mobile/android && ${isWin ? 'gradlew.bat' : './gradlew'} ${task}`);

const result = spawnSync(isWin ? gradlew : 'sh', isWin ? [task, '--console=plain'] : [gradlew, task, '--console=plain'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: isWin,
  env: process.env,
});

if (result.error) {
  console.error(`[android] failed to start Gradle: ${result.error.message}`);
  process.exit(1);
}

const apk = join(
  androidDir,
  'app',
  'build',
  'outputs',
  'apk',
  release ? 'release' : 'debug',
  release ? 'app-release-unsigned.apk' : 'app-debug.apk',
);

if (result.status !== 0) {
  console.error(`[android] Gradle exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}
if (!existsSync(apk)) {
  console.error(`[android] expected APK not found: ${apk}`);
  process.exit(1);
}
console.log(`[android] APK ready: ${apk}`);
