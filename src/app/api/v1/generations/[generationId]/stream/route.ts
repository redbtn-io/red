/**
 * API endpoint for SSE streaming of generation logs
 * GET /api/v1/generations/:generationId/stream
 * 
 * Returns Server-Sent Events with real-time log updates
 */

import { NextRequest } from 'next/server';
import { getDatabase, getRunState } from '@redbtn/redbtn';
import { getLogStream } from '@/lib/redlog';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';

export const runtime = 'nodejs';

function getRedis(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, { maxRetriesPerRequest: 3 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  const user = await verifyAuth(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { generationId } = await params;

  if (!generationId) {
    return new Response('generationId is required', { status: 400 });
  }

  // Verify ownership via RunState's conversation
  const redis = getRedis();
  try {
    const runState = await getRunState(redis, generationId);
    if (runState?.conversationId) {
      const db = getDatabase();
      const conversation = await db.getConversation(runState.conversationId);
      if (conversation?.userId && conversation.userId !== user.userId) {
        return new Response('Forbidden', { status: 403 });
      }
    }
  } finally {
    redis.disconnect();
  }

  const logStream = getLogStream();

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Stream logs via RedLog
        for await (const log of logStream.subscribe('generationId', generationId, { catchUp: true })) {
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
