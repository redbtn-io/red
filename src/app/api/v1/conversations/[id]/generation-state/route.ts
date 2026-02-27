/**
 * API endpoint to get conversation generation state
 * GET /api/v1/conversations/:id/generation-state
 * 
 * Returns current generation status using the v2 RunPublisher system.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/red';
import { getActiveRunForConversation, getRunState } from '@redbtn/redbtn';
import { verifyAuth } from '@/lib/auth/auth';
import { getRedis } from '@/lib/redis/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);
    if (conversation?.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const redis = getRedis();
    try {
      const runId = await getActiveRunForConversation(redis, conversationId);
      let isGenerating = false;
      let currentGenerationId: string | undefined;

      if (runId) {
        const runState = await getRunState(redis, runId);
        if (runState && (runState.status === 'pending' || runState.status === 'running')) {
          isGenerating = true;
          currentGenerationId = runId;
        }
      }

      return NextResponse.json({
        conversationId,
        isGenerating,
        currentGenerationId,
      });
    } finally {
      redis.disconnect();
    }
  } catch (error) {
    console.error('[API] Error fetching generation state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
