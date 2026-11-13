export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export const RATE_LIMIT_CONFIG = {
  aiDesign: {
    limit: 5,
    windowSeconds: 60,
  },
  aiSpec: {
    limit: 3,
    windowSeconds: 60,
  },
} as const;

interface RateLimitGlobal {
  __ghostAiRateLimitStore?: Map<string, number[]>;
  __ghostAiLastCleanup?: number;
}

const globalForRateLimit = globalThis as typeof globalThis & RateLimitGlobal;

const rateLimitStore =
  globalForRateLimit.__ghostAiRateLimitStore ?? new Map<string, number[]>();

globalForRateLimit.__ghostAiRateLimitStore = rateLimitStore;

const CLEANUP_INTERVAL_MS = 60_000;
const MAX_ENTRY_RETENTION_MS = 3_600_000; // 1 hour

function cleanupExpiredEntries(now: number): void {
  const lastCleanup = globalForRateLimit.__ghostAiLastCleanup ?? 0;
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }

  globalForRateLimit.__ghostAiLastCleanup = now;

  for (const [key, timestamps] of rateLimitStore.entries()) {
    const valid = timestamps.filter((ts) => now - ts < MAX_ENTRY_RETENTION_MS);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else if (valid.length !== timestamps.length) {
      rateLimitStore.set(key, valid);
    }
  }
}

/**
 * Sliding window rate limiter backed by globalThis in-memory state.
 *
 * @param key Unique identifier for the rate limit subject (e.g. `ai-design:${userId}`)
 * @param limit Maximum number of allowed requests within the window
 * @param windowSeconds Window duration in seconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const safeLimit = Math.max(1, limit);
  const safeWindowSeconds = Math.max(1, windowSeconds);
  const windowMs = safeWindowSeconds * 1000;
  const now = Date.now();

  cleanupExpiredEntries(now);

  const windowStart = now - windowMs;
  const existing = rateLimitStore.get(key) ?? [];
  const validTimestamps = existing.filter((ts) => ts > windowStart);

  if (validTimestamps.length >= safeLimit) {
    rateLimitStore.set(key, validTimestamps);
    const oldestTimestamp = validTimestamps[0] ?? now;
    const resetInSeconds = Math.max(
      1,
      Math.ceil((oldestTimestamp + windowMs - now) / 1000)
    );

    return {
      success: false,
      limit: safeLimit,
      remaining: 0,
      resetInSeconds,
    };
  }

  validTimestamps.push(now);
  rateLimitStore.set(key, validTimestamps);

  const oldestTimestamp = validTimestamps[0] ?? now;
  const resetInSeconds = Math.max(
    1,
    Math.ceil((oldestTimestamp + windowMs - now) / 1000)
  );
  const remaining = Math.max(0, safeLimit - validTimestamps.length);

  return {
    success: true,
    limit: safeLimit,
    remaining,
    resetInSeconds,
  };
}

/**
 * Helper to generate standard HTTP rate limit headers.
 */
export function getRateLimitHeaders(
  result: RateLimitResult,
  nowSeconds = Math.ceil(Date.now() / 1000)
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": `${result.limit}`,
    "X-RateLimit-Remaining": `${result.remaining}`,
    "X-RateLimit-Reset": `${nowSeconds + result.resetInSeconds}`,
  };

  if (!result.success) {
    headers["Retry-After"] = `${result.resetInSeconds}`;
  }

  return headers;
}

/**
 * Helper to reset rate limits (primarily used in tests or administrative resets).
 */
export function resetRateLimitStore(key?: string): void {
  if (key) {
    rateLimitStore.delete(key);
  } else {
    rateLimitStore.clear();
  }
}

