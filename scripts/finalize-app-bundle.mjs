#!/usr/bin/env node
/* Post-process the app-only bundle (mobile/dist-app).
 *
 * Capacitor boots webDir/index.html directly, but Vite preserves the source
 * filename (app.html) for HTML entries. Rename so the native shell loads the
 * app with no redirect hop. The combined dist/ build is untouched (it keeps
 * app.html + the redirect snippets in index.html/store.html).
 */
import { copyFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(rootDir, 'mobile', 'dist-app');

copyFileSync(join(outDir, 'app.html'), join(outDir, 'index.html'));
rmSync(join(outDir, 'app.html'));
console.log('App bundle entry: mobile/dist-app/index.html');
