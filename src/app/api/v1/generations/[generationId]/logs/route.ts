/**
 * API endpoint to get all logs for a generation
 * GET /api/v1/generations/:generationId/logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { red } from '@/lib/red';

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
