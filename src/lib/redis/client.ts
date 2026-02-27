/**
 * Shared Redis client factory for API routes.
 *
 * Creates per-request Redis connections (short-lived, for pub/sub or one-off reads).
 * For long-lived singletons, use the queue client or RedisManager from @red/stream.
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Create a Redis client for a single request scope.
 * Callers are responsible for calling `.disconnect()` when done.
 */
export function getRedis(): Redis {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
}
