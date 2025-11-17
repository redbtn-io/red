import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { getDatabase } from '@redbtn/ai';
import { extractThinking } from '@/lib/api/thinking';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface DbMessage {
  messageId?: string;
  _id?: { toString: () => string };
  role: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  toolExecutions?: unknown[];
}

/**
 * GET /api/v1/conversations/[id]
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

    // Check for limit query parameter
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : null;

    // Fetch conversation from AI package database
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Verify ownership (only check if userId exists - old conversations may not have it)
    if (conversation.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch messages for this conversation
    const allMessages = await db.getMessages(conversationId);
    
    // Sort by timestamp ascending
    allMessages.sort((a: DbMessage, b: DbMessage) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );
    
    // Apply limit if specified (get last N messages)
    let messages = allMessages;
    let hasMore = false;
    if (limit && !isNaN(limit) && limit > 0) {
      const startIndex = Math.max(0, allMessages.length - limit);
      messages = allMessages.slice(startIndex);
      hasMore = startIndex > 0;
      console.log(`[V1 Conversation] Limited to ${limit} messages: ${messages.length} returned, hasMore: ${hasMore}`);
    }
    
    // Fetch thoughts for this conversation
    const thoughts = await db.getThoughtsByConversation(conversationId).catch(err => {
      console.warn('[V1 Conversation] Failed to fetch thoughts:', err.message);
      return [];
    });
    
    // Create a map of messageId -> thoughts content
    const thoughtsMap: Record<string, string> = {};
    thoughts.forEach(thought => {
      if (thought.messageId && thought.content) {
        thoughtsMap[thought.messageId] = thought.content;
      }
    });

    return NextResponse.json({
      conversation: {
        id: conversation.conversationId,
        title: conversation.title || 'Untitled Conversation',
        hasMore, // Indicate if there are more messages to load
        totalMessages: allMessages.length,
        messages: messages.map((msg: DbMessage) => {
          // Clean thinking tags from message content
          const { thinking, cleanedContent } = extractThinking(msg.content);
          
          // If thinking was found in content, add it to thoughtsMap (if not already there)
          const msgId = msg.messageId || msg._id?.toString() || '';
          if (thinking && msgId && !thoughtsMap[msgId]) {
            thoughtsMap[msgId] = thinking;
          }
          
          return {
            id: msgId,
            role: msg.role,
            content: cleanedContent, // Use cleaned content without <think> tags
            timestamp: msg.timestamp,
            metadata: msg.metadata,
            toolExecutions: msg.toolExecutions || [], // Include tool executions
          };
        }),
        thoughts: thoughtsMap, // Include thoughts mapped by messageId
        lastMessageAt: conversation.updatedAt,
        messageCount: conversation.metadata?.messageCount || messages.length,
        isArchived: false,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error('[V1 Conversation] GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch conversation', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/conversations/[id]
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

    // Verify ownership (only check if userId exists - old conversations may not have it)
    if (conversation.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
        messages: messages.map((msg: DbMessage) => {
          // Clean thinking tags from message content
          const { cleanedContent } = extractThinking(msg.content);
          
          return {
            id: msg.messageId || msg._id?.toString() || '',
            role: msg.role,
            content: cleanedContent, // Use cleaned content without <think> tags
            timestamp: msg.timestamp,
            metadata: msg.metadata,
          };
        }),
        lastMessageAt: updatedConversation!.updatedAt,
        messageCount: updatedConversation!.metadata?.messageCount || messages.length,
        isArchived: false,
        createdAt: updatedConversation!.createdAt,
        updatedAt: updatedConversation!.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error('[V1 Conversation] PATCH error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update conversation', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/conversations/[id]
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

    // Verify ownership before deletion
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);
    
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    
    // Verify ownership (only check if userId exists - old conversations may not have it)
    if (conversation.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.deleteConversation(conversationId);

    return NextResponse.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error: unknown) {
    console.error('[V1 Conversation] DELETE error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete conversation', message: errorMessage },
      { status: 500 }
    );
  }
}
