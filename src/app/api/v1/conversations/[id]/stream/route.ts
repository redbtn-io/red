/**
 * API endpoint for SSE streaming of conversation logs
 * GET /api/v1/conversations/:id/stream
 * 
 * Returns Server-Sent Events with real-time log updates for all generations in a conversation
 */

import { NextRequest } from 'next/server';
import { getRed } from '@/lib/red';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  
  if (!conversationId) {
    return new Response('conversationId is required', { status: 400 });
  }

  const red = await getRed();
  
  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream logs from logger
        for await (const log of red.logger.subscribeToConversation(conversationId)) {
          const data = `data: ${JSON.stringify(log)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        
        controller.close();
      } catch (error) {
        console.error('[API] Error streaming conversation logs:', error);
        const errorData = `event: error\ndata: ${JSON.stringify({ error: 'Stream error' })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
