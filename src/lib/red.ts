/**
 * redbtn instance initialization for Next.js API routes
 */
import { Red, RedConfig, getDatabase } from '@redbtn/redbtn';

// Re-export getDatabase for convenience
export { getDatabase };

const config: RedConfig = {
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  vectorDbUrl: process.env.VECTOR_DB_URL || "http://localhost:8200",
  databaseUrl: process.env.MONGODB_URI || "mongodb://localhost:27017/redbtn",
  chatLlmUrl: process.env.CHAT_LLM_URL || "http://localhost:11434",
  workLlmUrl: process.env.WORK_LLM_URL || "http://localhost:11434",
};

let redInstance: Red | null = null;

// Check if we're in a build environment (no database needed)
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

/**
 * Get or initialize the redbtn instance
 * Singleton pattern to avoid multiple initializations
 */
export async function getRed(): Promise<Red> {
  if (isBuildTime) {
    throw new Error('redbtn not available during build time');
  }
  if (!redInstance) {
    redInstance = new Red(config);
    await redInstance.load('webapp-api');
    console.log('✅ redbtn initialized successfully');
  }
  return redInstance;
}

/**
 * Synchronous access to Red instance (must be initialized first)
 * Use getRed() for guaranteed initialization
 */
export function getRedSync(): Red {
  if (isBuildTime) {
    throw new Error('redbtn not available during build time');
  }
  if (!redInstance) {
    throw new Error('Red instance not initialized. Call getRed() first.');
  }
  return redInstance;
}

// Note: Lazy initialization - red instance is created on first getRed() call
// No top-level await to avoid initialization during build time

/**
 * Graceful shutdown handler
 * Kills MCP stdio server child processes when Next.js process terminates
 */
async function shutdown(signal: string) {
  console.log(`\n[Red] Received ${signal}, shutting down gracefully...`);
  if (redInstance) {
    try {
      await redInstance.shutdown();
      console.log('[Red] Shutdown complete');
    } catch (error) {
      console.error('[Red] Error during shutdown:', error);
    }
  }
  process.exit(0);
}

// Register signal handlers for graceful shutdown (only at runtime, not during build)
if (!isBuildTime) {
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
