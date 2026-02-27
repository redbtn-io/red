import { NextRequest, NextResponse } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { getActiveRunForConversation, getRunState } from '@redbtn/redbtn';
import { verifyAuth } from '@/lib/auth/auth';
import { getRedis } from '@/lib/redis/client';

// Get Redis instance

/**
 * Get active generation for a conversation
 * Returns the runId if there's an ongoing run (new v2 system)
 * Falls back to messageId for legacy support
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: conversationId } = await params;
  
  // Verify ownership
  const db = getDatabase();
  const conversation = await db.getConversation(conversationId);
  if (conversation?.userId && conversation.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const red = await getRed();
    const redis = getRedis();
    
    try {
      // First, check for active run using new v2 system
      const runId = await getActiveRunForConversation(redis, conversationId);
      
      if (runId) {
        const runState = await getRunState(redis, runId);
        if (runState && (runState.status === 'pending' || runState.status === 'running')) {
          return NextResponse.json({
            active: true,
            runId,
            conversationId,
            status: runState.status,
            startedAt: runState.startedAt,
            graphId: runState.graphId,
            graphName: runState.graphName,
          });
        }
      }
      
      // Fallback: Check legacy message-based generation system
      const generatingMessages = await red.messageQueue.getGeneratingMessages(conversationId);
      
      if (generatingMessages.length === 0) {
        return NextResponse.json({ active: false });
      }
      
      // Return the first active generation (there should only be one)
      const activeGeneration = generatingMessages[0];
      
      return NextResponse.json({
        active: true,
        messageId: activeGeneration.messageId,
        conversationId: activeGeneration.conversationId,
        status: activeGeneration.status,
        startedAt: activeGeneration.startedAt,
      });
    } finally {
      redis.disconnect();
    }
  } catch (error) {
    console.error('[API] Error checking active generation:', error);
    return NextResponse.json(
      { error: 'Failed to check active generation' },
      { status: 500 }
    );
  }
}
