import { spawn } from 'node:child_process';

const scripts = ['dev:server', 'dev:mobile', 'dev:website', 'dev:admin'];
const npmCli = process.env.npm_execpath;
const children = scripts.map((script) => {
  const child = spawn(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, 'run', script] : ['run', script], {
    stdio: 'inherit',
    shell: false,
  });
  child.on('exit', (code) => {
    if (code && !stopping) {
      console.error(`[dev:all] ${script} exited with code ${code}`);
      stop(code);
    }
  });
  return child;
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exitCode = code;
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
console.info(`[dev:all] started ${scripts.join(', ')}`);
