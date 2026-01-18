import { NextRequest } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

// Force dynamic rendering and disable caching
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * Stream endpoint for reconnectable message generation
 * Subscribes to Redis pub/sub and streams message content via SSE
 * Handles reconnection by sending existing content first, then new chunks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { messageId } = await params;
  
  console.log(`[Stream] Client connecting to message: ${messageId}`);

  try {
    const red = await getRed();
    const messageQueue = red.messageQueue;

    // Check if message state exists and verify ownership
    const existingState = await messageQueue.getMessageState(messageId);
    if (existingState) {
      const db = getDatabase();
      const conversation = await db.getConversation(existingState.conversationId);
      if (conversation?.userId && conversation.userId !== user.userId) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create SSE stream with proper cleanup
    const encoder = new TextEncoder();
    let messageStream: Awaited<ReturnType<typeof messageQueue.subscribeToMessage>> | null = null;
    let isCancelled = false;
    let controllerClosed = false;

    const safeEnqueue = (data: Uint8Array): boolean => {
      if (isCancelled || controllerClosed) return false;
      try {
        controller.enqueue(data);
        return true;
      } catch {
        // Controller closed during enqueue
        controllerClosed = true;
        return false;
      }
    };

    const safeClose = () => {
      if (controllerClosed) return;
      try {
        controller.close();
        controllerClosed = true;
      } catch {
        // Already closed
        controllerClosed = true;
      }
    };

    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream({
      async start(ctrl) {
        controller = ctrl;
        
        try {
          // Send initial comment to establish connection and prevent buffering
          safeEnqueue(encoder.encode(`: connected\n\n`));
          console.log(`[Stream] Connection established for ${messageId}`);
          
          // Start a keepalive interval to prevent buffering
          const keepaliveInterval = setInterval(() => {
            if (!isCancelled && !controllerClosed) {
              safeEnqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`));
            } else {
              clearInterval(keepaliveInterval);
            }
          }, 1000); // Send keepalive every second
          
          // Mark stream as ready FIRST, before subscribing
          // This signals to the completions endpoint that we're connected
          await messageQueue.markStreamReady(messageId);
          console.log(`[Stream] Marked stream ready for ${messageId}`);
          
          // Send another keepalive to ensure connection is fully open
          safeEnqueue(encoder.encode(`: ready\n\n`));
          
          // Subscribe to message updates
          messageStream = messageQueue.subscribeToMessage(messageId);

          for await (const event of messageStream) {
            // Check if stream was cancelled
            if (isCancelled) {
              console.log('[Stream] Stream cancelled, stopping iteration');
              break;
            }

            if (event.type === 'init' && event.existingContent) {
              // Send existing content in chunks for smooth display
              console.log(`[Stream] Sending ${event.existingContent.length} chars of existing content`);
              const chunks = event.existingContent.match(/.{1,50}/g) || [];
              for (const chunk of chunks) {
                if (isCancelled) break;
                
                const data = {
                  type: 'content',
                  content: chunk
                };
                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))) {
                  break;
                }
              }
            } else if (event.type === 'chunk') {
              // Forward chunk - check if it's thinking or regular content
              const data = event.thinking ? {
                type: 'chunk',
                content: event.content,
                thinking: true
              } : {
                type: 'content',
                content: event.content
              };
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))) {
                break;
              }
            } else if (event.type === 'status') {
              // Send status update (processing, thinking, routing, etc.)
              console.log('[SSE] Forwarding status:', event.action);
              const data = {
                type: 'status',
                action: event.action,
                description: event.description
              };
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              // Force flush with comment
              safeEnqueue(encoder.encode(`: flush\n\n`));
            } else if (event.type === 'thinking') {
              // Stream thinking/reasoning content (legacy full block)
              const data = {
                type: 'thinking',
                content: event.content
              };
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))) {
                break;
              }
            } else if (event.type === 'tool_status') {
              // Send tool status indicator
              const data = {
                type: 'tool_status',
                status: event.status,
                action: event.action
              };
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              // Force flush with comment
              safeEnqueue(encoder.encode(`: flush\n\n`));
            } else if (event.type === 'tool_event') {
              // Forward unified tool event to client
              const data = {
                type: 'tool_event',
                event: event.event
              };
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              // Force flush with comment
              safeEnqueue(encoder.encode(`: flush\n\n`));
            } else if (event.type === 'complete') {
              // Send completion event
              const data = {
                type: 'complete',
                metadata: event.metadata
              };
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              safeEnqueue(encoder.encode('data: [DONE]\n\n'));
              break;
            } else if (event.type === 'error') {
              // Send error event
              const data = {
                type: 'error',
                error: event.error
              };
              safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              break;
            }
          }

          safeClose();
        } catch (error) {
          console.error('[Stream] Error:', error);
          const data = {
            type: 'error',
            error: error instanceof Error ? error.message : String(error)
          };
          safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          safeClose();
        }
      },
      async cancel() {
        console.log(`[Stream] Client disconnected from message: ${messageId}`);
        isCancelled = true;
        
        // Clean up the async generator/Redis subscription
        if (messageStream && typeof messageStream.return === 'function') {
          try {
            await messageStream.return(undefined);
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      }
    });
  } catch (error) {
    console.error('[Stream] Failed to create stream:', error);
    return new Response(
      JSON.stringify({
        error: {
          message: error instanceof Error ? error.message : 'Failed to create stream',
          type: 'stream_error'
        }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
