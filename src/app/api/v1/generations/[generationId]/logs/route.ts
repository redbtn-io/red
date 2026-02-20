/**
 * API endpoint to get all logs for a generation
 * GET /api/v1/generations/:generationId/logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getRunState } from '@redbtn/redbtn';
import { getLogReader } from '@/lib/redlog';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';

function getRedis(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, { maxRetriesPerRequest: 3 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { generationId } = await params;

    if (!generationId) {
      return NextResponse.json(
        { error: 'generationId is required' },
        { status: 400 }
      );
    }

    // Verify ownership via RunState's conversation
    const redis = getRedis();
    try {
      const runState = await getRunState(redis, generationId);
      if (runState?.conversationId) {
        const db = getDatabase();
        const conversation = await db.getConversation(runState.conversationId);
        if (conversation?.userId && conversation.userId !== user.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
    } finally {
      redis.disconnect();
    }

    // Get all logs for this generation
    const reader = getLogReader();
    const logs = await reader.query({
      scope: { generationId },
      order: 'asc',
    });

    return NextResponse.json({
      generationId,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('[API] Error fetching generation logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
