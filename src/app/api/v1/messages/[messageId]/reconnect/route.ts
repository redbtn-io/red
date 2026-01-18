import { NextRequest } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

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

  // Await params in Next.js 15
  const { messageId } = await params;
  
  console.log('[Reconnect] Reconnecting to stream for messageId:', messageId);
  
  try {
    const red = await getRed();
    const encoder = new TextEncoder();
    
    // Check if message exists in Redis
    const existingState = await red.messageQueue.getMessageState(messageId);
    
    if (!existingState) {
      console.log('[Reconnect] No state found for messageId:', messageId);
      return new Response(
        JSON.stringify({ error: 'Message not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify ownership via conversation
    const db = getDatabase();
    const conversation = await db.getConversation(existingState.conversationId);
    if (conversation?.userId && conversation.userId !== user.userId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('[Reconnect] Found existing state:', existingState.status, existingState.content?.length || 0, 'chars');
    
    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        let streamClosed = false;
        
        // Helper to safely enqueue
        const safeEnqueue = (data: Uint8Array) => {
          if (streamClosed) return false;
          try {
            controller.enqueue(data);
            return true;
          } catch (error) {
            if (error instanceof Error && error.message.includes('Controller is already closed')) {
              console.log('[Reconnect] Stream closed by client');
              streamClosed = true;
              return false;
            }
            throw error;
          }
        };
        
        try {
          // Send init event with existing content and thinking
          console.log('[Reconnect] Sending init event with existing content');
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'init',
            messageId,
            conversationId: existingState.conversationId,
            existingContent: existingState.content || '',
            existingThinking: existingState.thinking || ''
          })}\n\n`))) {
            return;
          }
          
          // If there are tool events, replay them
          if (existingState.toolEvents && existingState.toolEvents.length > 0) {
            console.log('[Reconnect] Replaying tool events, count:', existingState.toolEvents.length);
            for (const toolEvent of existingState.toolEvents) {
              if (streamClosed) break;
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_event',
                event: toolEvent
              })}\n\n`))) {
                return;
              }
              // Small delay to allow frontend to process events in order
              await new Promise(resolve => setTimeout(resolve, 5));
            }
          }
          
          // If already completed, send complete event and close
          if (existingState.status === 'completed') {
            console.log('[Reconnect] Generation already completed');
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'complete',
              metadata: existingState.metadata
            })}\n\n`));
            safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            if (!streamClosed) controller.close();
            return;
          }
          
          // If failed, send error and close
          if (existingState.status === 'error') {
            console.log('[Reconnect] Generation failed:', existingState.error);
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: existingState.error || 'Generation failed'
            })}\n\n`));
            safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            if (!streamClosed) controller.close();
            return;
          }
          
          // Still generating - subscribe to pub/sub for remaining events
          console.log('[Reconnect] Subscribing to pub/sub for remaining events');
          const messageStream = red.messageQueue.subscribeToMessage(messageId);
          
          for await (const event of messageStream) {
            if (streamClosed) {
              console.log('[Reconnect] Stream closed, stopping subscription');
              break;
            }
            
            console.log('[Reconnect] Received event:', event.type);
            
            if (event.type === 'chunk') {
              // Forward chunk event as-is (includes thinking flag if present)
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'chunk',
                content: event.content,
                thinking: event.thinking || false
              })}\n\n`))) break;
            } else if (event.type === 'status') {
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'status',
                action: event.action,
                description: event.description
              })}\n\n`))) break;
            } else if (event.type === 'thinking') {
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'thinking',
                content: event.content
              })}\n\n`))) break;
            } else if (event.type === 'tool_status') {
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_status',
                status: event.status,
                action: event.action
              })}\n\n`))) break;
            } else if (event.type === 'tool_event') {
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'tool_event',
                event: event.event
              })}\n\n`))) break;
            } else if (event.type === 'complete') {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                metadata: event.metadata
              })}\n\n`));
              break;
            } else if (event.type === 'error') {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: event.error
              })}\n\n`));
              break;
            }
          }
          
          safeEnqueue(encoder.encode('data: [DONE]\n\n'));
          if (!streamClosed) controller.close();
        } catch (error) {
          console.error('[Reconnect] Stream error:', error);
          if (!streamClosed) {
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              error: error instanceof Error ? error.message : String(error)
            })}\n\n`));
            controller.close();
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
    console.error('[Reconnect] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
