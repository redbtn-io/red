/**
 * API endpoint to get logging system stats
 * GET /api/v1/logs/stats
 * 
 * Returns statistics about the logging system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getActiveRunForConversation } from '@redbtn/redbtn';
import { getLogReader } from '@/lib/redlog';
import type { LogEntry } from '@redbtn/redlog';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';

function getRedis(): Redis {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  return new Redis(redisUrl, { maxRetriesPerRequest: 3 });
}

export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // Verify ownership
      const db = getDatabase();
      const conversation = await db.getConversation(conversationId);
      if (conversation?.userId && conversation.userId !== user.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const reader = getLogReader();

      // Stats for a specific conversation
      const logs = await reader.query({
        scope: { conversationId },
        limit: 10000,
        order: 'asc',
      });

      // Check if a run is active
      const redis = getRedis();
      let isGenerating = false;
      try {
        const runId = await getActiveRunForConversation(redis, conversationId);
        isGenerating = !!runId;
      } finally {
        redis.disconnect();
      }

      // Count by level
      const byLevel = logs.reduce((acc: Record<string, number>, log: LogEntry) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count by category
      const byCategory = logs.reduce((acc: Record<string, number>, log: LogEntry) => {
        const cat = log.category ?? 'uncategorized';
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return NextResponse.json({
        conversationId,
        totalLogs: logs.length,
        isGenerating,
        byLevel,
        byCategory,
      });
    }

    // Global stats would require scanning all Redis keys
    return NextResponse.json({
      status: 'operational',
      message: 'Logging system is running. Provide conversationId for detailed stats.',
    });
  } catch (error) {
    console.error('[API] Error fetching logging stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
