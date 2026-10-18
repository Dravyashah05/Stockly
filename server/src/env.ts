/* Single root .env loading + validation for the Stockly backend.
 *
 * - Loads ONLY the repository-root `.env` (path anchored to this file —
 *   never process.cwd(), never a copy inside server/).
 * - dotenv never overwrites variables already set by the hosting provider
 *   (production secrets come from the host's environment, not a file).
 * - Validation reports missing/misnamed keys BY NAME ONLY; secret values
 *   are never logged or thrown.
 *
 * Importing this module has the side effect of loading the file, so it is
 * imported before any api/* handler module executes. */

import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_ENV_PATH = path.resolve(here, '../../.env');

/** Required for every protected operation (auth, devices, admin, sheets). */
export const REQUIRED_SERVER_ENV = [
  'AUTH_SESSION_SECRET',
  'DEVICE_SESSION_SECRET',
  'ADMIN_SESSION_SECRET',
  'ADMIN_MIRROR_SECRET',
  'ADMIN_SCRIPT_URL',
  'ADMIN_SCRIPT_TOKEN',
  'ADMIN_SETUP_KEY',
] as const;

/** Optional with safe defaults. */
export const OPTIONAL_SERVER_ENV = ['PORT', 'NODE_ENV', 'ADMIN_SESSION_TTL_HOURS'] as const;

/** The only prefixes the frontend may ever see. */
const PUBLIC_PREFIXES = ['VITE_'];

/** Variables that must never be exposed to client bundles. */
const SECRET_NAME_RE = /(SECRET|TOKEN|PASSWORD|PRIVATE|API_?KEY)/i;

let loaded = false;

/** Load the root .env once (idempotent; never overrides real env vars). */
export function loadRootEnv(): void {
  if (loaded) return;
  loaded = true;
  dotenv.config({ path: ROOT_ENV_PATH });
}

/** Returns human-readable problems (key names only — never values). */
export function envProblems(): string[] {
  loadRootEnv();
  const problems: string[] = [];

  for (const key of REQUIRED_SERVER_ENV) {
    const value = process.env[key];
    if (!value || !value.trim()) {
      problems.push(
        `Missing required variable ${key}. Set it in the repository root .env ` +
          `(see .env.example) or in your hosting provider's environment settings.`,
      );
    }
  }

  // A secret-looking name with a public prefix would be bundled into the
  // frontend by Vite — refuse to run rather than leak it.
  for (const key of Object.keys(process.env)) {
    const isPublic = PUBLIC_PREFIXES.some((p) => key.startsWith(p));
    if (isPublic && SECRET_NAME_RE.test(key)) {
      problems.push(
        `${key} uses the public ${PUBLIC_PREFIXES[0]} prefix but its name indicates a secret. ` +
          `Remove the prefix so it stays server-side.`,
      );
    }
  }

  const port = process.env.PORT;
  if (port && !/^\d+$/.test(port.trim())) {
    problems.push(`PORT must be a numeric value (got a non-numeric value for the key PORT).`);
  }

  return problems;
}

/** Fail fast with actionable, secret-free messages; call at startup. */
export function validateEnvOrExit(): void {
  const problems = envProblems();
  if (problems.length > 0) {
    console.error('[stockly-server] environment validation failed:');
    for (const p of problems) console.error(`  - ${p}`);
    console.error(`  (root env file: ${ROOT_ENV_PATH})`);
    process.exit(1);
  }
}

// Side effect: importing this module loads the root .env immediately, so
// modules imported after it (the api/* handlers) see a complete
// environment regardless of where they read it.
loadRootEnv();
