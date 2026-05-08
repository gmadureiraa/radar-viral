/**
 * Rate-limit helper.
 *
 * Backends:
 *  - Upstash Redis quando UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 *    estão setados (sliding window, distributed, sobrevive cold start).
 *  - In-memory fallback caso contrário (best-effort, por instância — não
 *    funciona bem em Vercel multi-region, mas evita crash em dev/preview).
 *
 * API:
 *   await rateLimit({ key, limit, windowMs })
 *   → { success, retryAfterSec, limit, remaining }
 *
 * Convenção de keys:
 *   stripe:checkout:<userId>
 *   img:<ip>
 *   videos-admin:<userId>
 *   ...
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitInput {
  key: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  retryAfterSec?: number;
  limit: number;
  remaining: number;
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  if (!_redis) {
    _redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
  }
  return _redis;
}

const limiterCache = new Map<string, Ratelimit>();
function getRedisLimiter(limit: number, windowMs: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  const cacheKey = `${limit}:${windowMs}`;
  const cached = limiterCache.get(cacheKey);
  if (cached) return cached;
  const ms = `${windowMs} ms` as `${number} ms`;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, ms),
    prefix: "rdv:rl",
    analytics: false,
  });
  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// Fallback in-memory. Map<key, hits[]> com timestamps. Limpeza lazy.
const memoryHits = new Map<string, number[]>();
let warnedMissingRedis = false;

function memoryRateLimit(input: RateLimitInput): RateLimitResult {
  if (!warnedMissingRedis) {
    console.warn(
      "[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN ausentes — usando fallback in-memory (não funciona em Vercel multi-region).",
    );
    warnedMissingRedis = true;
  }
  const now = Date.now();
  const cutoff = now - input.windowMs;
  const arr = memoryHits.get(input.key) ?? [];
  const fresh = arr.filter((t) => t > cutoff);
  if (fresh.length >= input.limit) {
    const oldest = fresh[0];
    const retryAfterSec = Math.max(
      1,
      Math.ceil((oldest + input.windowMs - now) / 1000),
    );
    memoryHits.set(input.key, fresh);
    return {
      success: false,
      retryAfterSec,
      limit: input.limit,
      remaining: 0,
    };
  }
  fresh.push(now);
  memoryHits.set(input.key, fresh);
  return {
    success: true,
    limit: input.limit,
    remaining: input.limit - fresh.length,
  };
}

export async function rateLimit(
  input: RateLimitInput,
): Promise<RateLimitResult> {
  const limiter = getRedisLimiter(input.limit, input.windowMs);
  if (!limiter) return memoryRateLimit(input);
  try {
    const res = await limiter.limit(input.key);
    const retryAfterSec = res.success
      ? undefined
      : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
    return {
      success: res.success,
      retryAfterSec,
      limit: res.limit,
      remaining: res.remaining,
    };
  } catch (err) {
    console.error("[rate-limit] redis failed, fallback memory:", err);
    return memoryRateLimit(input);
  }
}

/** Header padrão pra responder 429. */
export function rateLimitHeaders(res: RateLimitResult): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(res.limit),
    "X-RateLimit-Remaining": String(res.remaining),
  };
  if (res.retryAfterSec) h["Retry-After"] = String(res.retryAfterSec);
  return h;
}
