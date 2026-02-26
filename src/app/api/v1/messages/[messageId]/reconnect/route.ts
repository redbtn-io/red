import { NextRequest } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';
import { createSSEResponse } from '@red/stream/sse';

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
  console.log('[Reconnect] Reconnecting to stream for messageId:', messageId);
  
  try {
    const red = await getRed();
    const existingState = await red.messageQueue.getMessageState(messageId);
    
    if (!existingState) {
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify ownership
    const db = getDatabase();
    const conversation = await db.getConversation(existingState.conversationId);
    if (conversation?.userId && conversation.userId !== user.userId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    async function* reconnectEvents() {
      // Send init event with existing content
      yield {
        type: 'init',
        messageId,
        conversationId: existingState!.conversationId,
        existingContent: existingState!.content || '',
        existingThinking: existingState!.thinking || '',
      };

      // Replay tool events
      if (existingState!.toolEvents?.length) {
        for (const toolEvent of existingState!.toolEvents) {
          yield { type: 'tool_event', event: toolEvent };
        }
      }

      // If already terminal, send and return
      if (existingState!.status === 'completed') {
        yield { type: 'complete', metadata: existingState!.metadata };
        return;
      }
      if (existingState!.status === 'error') {
        yield { type: 'error', error: existingState!.error || 'Generation failed' };
        return;
      }

      // Still generating — subscribe for remaining events
      const messageStream = red.messageQueue.subscribeToMessage(messageId);
      for await (const event of messageStream) {
        if (event.type === 'chunk') {
          yield { type: 'chunk', content: event.content, thinking: event.thinking || false };
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
          return;
        } else if (event.type === 'error') {
          yield { type: 'error', error: event.error };
          return;
        }
      }
    }

    return createSSEResponse(reconnectEvents());
  } catch (error) {
    console.error('[Reconnect] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
