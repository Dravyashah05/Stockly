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
  const results: Record<string, string> = {
    nodeVersion: process.version,
  };

  try {
    await import('./auth-logic.ts');
    results.authLogic = 'OK';
  } catch (e: unknown) {
    results.authLogic = e instanceof Error ? (e.stack || e.message) : String(e);
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
