/* Shared guard for all server-to-Google outbound fetches (server-side only).
 *
 * Every Apps Script call previously had NO timeout: one stalled Google
 * execution hung the request until the platform killed it (and piled up
 * sockets on long-lived Express). All Google traffic now races a single
 * AbortSignal with a deployment-tunable budget. No retries here: these
 * helpers carry both reads AND writes, and blindly replaying a timed-out
 * append/update could duplicate rows — callers surface 502 and the client
 * verifies before resubmitting (idempotency keys).
 */

const DEFAULT_TIMEOUT_MS = 50_000;
const MIN_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 120_000;

/** Budget for one upstream round-trip. `STOCKLY_UPSTREAM_TIMEOUT_MS` (ms,
 *  clamped to 5s–120s) lets slow-script deployments raise it; anything else
 *  falls back to 50s. Keep it above the client's own timeouts (25–30s) so a
 *  slow-but-legit cold start fails on the client first with verify-safe
 *  semantics instead of dying server-side mid-write. */
export function upstreamTimeoutMs(): number {
  const text = (process.env.STOCKLY_UPSTREAM_TIMEOUT_MS ?? '').trim();
  if (!text) return DEFAULT_TIMEOUT_MS;
  const raw = Number(text);
  if (!Number.isFinite(raw)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.floor(raw)));
}

/** AbortSignal that fires when the upstream budget expires. */
export function upstreamSignal(): AbortSignal {
  return AbortSignal.timeout(upstreamTimeoutMs());
}

/** True for the rejection `AbortSignal.timeout` produces. */
export function isUpstreamTimeout(e: unknown): boolean {
  return e instanceof Error && e.name === 'TimeoutError';
}
