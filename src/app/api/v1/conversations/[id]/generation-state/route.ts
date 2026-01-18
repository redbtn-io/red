/**
 * API endpoint to get conversation generation state
 * GET /api/v1/conversations/:id/generation-state
 * 
 * Returns current generation status, prevents concurrent generations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
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

    const red = await getRed();
    
    // Get generation state
    const state = await red.logger.getConversationGenerationState(conversationId);
    
    if (!state) {
      return NextResponse.json({
        conversationId,
        isGenerating: false,
        generationCount: 0,
      });
    }
    
    // Check if current generation is still active
    let isGenerating = false;
    if (state.currentGenerationId) {
      const generation = await red.logger.getGeneration(state.currentGenerationId);
      isGenerating = generation?.status === 'generating';
    }
    
    return NextResponse.json({
      conversationId,
      isGenerating,
      currentGenerationId: state.currentGenerationId,
      lastGenerationId: state.lastGenerationId,
      generationCount: state.generationCount,
    });
  } catch (error) {
    console.error('[API] Error fetching generation state:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
