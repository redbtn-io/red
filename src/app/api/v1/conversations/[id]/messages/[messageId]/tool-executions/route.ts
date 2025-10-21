import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@redbtn/ai';

/**
 * POST /api/v1/conversations/[id]/messages/[messageId]/tool-executions
 * Update a message with tool execution data after generation completes
 * Called by frontend after streaming completes to persist tool data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id: conversationId, messageId } = await params;
    
    if (!conversationId || !messageId) {
      return NextResponse.json(
        { error: 'Conversation ID and message ID are required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { toolExecutions } = body;

    if (!Array.isArray(toolExecutions)) {
      return NextResponse.json(
        { error: 'toolExecutions must be an array' },
        { status: 400 }
      );
    }

    console.log(`[API] Updating message ${messageId} with ${toolExecutions.length} tool executions`);

    // Update the message in the database with tool execution data
    const db = getDatabase();
    
    // Update the message using MongoDB updateOne
    await db.updateOne('messages', 
      { messageId: messageId },
      { $set: { toolExecutions: toolExecutions } }
    ).catch((err: unknown) => {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[API] Failed to update message with tool executions:', errorMessage);
      // Continue anyway - tool executions are primarily for UI enhancement
    });

    return NextResponse.json({
      success: true,
      messageId,
      toolExecutionsCount: toolExecutions.length
    });

  } catch (error) {
    console.error('[API] Error updating message with tool executions:', error);
    return NextResponse.json(
      { error: 'Failed to update tool executions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}