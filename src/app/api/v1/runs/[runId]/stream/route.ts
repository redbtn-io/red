import { NextRequest } from 'next/server';
import { RunKeys, getRunState } from '@redbtn/redbtn';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';
import { StreamSubscriber } from '@red/stream';
import { createSSEResponse } from '@red/stream/sse';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Stream endpoint for run events via SSE
 * 
 * Features:
 * - Immediate streaming via async generator
 * - Event replay from Redis list for late connections
 * - Last-Event-ID support for reconnection
 * - Keepalive to prevent connection timeout
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
  
  // Verify ownership by checking run state
  let verificationRedis: Redis | null = null;
  try {
    verificationRedis = new Redis(REDIS_URL);
    const stateJson = await verificationRedis.get(RunKeys.state(runId));
    if (stateJson) {
      const state = JSON.parse(stateJson);
      if (state.userId && state.userId !== user.userId) {
        return new Response(
          JSON.stringify({ error: { message: 'Forbidden', type: 'forbidden' } }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  } finally {
    if (verificationRedis) {
      try { await verificationRedis.quit(); } catch { /* ignore */ }
    }
  }

  const lastEventIdHeader = request.headers.get('Last-Event-ID');
  const lastEventId = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : undefined;
  
  console.log(`[RunStream] ${new Date().toISOString()} SSE request for run: ${runId}${lastEventId != null ? ` (reconnect from event ${lastEventId})` : ''}`);

  const redis = new Redis(REDIS_URL);
  const channel = RunKeys.stream(runId);
  const eventsKey = RunKeys.events(runId);
  const stateKey = RunKeys.state(runId);

  const subscriber = new StreamSubscriber({ redis, channel, eventsKey });

  return createSSEResponse(
    subscriber.subscribe({
      catchUp: true,
      lastEventId,
      terminalEvents: ['run_complete', 'run_error'],
      idleTimeoutMs: 30_000,
      isAlive: async () => {
        const stateJson = await redis.get(stateKey);
        if (!stateJson) return true; // No state yet — run hasn't started
        const state = JSON.parse(stateJson);
        return state.status !== 'completed' && state.status !== 'error';
      },
    }),
    {
      keepaliveMs: 15_000,
      retryMs: 5000,
      onInit: async () => {
        // Send init event with current state for graph viewer
        const stateJson = await redis.get(stateKey);
        if (!stateJson) return undefined;
        const state = JSON.parse(stateJson);
        return {
          type: 'init',
          runId,
          state: {
            runId: state.runId,
            graphId: state.graphId,
            graphName: state.graphName,
            status: state.status,
            startedAt: state.startedAt,
            completedAt: state.completedAt,
            graph: state.graph,
            output: state.output,
          },
          existingContent: state.output?.content || '',
          existingThinking: state.output?.thinking || '',
          timestamp: Date.now(),
        };
      },
      onClose: async () => {
        try { await redis.quit(); } catch { /* ignore */ }
      },
    }
  );
}
