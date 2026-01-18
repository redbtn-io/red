import { NextRequest } from 'next/server';
import { RunKeys } from '@redbtn/ai';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

// Get Redis URL from environment
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * Stream endpoint for run events via SSE
 * 
 * Features:
 * - Immediate streaming via async generator
 * - Event replay from Redis list for late connections
 * - Last-Event-ID support for reconnection
 * - Keepalive to prevent connection timeout
 * 
 * Reconnection scenarios:
 * 1. Mid-run disconnect: Client reconnects with Last-Event-ID, resumes from that point
 * 2. Post-run reconnect: Client gets full replay + [DONE] immediately
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
    const stateKey = RunKeys.state(runId);
    const stateJson = await verificationRedis.get(stateKey);
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
  
  // Get Last-Event-ID header for reconnection support
  // This is the index of the last event the client received
  const lastEventIdHeader = request.headers.get('Last-Event-ID');
  const lastEventId = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : -1;
  const isReconnect = lastEventId >= 0;
  
  console.log(`[RunStream] ${new Date().toISOString()} SSE request for run: ${runId}${isReconnect ? ` (reconnect from event ${lastEventId})` : ''}`);

  const encoder = new TextEncoder();

  // Create async generator that yields SSE events
  async function* generateSSE(): AsyncGenerator<Uint8Array, void, unknown> {
    // Yield connection immediately
    yield encoder.encode(`: connected${isReconnect ? ' (reconnected)' : ''}\n\n`);
    
    let redis: Redis | null = null;
    let subscriber: Redis | null = null;
    let keepaliveInterval: NodeJS.Timeout | null = null;
    let isCancelled = false;
    
    const cleanup = async () => {
      isCancelled = true;
      if (keepaliveInterval) {
        clearInterval(keepaliveInterval);
        keepaliveInterval = null;
      }
      try {
        if (subscriber) {
          await subscriber.quit();
          subscriber = null;
        }
        if (redis) {
          await redis.quit();
          redis = null;
        }
      } catch {
        // Ignore cleanup errors
      }
    };
    
    // Helper to format SSE event with ID
    const formatEvent = (eventJson: string, eventIndex: number): string => {
      return `id: ${eventIndex}\ndata: ${eventJson}\n\n`;
    };
    
    try {
      redis = new Redis(REDIS_URL);
      subscriber = redis.duplicate();
      
      const channel = RunKeys.stream(runId);
      const eventsKey = RunKeys.events(runId);
      const stateKey = RunKeys.state(runId);
      
      // Queue for events from pub/sub
      const eventQueue: string[] = [];
      let resolveWait: (() => void) | null = null;
      let replayComplete = false;
      let streamDone = false;
      let currentEventIndex = 0; // Track current event index for ID
      
      // Subscribe FIRST (before replay to catch events during replay)
      await subscriber.subscribe(channel);
      console.log(`[RunStream] ${new Date().toISOString()} Subscribed to ${channel}`);
      
      // Set up message handler - buffers events during replay
      subscriber.on('message', (_ch: string, message: string) => {
        if (isCancelled || streamDone) return;
        
        eventQueue.push(message);
        // Wake up the generator if it's waiting
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      });
      
      // Get all stored events
      const events = await redis.lrange(eventsKey, 0, -1);
      const totalStoredEvents = events.length;
      
      // Determine starting point based on Last-Event-ID
      const startIndex = isReconnect ? lastEventId + 1 : 0;
      const eventsToReplay = startIndex < events.length ? events.slice(startIndex) : [];
      
      console.log(`[RunStream] ${new Date().toISOString()} Total events: ${totalStoredEvents}, starting from: ${startIndex}, replaying: ${eventsToReplay.length}`);
      
      // Send init event with current state (for graph viewer initialization)
      // Always send if state exists - this ensures graph viewer is initialized on any connection
      const stateJsonForInit = await redis.get(stateKey);
      if (stateJsonForInit) {
        const state = JSON.parse(stateJsonForInit);
        const initEvent = {
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
        yield encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`);
        console.log(`[RunStream] ${new Date().toISOString()} Sent init event with state: status=${state.status}, content=${state.output?.content?.length || 0} chars, graph.nodesExecuted=${state.graph?.nodesExecuted || 0}`);
      }
      
      // Replay events from startIndex
      if (eventsToReplay.length > 0) {
        for (let i = 0; i < eventsToReplay.length; i++) {
          const eventJson = eventsToReplay[i];
          currentEventIndex = startIndex + i;
          yield encoder.encode(formatEvent(eventJson, currentEventIndex));
          
          // Check for terminal event
          try {
            const event = JSON.parse(eventJson);
            if (event.type === 'run_complete' || event.type === 'run_error') {
              yield encoder.encode('data: [DONE]\n\n');
              await cleanup();
              return;
            }
          } catch { /* ignore */ }
        }
        currentEventIndex = startIndex + eventsToReplay.length - 1;
      } else {
        currentEventIndex = Math.max(0, totalStoredEvents - 1);
      }
      
      // Check state - if run is already complete, we're done
      const stateJson = await redis.get(stateKey);
      if (stateJson) {
        const state = JSON.parse(stateJson);
        console.log(`[RunStream] ${new Date().toISOString()} Current status=${state.status}`);
        
        if (state.status === 'completed' || state.status === 'error') {
          // Run is done - send retry: 0 to prevent auto-reconnect
          yield encoder.encode('retry: 0\n');
          yield encoder.encode('data: [DONE]\n\n');
          await cleanup();
          return;
        }
      } else if (totalStoredEvents === 0 && !isReconnect) {
        // No state and no events yet - run hasn't started or doesn't exist
        // Continue waiting for events
        console.log(`[RunStream] ${new Date().toISOString()} Run ${runId} not yet created, waiting...`);
      }
      
      // Mark replay complete
      replayComplete = true;
      
      // Process any buffered pub/sub events that arrived during replay
      if (eventQueue.length > 0) {
        // Fetch current list to check for new events
        const currentLength = await redis.llen(eventsKey);
        if (currentLength > totalStoredEvents) {
          // New events were stored - fetch only new ones
          const newEvents = await redis.lrange(eventsKey, totalStoredEvents, -1);
          console.log(`[RunStream] ${new Date().toISOString()} ${newEvents.length} new events during replay`);
          
          for (let i = 0; i < newEvents.length; i++) {
            const eventJson = newEvents[i];
            currentEventIndex = totalStoredEvents + i;
            yield encoder.encode(formatEvent(eventJson, currentEventIndex));
            
            try {
              const event = JSON.parse(eventJson);
              if (event.type === 'run_complete' || event.type === 'run_error') {
                yield encoder.encode('retry: 0\n');
                yield encoder.encode('data: [DONE]\n\n');
                await cleanup();
                return;
              }
            } catch { /* ignore */ }
          }
          currentEventIndex = totalStoredEvents + newEvents.length - 1;
        }
        // Clear buffer - we got everything from the list
        eventQueue.length = 0;
      }
      
      console.log(`[RunStream] ${new Date().toISOString()} Replay complete, streaming live from index ${currentEventIndex + 1}`);
      
      // Set retry interval for auto-reconnect (5 seconds)
      yield encoder.encode('retry: 5000\n\n');
      
      // Start keepalive
      keepaliveInterval = setInterval(() => {
        if (!isCancelled && !streamDone) {
          eventQueue.push('KEEPALIVE');
          if (resolveWait) {
            resolveWait();
            resolveWait = null;
          }
        }
      }, 15000); // 15 second keepalive
      
      // Stream live events
      while (!isCancelled && !streamDone) {
        // Wait for events if queue is empty
        if (eventQueue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWait = resolve;
            // Timeout to check for cancellation periodically
            setTimeout(() => {
              if (resolveWait === resolve) {
                resolveWait = null;
                resolve();
              }
            }, 30000); // 30 second check interval
          });
        }
        
        // Process all queued events
        while (eventQueue.length > 0 && !isCancelled && !streamDone) {
          const item = eventQueue.shift()!;
          
          if (item === 'KEEPALIVE') {
            yield encoder.encode(`: keepalive ${Date.now()}\n\n`);
            continue;
          }
          
          currentEventIndex++;
          yield encoder.encode(formatEvent(item, currentEventIndex));
          
          // Check for terminal event
          try {
            const event = JSON.parse(item);
            if (event.type === 'run_complete' || event.type === 'run_error') {
              yield encoder.encode('retry: 0\n');
              yield encoder.encode('data: [DONE]\n\n');
              streamDone = true;
              break;
            }
          } catch { /* ignore */ }
        }
      }
      
      await cleanup();
      
    } catch (error) {
      console.error('[RunStream] Error:', error);
      yield encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`);
      await cleanup();
    }
  }

  // Convert async generator to ReadableStream
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of generateSSE()) {
          controller.enqueue(chunk);
        }
      } catch (error) {
        console.error('[RunStream] Stream error:', error);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }
  });
}
