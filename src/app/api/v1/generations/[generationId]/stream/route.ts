/**
 * API endpoint for SSE streaming of generation logs
 * GET /api/v1/generations/:generationId/stream
 * 
 * Returns Server-Sent Events with real-time log updates
 */

import { NextRequest } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { generationId } = await params;
  
  if (!generationId) {
    return new Response('generationId is required', { status: 400 });
  }

  const red = await getRed();

  // Verify ownership via generation's conversation
  const generation = await red.logger.getGeneration(generationId);
  if (generation) {
    const db = getDatabase();
    const conversation = await db.getConversation(generation.conversationId);
    if (conversation?.userId && conversation.userId !== user.userId) {
      return new Response('Forbidden', { status: 403 });
    }
  }
  
  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream logs from logger
        for await (const log of red.logger.subscribeToGeneration(generationId)) {
          const data = `data: ${JSON.stringify(log)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        
        // Send completion event
        controller.enqueue(encoder.encode('event: complete\ndata: {}\n\n'));
        controller.close();
      } catch (error) {
        console.error('[API] Error streaming generation logs:', error);
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
