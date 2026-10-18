/* One browser data layer for both frontends: configuration, the API
 * client, the inventory store (optimistic UI + durable outbox), auth and
 * device sessions, user profiles, sheet connection checks, releases, and
 * the owner-console client. Import the module you need:
 *
 *   import { useStore } from '@stockly/shared-client/store';
 *   import { api } from '@stockly/shared-client/api';
 *   import { getAuthSession } from '@stockly/shared-client/auth';
 */
export * from './config.ts';
export * from './api.ts';
export * from './auth.ts';
export * from './devices.ts';
export * from './users.ts';
export * from './connection.ts';
export * from './admin-api.ts';
export * from './releases.ts';
