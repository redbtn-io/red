import { NextRequest } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';
import { createSSEResponse } from '@red/stream/sse';

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

    // Check ownership
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

    // Mark stream as ready before subscribing
    await messageQueue.markStreamReady(messageId);

    // Wrap messageQueue.subscribeToMessage as async generator that yields
    // the events in the SSE-compatible format expected by the frontend
    async function* messageEvents() {
      const stream = messageQueue.subscribeToMessage(messageId);

      for await (const event of stream) {
        if (event.type === 'init' && event.existingContent) {
          // Send existing content in chunks for smooth display
          const chunks = event.existingContent.match(/.{1,50}/g) || [];
          for (const chunk of chunks) {
            yield { type: 'content', content: chunk };
          }
        } else if (event.type === 'chunk') {
          yield event.thinking
            ? { type: 'chunk', content: event.content, thinking: true }
            : { type: 'content', content: event.content };
        } else if (event.type === 'status') {
          yield { type: 'status', action: event.action, description: event.description };
        } else if (event.type === 'thinking') {
          yield { type: 'thinking', content: event.content };
        } else if (event.type === 'tool_status') {
          yield { type: 'tool_status', status: event.status, action: event.action };
        } else if (event.type === 'tool_event') {
          yield { type: 'tool_event', event: event.event };
        } else if (event.type === 'complete') {
          yield { type: 'complete', metadata: event.metadata };
          return; // Terminal
        } else if (event.type === 'error') {
          yield { type: 'error', error: event.error };
          return; // Terminal
        }
      }
    }

    return createSSEResponse(messageEvents(), {
      keepaliveMs: 1000,
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
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
