/**
 * Rate limiting utilities for API protection
 * 
 * Supports both in-memory (development) and Redis (production) backends
 */

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Time window in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Current request count in window */
  count: number;
  /** Maximum allowed requests */
  limit: number;
  /** Milliseconds until the rate limit resets */
  resetMs: number;
  /** Remaining requests in current window */
  remaining: number;
}

// In-memory store for development (single-server only)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Clean up expired entries from memory store
 */
function cleanupMemoryStore() {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}

// Cleanup every minute
setInterval(cleanupMemoryStore, 60000);

/**
 * Check rate limit using in-memory store
 */
async function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  
  const existing = memoryStore.get(identifier);
  
  if (!existing || existing.resetAt < now) {
    // New window
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    
    return {
      success: true,
      count: 1,
      limit: config.limit,
      resetMs: windowMs,
      remaining: config.limit - 1,
    };
  }
  
  // Existing window
  const newCount = existing.count + 1;
  const resetMs = existing.resetAt - now;
  
  if (newCount > config.limit) {
    return {
      success: false,
      count: newCount - 1, // Don't increment
      limit: config.limit,
      resetMs,
      remaining: 0,
    };
  }
  
  memoryStore.set(identifier, {
    count: newCount,
    resetAt: existing.resetAt,
  });
  
  return {
    success: true,
    count: newCount,
    limit: config.limit,
    resetMs,
    remaining: config.limit - newCount,
  };
}

/**
 * Check rate limit using Redis (production)
 * Requires REDIS_URL environment variable
 */
async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Lazy load Redis only when needed
  const { Redis } = await import('ioredis');
  
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  
  try {
    await redis.connect();
    
    const key = `ratelimit:${identifier}`;
    const windowMs = config.windowSeconds * 1000;
    
    // Use Redis transaction for atomic operations
    const multi = redis.multi();
    multi.incr(key);
    multi.pexpire(key, windowMs);
    multi.pttl(key);
    
    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis transaction failed');
    }
    
    const count = results[0][1] as number;
    const ttl = results[2][1] as number;
    const resetMs = ttl > 0 ? ttl : windowMs;
    
    await redis.quit();
    
    if (count > config.limit) {
      return {
        success: false,
        count: count - 1,
        limit: config.limit,
        resetMs,
        remaining: 0,
      };
    }
    
    return {
      success: true,
      count,
      limit: config.limit,
      resetMs,
      remaining: Math.max(0, config.limit - count),
    };
  } catch (error) {
    await redis.quit();
    console.error('[RateLimit] Redis error, falling back to memory:', error);
    return checkRateLimitMemory(identifier, config);
  }
}

/**
 * Main rate limit check function
 * Automatically uses Redis in production, in-memory for development
 * Note: Middleware uses in-memory only due to edge runtime limitations
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  useRedis: boolean = true
): Promise<RateLimitResult> {
  // Use Redis if URL is provided and allowed, otherwise use memory
  if (useRedis && process.env.REDIS_URL && typeof window === 'undefined') {
    try {
      return await checkRateLimitRedis(identifier, config);
    } catch (error) {
      console.error('[RateLimit] Redis error, falling back to memory:', error);
      return checkRateLimitMemory(identifier, config);
    }
  }
  
  return checkRateLimitMemory(identifier, config);
}

/**
 * Get identifier from request (IP address or user ID)
 */
export function getRateLimitIdentifier(request: Request, userId?: string): string {
  // Prefer user ID for authenticated requests
  if (userId) {
    return `user:${userId}`;
  }
  
  // Try to get real IP from various headers (for reverse proxy setups)
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
  
  const ip = forwarded?.split(',')[0].trim() || realIp || cfConnectingIp || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Preset rate limit configs
 */
export const RateLimits = {
  /** Very strict - for sensitive operations like login attempts */
  STRICT: { limit: 5, windowSeconds: 60 } as RateLimitConfig,
  
  /** Standard - for authenticated API endpoints */
  STANDARD: { limit: 100, windowSeconds: 60 } as RateLimitConfig,
  
  /** Relaxed - for public read-only endpoints */
  RELAXED: { limit: 300, windowSeconds: 60 } as RateLimitConfig,
  
  /** Auth - for authentication endpoints (magic links, login) */
  AUTH: { limit: 20, windowSeconds: 180 } as RateLimitConfig, // 20 requests per 3 minutes
  
  /** Chat - for chat completion endpoints */
  CHAT: { limit: 30, windowSeconds: 60 } as RateLimitConfig,
};
