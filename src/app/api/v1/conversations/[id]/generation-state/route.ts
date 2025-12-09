/**
 * API endpoint to get conversation generation state
 * GET /api/v1/conversations/:id/generation-state
 * 
 * Returns current generation status, prevents concurrent generations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
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
