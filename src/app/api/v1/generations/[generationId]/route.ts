/**
 * API endpoint to get generation/run metadata
 * GET /api/v1/generations/:generationId
 * 
 * Uses the v2 RunPublisher system. The generationId IS the runId.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getRunState } from '@redbtn/redbtn';
import { verifyAuth } from '@/lib/auth/auth';
import { getRedis } from '@/lib/redis/client';

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

    const redis = getRedis();
    try {
      const runState = await getRunState(redis, generationId);

      if (!runState) {
        return NextResponse.json(
          { error: 'Generation not found' },
          { status: 404 }
        );
      }

      // Verify ownership via conversation
      if (runState.conversationId) {
        const db = getDatabase();
        const conversation = await db.getConversation(runState.conversationId);
        if (conversation?.userId && conversation.userId !== user.userId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      // Map RunState status to legacy generation-compatible response
      const statusMap: Record<string, string> = {
        pending: 'generating',
        running: 'generating',
        completed: 'completed',
        error: 'error',
      };

      return NextResponse.json({
        id: runState.runId,
        conversationId: runState.conversationId,
        status: statusMap[runState.status] || runState.status,
        startedAt: runState.startedAt,
        completedAt: runState.completedAt,
        error: runState.error,
        graphId: runState.graphId,
        graphName: runState.graphName,
      });
    } finally {
      redis.disconnect();
    }
  } catch (error) {
    console.error('[API] Error fetching generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
