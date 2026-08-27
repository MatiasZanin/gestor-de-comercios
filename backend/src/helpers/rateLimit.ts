import { TooManyRequestsError } from './errors';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function assertRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (bucket.count >= limit) {
    throw new TooManyRequestsError(
      'Demasiadas solicitudes. Esperá un momento e intentá nuevamente.'
    );
  }

  bucket.count += 1;
}
