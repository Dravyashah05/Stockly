#!/usr/bin/env node
/* Install the built Stockly APK to connected Android device(s) or emulator.
 *
 * Usage:
 *   node scripts/install-apk.mjs                  Install to available device (prefers emulator if multiple)
 *   node scripts/install-apk.mjs --device=<id>    Install to a specific device id
 *   node scripts/install-apk.mjs --all            Install to all attached devices
 *   node scripts/install-apk.mjs --clean          Uninstall first, then install (useful for signature mismatches)
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const apk = join(rootDir, 'apps', 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

if (!existsSync(apk)) {
  console.error(`[install] APK not found at: ${apk}`);
  console.error(`[install] Please build first with: npm run android:build`);
  process.exit(1);
}

// 1. Discover connected devices via adb
let devicesOutput = '';
try {
  devicesOutput = execSync('adb devices', { encoding: 'utf8' });
} catch (err) {
  console.error(`[install] Failed to run 'adb devices'. Is Android platform-tools in your PATH?`);
  process.exit(1);
}

const lines = devicesOutput
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('List of devices'));

const connectedDevices = lines
  .map((line) => {
    const parts = line.split(/\s+/);
    return { id: parts[0], status: parts[1] };
  })
  .filter((d) => d.status === 'device');

if (connectedDevices.length === 0) {
  console.error(`[install] No active Android devices or emulators found.`);
  console.error(`[install] Connect a device via USB/Wi-Fi or start an Android emulator.`);
  process.exit(1);
}

// 2. Parse arguments
const args = process.argv.slice(2);
const clean = args.includes('--clean');
const all = args.includes('--all');
const deviceArg = args.find((a) => a.startsWith('--device='))?.split('=')[1];

let targets = [];
if (deviceArg) {
  targets = [deviceArg];
} else if (all) {
  targets = connectedDevices.map((d) => d.id);
} else if (connectedDevices.length === 1) {
  targets = [connectedDevices[0].id];
} else {
  // Multiple devices: default to emulator if present, otherwise first device
  const emulator = connectedDevices.find((d) => d.id.startsWith('emulator-'));
  if (emulator) {
    console.log(`[install] Multiple devices detected. Defaulting to emulator: ${emulator.id}`);
    console.log(`[install] Use --all to install to all devices or --device=<id> for a specific device.`);
    targets = [emulator.id];
  } else {
    targets = [connectedDevices[0].id];
  }
}

// 3. Install to targets
for (const target of targets) {
  console.log(`\n[install] Installing to ${target}...`);

  if (clean) {
    console.log(`[install] Uninstalling previous build (com.stockly.inventory)...`);
    spawnSync('adb', ['-s', target, 'uninstall', 'com.stockly.inventory'], { stdio: 'inherit' });
  }

  const res = spawnSync('adb', ['-s', target, 'install', '-r', apk], { stdio: 'pipe', encoding: 'utf8' });
  const output = (res.stdout || '') + (res.stderr || '');

  if (res.status === 0 && output.includes('Success')) {
    console.log(`[install] Successfully installed to ${target}!`);
    // Launch main activity
    console.log(`[install] Launching Stockly...`);
    spawnSync('adb', ['-s', target, 'shell', 'am', 'start', '-n', 'com.stockly.inventory/.MainActivity'], {
      stdio: 'inherit',
    });
  } else if (output.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) {
    console.warn(`[install] Signature mismatch detected on ${target}. Uninstalling old version...`);
    spawnSync('adb', ['-s', target, 'uninstall', 'com.stockly.inventory'], { stdio: 'inherit' });
    console.log(`[install] Retrying install on ${target}...`);
    const retry = spawnSync('adb', ['-s', target, 'install', '-r', apk], { stdio: 'inherit' });
    if (retry.status === 0) {
      console.log(`[install] Successfully installed to ${target}!`);
      spawnSync('adb', ['-s', target, 'shell', 'am', 'start', '-n', 'com.stockly.inventory/.MainActivity'], {
        stdio: 'inherit',
      });
    } else {
      console.error(`[install] Installation retry failed on ${target}.`);
    }
  } else {
    console.error(`[install] Failed to install on ${target}:`);
    console.error(output);
  }
}
