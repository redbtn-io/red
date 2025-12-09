/**
 * API endpoint for SSE streaming of generation logs
 * GET /api/v1/generations/:generationId/stream
 * 
 * Returns Server-Sent Events with real-time log updates
 */

import { NextRequest } from 'next/server';
import { getRed } from '@/lib/red';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const { generationId } = await params;
  
  if (!generationId) {
    return new Response('generationId is required', { status: 400 });
  }

  const red = await getRed();
  
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
