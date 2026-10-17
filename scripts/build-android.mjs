import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.resolve(root, 'mobile-app/android');
const cmd = process.platform === 'win32' ? path.resolve(androidDir, 'gradlew.bat') : './gradlew';

const proc = spawn(cmd, ['assembleDebug'], {
  cwd: androidDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

proc.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  console.log('\n[build-android] APK ready at: mobile-app/android/app/build/outputs/apk/debug/app-debug.apk\n');
});
