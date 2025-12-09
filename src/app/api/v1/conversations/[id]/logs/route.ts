/**
 * API endpoint to get all logs for a conversation
 * GET /api/v1/conversations/:id/logs?limit=100
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    const red = await getRed();
    
    // Get all logs for this conversation
    const logs = await red.logger.getConversationLogs(conversationId, limit);
    
    return NextResponse.json({
      conversationId,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('[API] Error fetching conversation logs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
