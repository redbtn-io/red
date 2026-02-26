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
import { createSSEResponse } from '@red/stream/sse';

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

  // Verify ownership
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
  return createSSEResponse(logStream.subscribe('generationId', generationId, { catchUp: true }));
}
