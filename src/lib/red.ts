/**
 * Red AI instance initialization for Next.js API routes
 */
import { Red, RedConfig } from '@redbtn/ai';

const config: RedConfig = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  vectorDbUrl: process.env.VECTOR_DB_URL || "http://localhost:8200",
  databaseUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/redbtn",
  chatLlmUrl: process.env.CHAT_LLM_URL || "http://localhost:11434",
  workLlmUrl: process.env.WORK_LLM_URL || "http://localhost:11434",
};

let redInstance: Red | null = null;

/**
 * Get or initialize the Red AI instance
 * Singleton pattern to avoid multiple initializations
 */
export async function getRed(): Promise<Red> {
  if (!redInstance) {
    redInstance = new Red(config);
    await redInstance.load('webapp-api');
    console.log('✅ Red AI initialized successfully');
  }
  return redInstance;
}

/**
 * Synchronous access to Red instance (must be initialized first)
 * Use getRed() for guaranteed initialization
 */
export function getRedSync(): Red {
  if (!redInstance) {
    throw new Error('Red instance not initialized. Call getRed() first.');
  }
  return redInstance;
}

// Initialize immediately for synchronous access in API routes
// This allows `import { red }` to work
let initPromise: Promise<Red> | null = null;

if (!initPromise) {
  initPromise = getRed();
}

// Export as named export for convenience
export const red = await initPromise;

/**
 * Bearer token for API authentication
 */
export const BEARER_TOKEN = process.env.BEARER_TOKEN || `red_ai_sk_${Date.now()}`;
