/* Stockly health probe (Vercel serverless + Express).
 *
 * Minimal liveness check: returns status and timestamp.
 * Does not expose secrets or internal configuration.
 */

type QueryValue = string | string[] | undefined;

interface HealthReq {
  method?: string;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string | string[] | undefined>;
}

interface HealthRes {
  status: (code: number) => HealthRes;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
}

export default async function handler(req: HealthReq, res: HealthRes): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).json({ success: true });
    return;
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
