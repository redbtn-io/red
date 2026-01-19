import { NextRequest } from 'next/server';
import { RunPublisher } from '@redbtn/redbtn';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Get Redis URL from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * GET /api/v1/runs/[runId]
 * 
 * Retrieve the current state of a run.
 * Returns the full RunState object including:
 * - Status (pending, running, completed, error)
 * - Output (accumulated content, thinking, data)
 * - Graph execution trace (nodes executed, current node)
 * - Tool executions
 * - Metadata (model, tokens)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return new Response(
      JSON.stringify({ error: { message: 'Unauthorized', type: 'unauthorized' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { runId } = await params;
  
  console.log(`[RunState] Getting state for run: ${runId}`);

  let redis: Redis | null = null;
  
  try {
    // Create Redis client
    redis = new Redis(REDIS_URL);
    
    // Create RunPublisher instance for state access
    const publisher = new RunPublisher({ redis, runId, userId: 'state-client' });
    
    // Get run state
    const state = await publisher.getState();
    
    if (!state) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Run not found: ${runId}`,
            type: 'not_found'
          }
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify ownership
    if (state.userId && state.userId !== user.userId) {
      return new Response(
        JSON.stringify({ error: { message: 'Forbidden', type: 'forbidden' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(state),
      {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      }
    );
  } catch (error) {
    console.error('[RunState] Failed to get state:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Failed to get run state',
          type: 'internal_error'
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } finally {
    // Cleanup Redis connection
    if (redis) {
      try {
        await redis.quit();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
