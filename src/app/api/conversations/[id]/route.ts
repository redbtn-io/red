import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { getDatabase } from '@redbtn/ai';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/conversations/[id]
 * Get a specific conversation with all messages
 * Uses red.memory (AI package database) as single source of truth
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await context.params;

    // Fetch conversation from AI package database
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Fetch messages for this conversation
    const messages = await db.getMessages(conversationId);

    return NextResponse.json({
      conversation: {
        id: conversation.conversationId,
        title: conversation.title || 'Untitled Conversation',
        messages: messages.map(msg => ({
          id: msg._id?.toString() || '',
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          metadata: msg.metadata,
        })),
        lastMessageAt: conversation.updatedAt,
        messageCount: conversation.metadata?.messageCount || messages.length,
        isArchived: false,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Conversation] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversation', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/conversations/[id]
 * Update conversation (title, archive status)
 * Note: AI package database doesn't support all fields yet
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await context.params;
    const body = await request.json();
    const { title } = body;
    // Note: isArchived not supported by AI package database yet

    // Fetch conversation from AI package database
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Update title if provided
    if (title !== undefined) {
      await db.updateConversationTitle(conversationId, title);
    }

    // Fetch updated conversation
    const updatedConversation = await db.getConversation(conversationId);
    const messages = await db.getMessages(conversationId);

    return NextResponse.json({
      conversation: {
        id: updatedConversation!.conversationId,
        title: updatedConversation!.title || 'Untitled Conversation',
        messages: messages.map(msg => ({
          id: msg._id?.toString() || '',
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          metadata: msg.metadata,
        })),
        lastMessageAt: updatedConversation!.updatedAt,
        messageCount: updatedConversation!.metadata?.messageCount || messages.length,
        isArchived: false,
        createdAt: updatedConversation!.createdAt,
        updatedAt: updatedConversation!.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('[Conversation] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update conversation', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/conversations/[id]
 * Delete a conversation
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await context.params;

    // Delete conversation from AI package database
    const db = getDatabase();
    await db.deleteConversation(conversationId);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error: any) {
    console.error('[Conversation] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete conversation', message: error.message },
      { status: 500 }
    );
  }
}
