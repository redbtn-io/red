import { NextRequest } from 'next/server';
import { getRed } from '@/lib/red';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
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
          // Send init event with existing content
          console.log('[Reconnect] Sending init with existing content');
          if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'init',
            messageId,
            conversationId: existingState.conversationId,
            existingContent: existingState.content || ''
          })}\n\n`))) {
            return;
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
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                content: event.content
              })}\n\n`))) break;
            } else if (event.type === 'status') {
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'status',
                action: event.action,
                description: event.description
              })}\n\n`))) break;
            } else if (event.type === 'thinking_chunk') {
              if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'thinking_chunk',
                content: event.content
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
