import { buildSync } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const endpoints = ['auth', 'admin', 'devices', 'sheets'];

for (const name of endpoints) {
  const entry = join(root, 'api', `${name}.ts`);
  const result = buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: { js: '// @ts-nocheck\n' },
    write: false,
  });

  let code = result.outputFiles[0].text;
  code = code.replace(/req\.method === "OPTIONS"/g, "req.method === 'OPTIONS'");
  code = code.replace(/k !== "action"/g, "k !== 'action'");

  writeFileSync(entry, code, 'utf8');
  console.log(`Bundled ${name}.ts successfully (${(code.length / 1024).toFixed(1)} KB)`);
}
