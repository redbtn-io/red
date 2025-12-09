/**
 * API endpoint to get generation metadata
 * GET /api/v1/generations/:generationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
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
    
    return NextResponse.json(generation);
  } catch (error) {
    console.error('[API] Error fetching generation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
