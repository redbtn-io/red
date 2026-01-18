/**
 * API endpoint to get all logs for a generation
 * GET /api/v1/generations/:generationId/logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    // Verify authentication
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

    const red = await getRed();

    // Verify ownership via generation's conversation
    const generation = await red.logger.getGeneration(generationId);
    if (generation) {
      const db = getDatabase();
      const conversation = await db.getConversation(generation.conversationId);
      if (conversation?.userId && conversation.userId !== user.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    
    // Get all logs for this generation
    const logs = await red.logger.getGenerationLogs(generationId);
    
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
