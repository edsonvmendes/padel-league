type AttemptBucket = {
  count: number;
  resetAt: number;
  blockedUntil: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const buckets = new Map<string, AttemptBucket>();

function now() {
  return Date.now();
}

function getBucket(key: string): AttemptBucket {
  const current = now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= current) {
    const fresh = { count: 0, resetAt: current + WINDOW_MS, blockedUntil: 0 };
    buckets.set(key, fresh);
    return fresh;
  }

  return existing;
}

export function checkLoginRateLimit(key: string): RateLimitResult {
  const bucket = getBucket(key);
  const current = now();

  if (bucket.blockedUntil > current) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((bucket.blockedUntil - current) / 1000),
    };
  }

  return { allowed: true };
}

export function recordLoginFailure(key: string): RateLimitResult {
  const bucket = getBucket(key);
  const current = now();

  bucket.count += 1;

  if (bucket.count >= MAX_FAILED_ATTEMPTS) {
    bucket.blockedUntil = current + BLOCK_MS;
    bucket.resetAt = bucket.blockedUntil + WINDOW_MS;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(BLOCK_MS / 1000),
    };
  }

  return { allowed: true };
}

export function clearLoginRateLimit(key: string) {
  buckets.delete(key);
}

export function getLoginRateLimitConfig() {
  return {
    maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    windowSeconds: Math.ceil(WINDOW_MS / 1000),
    blockSeconds: Math.ceil(BLOCK_MS / 1000),
  };
}
