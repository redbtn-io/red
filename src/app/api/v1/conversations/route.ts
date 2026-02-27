import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { getDatabase } from '@/lib/red';

/**
 * GET /api/v1/conversations
 * Get all conversations for the authenticated user
 * Uses red.memory (AI package database) as single source of truth
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const source = searchParams.get('source') || undefined; // Filter by source: 'chat', 'terminal', 'api'

    // Fetch conversations from AI package database (red.memory)
    const db = getDatabase();
    const conversations = await db.getConversations(user.userId, limit, offset, source);

    return NextResponse.json({
      conversations: conversations.map(conv => ({
        id: conv.conversationId,
        title: conv.title || 'Untitled Conversation',
        lastMessageAt: conv.updatedAt, // Use updatedAt as proxy for lastMessageAt
        messageCount: conv.metadata?.messageCount || 0,
        isArchived: false, // AI package doesn't have archive feature yet
        source: conv.source || 'chat',
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      })),
      total: conversations.length,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error('[V1 Conversations] GET error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch conversations', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/conversations
 * Create a new conversation
 * Note: Conversations are now created automatically by the AI package when first message is sent
 * This endpoint returns a generated conversationId for the frontend to use
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, source } = body;

    // Generate a conversationId using Memory class method
    // The AI package will create the actual conversation when first message is sent
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create the conversation in the database immediately so it appears in lists
    const db = getDatabase();
    const now = new Date();
    
    await db.upsertConversation({
      conversationId,
      title: title || 'New Conversation',
      userId: user.userId,
      source: source || 'chat',
      metadata: {
        messageCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    });

    // Return the new conversation ID
    // The actual conversation will be created when the first message is sent to run()
    return NextResponse.json({
      conversation: {
        id: conversationId,
        title: title || 'New Conversation',
        messages: [],
        lastMessageAt: now,
        messageCount: 0,
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error: unknown) {
    console.error('[V1 Conversations] POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create conversation', message: errorMessage },
      { status: 500 }
    );
  }
}
