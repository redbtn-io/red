import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

/**
 * POST /api/v1/conversations/[id]/messages/[messageId]/graph-run
 * Save graph run state to a message after generation completes
 * Called by frontend after graph run completes to persist graph execution history
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
    const { graphRun } = body;

    if (!graphRun || typeof graphRun !== 'object') {
      return NextResponse.json(
        { error: 'graphRun object is required' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!graphRun.graphId || !graphRun.status || !Array.isArray(graphRun.executionPath)) {
      return NextResponse.json(
        { error: 'graphRun must have graphId, status, and executionPath' },
        { status: 400 }
      );
    }

    console.log(`[API] Saving graph run for message ${messageId}:`, {
      graphId: graphRun.graphId,
      status: graphRun.status,
      executionPathLength: graphRun.executionPath.length,
      nodeProgressCount: Object.keys(graphRun.nodeProgress || {}).length,
    });

    // Update the message in the database with graph run data
    const updatePayload = { $set: { graphRun } } as const;

    let updateApplied = false;

    try {
      updateApplied = await db.updateOne('messages', { messageId }, updatePayload);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[API] Failed to update message with graph run by messageId:', errorMessage);
    }

    if (!updateApplied) {
      try {
        const existingMessage = await db.findOne('messages', { messageId });
        if (existingMessage && existingMessage.graphRun) {
          // Record already contained graph run; treat as success
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
          console.log('[API] Updated graph run using _id fallback for message', messageId);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[API] Failed to update message with graph run by _id fallback:', errorMessage);
      }
    }

    if (!updateApplied) {
      console.warn('[API] No message was updated with graph run for messageId:', messageId);
    }

    return NextResponse.json({
      success: true,
      messageId,
      graphId: graphRun.graphId,
      status: graphRun.status,
    });

  } catch (error) {
    console.error('[API] Error saving graph run:', error);
    return NextResponse.json(
      { error: 'Failed to save graph run', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/conversations/[id]/messages/[messageId]/graph-run
 * Get graph run state for a message
 */
export async function GET(
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

    const db = getDatabase();
    
    let message = null;
    
    try {
      message = await db.findOne('messages', { messageId });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[API] Failed to find message by messageId:', errorMessage);
    }

    // Fallback to _id lookup
    if (!message && ObjectId.isValid(messageId)) {
      try {
        message = await db.findOne('messages', { _id: new ObjectId(messageId) });
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.warn('[API] Failed to find message by _id fallback:', errorMessage);
      }
    }

    if (!message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId,
      graphRun: message.graphRun || null,
    });

  } catch (error) {
    console.error('[API] Error getting graph run:', error);
    return NextResponse.json(
      { error: 'Failed to get graph run', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
