import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting for serverless/Vercel functions using Upstash Redis
 * (works across cold starts / multiple regions, unlike in-memory
 * counters). If Upstash env vars are not configured, limiting is
 * disabled and a console warning is logged — the app still runs,
 * but this is intentionally loud so it isn't silently skipped in
 * production. Do not deploy to production without configuring
 * Upstash.
 */

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (!redis && process.env.NODE_ENV === "production") {
  console.warn(
    "[SECURITY WARNING] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured. Rate limiting is running on an in-memory fallback that cannot coordinate across distributed serverless instances."
  );
}

function buildLimiter(requests: number, window: `${number} ${"s" | "m" | "h"}`) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

// Resilient in-memory fallback cache when Redis is offline or not configured
const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

function checkInMemoryLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();

  // Periodic eviction if memory cache grows large
  if (inMemoryStore.size > 2000) {
    for (const [k, rec] of inMemoryStore.entries()) {
      if (now > rec.resetAt) inMemoryStore.delete(k);
    }
  }

  const record = inMemoryStore.get(key);

  if (!record || now > record.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { success: false, remaining: 0 };
  }

  record.count += 1;
  return { success: true, remaining: limit - record.count };
}

const FALLBACK_LIMITS: Record<keyof typeof limiters, { limit: number; windowMs: number }> = {
  login: { limit: 5, windowMs: 60_000 },
  mfaVerification: { limit: 5, windowMs: 60_000 },
  signup: { limit: 3, windowMs: 600_000 },
  passwordReset: { limit: 3, windowMs: 600_000 },
  publicOrder: { limit: 5, windowMs: 60_000 },
  cartOrder: { limit: 10, windowMs: 60_000 },
  customOrder: { limit: 5, windowMs: 60_000 },
  imageUpload: { limit: 20, windowMs: 60_000 },
  adminAction: { limit: 30, windowMs: 60_000 },
  checkout: { limit: 10, windowMs: 60_000 },
  apiDefault: { limit: 60, windowMs: 60_000 },
};

export const limiters = {
  login: buildLimiter(5, "1 m"),
  mfaVerification: buildLimiter(5, "1 m"),
  signup: buildLimiter(3, "10 m"),
  passwordReset: buildLimiter(3, "10 m"),
  publicOrder: buildLimiter(5, "1 m"),
  cartOrder: buildLimiter(10, "1 m"),
  customOrder: buildLimiter(5, "1 m"),
  imageUpload: buildLimiter(20, "1 m"),
  adminAction: buildLimiter(30, "1 m"),
  checkout: buildLimiter(10, "1 m"),
  apiDefault: buildLimiter(60, "1 m"),
};

/**
 * Returns { success: false } if the caller has exceeded the limit.
 * `identifier` should be something like the client IP plus route
 * name, e.g. `login:${ip}`.
 */
export async function checkRateLimit(
  limiterKey: keyof typeof limiters,
  identifier: string
): Promise<{ success: boolean; remaining?: number }> {
  const limiter = limiters[limiterKey];
  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return { success: result.success, remaining: result.remaining };
    } catch (err) {
      console.warn(`[rate-limit] Upstash error, switching to in-memory fallback:`, err);
    }
  }

  // Fallback to in-memory sliding window
  const conf = FALLBACK_LIMITS[limiterKey] || { limit: 30, windowMs: 60_000 };
  return checkInMemoryLimit(`${limiterKey}:${identifier}`, conf.limit, conf.windowMs);
}

/** Best-effort client IP extraction for serverless/Vercel. */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
