/**
 * Next.js Instrumentation
 * 
 * This file is automatically loaded by Next.js on server startup.
 * Used to initialize background services like file watchers.
 */

export async function register() {
  // Only run in Node.js runtime (not edge), and only in development
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NODE_ENV === 'development') {
    const { startProviderFileWatcher } = await import('./lib/sync-connection-providers');
    
    console.log('🚀 Starting connection providers file watcher...');
    startProviderFileWatcher();
  }
}
