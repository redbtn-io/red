/**
 * API endpoint to get generation metadata
 * GET /api/v1/generations/:generationId
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
    
    // Get generation data from logger
    const generation = await red.logger.getGeneration(generationId);
    
    if (!generation) {
      return NextResponse.json(
        { error: 'Generation not found' },
        { status: 404 }
      );
    }

    // Verify ownership via conversation
    const db = getDatabase();
    const conversation = await db.getConversation(generation.conversationId);
    if (conversation?.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json(generation);
  } catch (error) {
    console.error('[API] Error fetching generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
