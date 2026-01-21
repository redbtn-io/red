/**
 * OAuth State Management
 * 
 * Stores OAuth flow state in Redis for CSRF protection.
 * States expire after 10 minutes (OAuth flows should complete quickly).
 */

import Redis from 'ioredis';
import { generateOAuthState } from './utils';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const STATE_TTL_SECONDS = 600; // 10 minutes
const STATE_PREFIX = 'oauth:state:';

/**
 * OAuth state data stored during the flow
 */
export interface IOAuthStateData {
  userId: string;
  providerId: string;
  label: string;
  requestedScopes: string[];
  codeVerifier?: string;
  createdAt: number;
}

let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
    });
  }
  return redisClient;
}

/**
 * Create and store a new OAuth state
 * @returns The generated state token
 */
export async function createOAuthState(data: Omit<IOAuthStateData, 'createdAt'>): Promise<string> {
  const redis = getRedis();
  const state = generateOAuthState();
  
  const stateData: IOAuthStateData = {
    ...data,
    createdAt: Date.now(),
  };
  
  const key = `${STATE_PREFIX}${state}`;
  await redis.setex(key, STATE_TTL_SECONDS, JSON.stringify(stateData));
  
  return state;
}

/**
 * Get OAuth state data
 * @returns The state data if found and valid, null otherwise
 */
export async function getOAuthState(state: string): Promise<IOAuthStateData | null> {
  if (!state) return null;
  
  const redis = getRedis();
  const key = `${STATE_PREFIX}${state}`;
  const data = await redis.get(key);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data) as IOAuthStateData;
  } catch {
    return null;
  }
}

/**
 * Delete OAuth state (one-time use)
 * @returns true if state existed and was deleted
 */
export async function deleteOAuthState(state: string): Promise<boolean> {
  if (!state) return false;
  
  const redis = getRedis();
  const key = `${STATE_PREFIX}${state}`;
  const deleted = await redis.del(key);
  
  return deleted > 0;
}

/**
 * Validate and consume OAuth state (get + delete atomically)
 * Uses GETDEL for true atomicity (Redis 6.2+)
 * Falls back to multi/exec for older Redis versions
 * @returns The state data if valid, null if not found or invalid
 */
export async function consumeOAuthState(state: string): Promise<IOAuthStateData | null> {
  if (!state) return null;
  
  const redis = getRedis();
  const key = `${STATE_PREFIX}${state}`;
  
  let data: string | null = null;
  
  try {
    // Try GETDEL first (atomic, Redis 6.2+)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data = await (redis as any).getdel(key);
  } catch {
    // Fall back to multi/exec for older Redis versions
    const multi = redis.multi();
    multi.get(key);
    multi.del(key);
    const results = await multi.exec();
    
    if (results && results[0] && results[0][1]) {
      data = results[0][1] as string;
    }
  }
  
  if (!data) {
    return null;
  }
  
  try {
    return JSON.parse(data) as IOAuthStateData;
  } catch {
    return null;
  }
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeOAuthStateConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
