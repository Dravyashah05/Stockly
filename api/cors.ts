type CorsRequest = { headers?: Record<string, string | string[] | undefined> };
type CorsResponse = { setHeader: (name: string, value: string) => void };

const DEFAULT_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3003',
  'https://localhost',
  'capacitor://localhost',
];

/** Apply the same exact-origin CORS policy to Vercel and Express handlers. */
export function applyApiCors(req: CorsRequest, res: CorsResponse): void {
  const originValue = req.headers?.origin;
  const origin = Array.isArray(originValue) ? originValue[0] : originValue;
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = new Set([...DEFAULT_ORIGINS, ...configuredOrigins]);

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Session');
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
}
