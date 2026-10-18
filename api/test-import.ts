type QueryValue = string | string[] | undefined;

interface Req {
  method?: string;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string | string[] | undefined>;
}

interface Res {
  status: (code: number) => Res;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

export default async function handler(req: Req, res: Res): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  const fs = await import('node:fs');
  const path = await import('node:path');
  const results: Record<string, unknown> = {
    nodeVersion: process.version,
    taskFiles: fs.readdirSync('/var/task'),
    apiFiles: fs.existsSync('/var/task/api') ? fs.readdirSync('/var/task/api') : 'NOT_FOUND',
  };

  try {
    // @ts-ignore
    await import('./auth-logic.js');
    results.authLogicJs = 'OK';
  } catch (e: unknown) {
    results.authLogicJs = e instanceof Error ? (e.stack || e.message) : String(e);
  }

  try {
    await import('./schema.ts');
    results.schema = 'OK';
  } catch (e: unknown) {
    results.schema = e instanceof Error ? (e.stack || e.message) : String(e);
  }

  try {
    await import('./apps-script-client.ts');
    results.appsScriptClient = 'OK';
  } catch (e: unknown) {
    results.appsScriptClient = e instanceof Error ? (e.stack || e.message) : String(e);
  }

  try {
    await import('./device-logic.ts');
    results.deviceLogic = 'OK';
  } catch (e: unknown) {
    results.deviceLogic = e instanceof Error ? (e.stack || e.message) : String(e);
  }

  try {
    await import('./admin-logic.ts');
    results.adminLogic = 'OK';
  } catch (e: unknown) {
    results.adminLogic = e instanceof Error ? (e.stack || e.message) : String(e);
  }

  res.status(200).json({ success: true, results });
}
