/**
 * Rate limiting exists to stop one bad actor from spamming fake listings,
 * hammering the claim endpoint to probe for race conditions, or running up
 * your Stripe API usage. This is NOT optional for a public payments endpoint.
 *
 * In-memory fallback only works correctly on a single server process. The
 * moment you deploy more than one instance (which most serverless hosts do
 * by default), each instance has its own counter and the effective limit
 * multiplies by instance count. Set UPSTASH_REDIS_REST_URL/TOKEN before
 * going to production with real traffic.
 */

type Bucket = { count: number; resetAt: number };
const memoryStore = new Map<string, Bucket>();

const hasRedis = !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisIncr(key: string, windowSeconds: number): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL!;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
  // Pipeline: INCR then EXPIRE (only takes effect on first increment in Redis,
  // but Upstash's NX-style expire-if-new-key pattern below is race-safe enough
  // for rate limiting purposes, which tolerates slight fuzziness).
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSeconds.toString(), "NX"],
    ]),
  });
  const data = await res.json();
  return data?.[0]?.result ?? 0;
}

function memoryIncr(key: string, windowSeconds: number): number {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt < now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }
  existing.count += 1;
  return existing.count;
}

/**
 * Returns true if the request should be ALLOWED, false if it should be
 * blocked with a 429. `key` should include the action name and an identifier
 * (hashed IP, not raw) so different endpoints have independent limits.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const count = hasRedis ? await redisIncr(key, windowSeconds) : memoryIncr(key, windowSeconds);
  return { allowed: count <= maxRequests, remaining: Math.max(0, maxRequests - count) };
}

/** Extracts a client IP from standard proxy headers. Never trust this for
 * anything security-critical beyond rate limiting / abuse heuristics -
 * headers can be spoofed by a direct client unless your host strips them. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
