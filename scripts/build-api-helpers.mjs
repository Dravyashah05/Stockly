import { buildSync } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const helpers = ['apps-script-client', 'schema', 'auth-logic', 'admin-logic', 'device-logic'];

for (const name of helpers) {
  buildSync({
    entryPoints: [join(root, 'api', `${name}.ts`)],
    outfile: join(root, 'api', `${name}.js`),
    format: 'esm',
    platform: 'node',
    target: 'node20',
  });
}
console.log('Compiled API helper modules to .js for Node ESM compatibility');
