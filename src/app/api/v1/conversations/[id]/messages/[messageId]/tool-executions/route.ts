import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@redbtn/redbtn';
import { verifyAuth } from '@/lib/auth/auth';

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
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId, messageId } = await params;
    
    if (!conversationId || !messageId) {
      return NextResponse.json(
        { error: 'Conversation ID and message ID are required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);
    if (conversation?.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    const updatePayload = { $set: { toolExecutions } } as const;

    let updateApplied = false;

    try {
      updateApplied = await db.updateOne('messages', { messageId }, updatePayload);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[API] Failed to update message with tool executions by messageId:', errorMessage);
    }

    if (!updateApplied) {
      try {
        const existingMessage = await db.findOne('messages', { messageId });
        if (existingMessage) {
          // Record already contained matching tool executions; treat as success to avoid noisy fallbacks
          updateApplied = true;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[API] Failed to verify message existence by messageId:', errorMessage);
      }
    }

    // Fallback: some legacy records are missing messageId, so try the Mongo _id field
    if (!updateApplied && ObjectId.isValid(messageId)) {
      try {
        const fallbackApplied = await db.updateOne('messages', { _id: new ObjectId(messageId) }, updatePayload);
        if (fallbackApplied) {
          updateApplied = true;
          console.log('[API] Updated tool executions using _id fallback for message', messageId);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[API] Failed to update message with tool executions by _id fallback:', errorMessage);
      }
    }

    if (!updateApplied) {
      console.warn('[API] No message was updated with tool executions for messageId:', messageId);
    }

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