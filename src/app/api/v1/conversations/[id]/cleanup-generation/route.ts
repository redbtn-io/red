/**
 * API endpoint to force cleanup of a stale generation
 * POST /api/v1/conversations/:id/cleanup-generation
 * 
 * Use this to recover from crashed generations
 */

import { NextRequest, NextResponse } from 'next/server';
import { red } from '@/lib/red';

export async function POST(
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
    
    // Get generation state
    const state = await red.logger.getConversationGenerationState(conversationId);
    
    if (!state || !state.currentGenerationId) {
      return NextResponse.json({
        success: true,
        message: 'No generation in progress',
      });
    }
    
    // Check if generation exists and mark as failed
    const generation = await red.logger.getGeneration(state.currentGenerationId);
    
    if (generation && generation.status === 'generating') {
      // Mark as failed
      await red.logger.failGeneration(
        state.currentGenerationId,
        'Generation manually cleaned up'
      );
      
      return NextResponse.json({
        success: true,
        message: 'Generation cleaned up',
        generationId: state.currentGenerationId,
      });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Generation already completed or failed',
    });
  } catch (error) {
    console.error('[API] Error cleaning up generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
