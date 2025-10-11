import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { verifyAuth } from '@/lib/auth/auth';
import connectDB from '@/lib/database/mongodb';
import { Conversation } from '@/lib/database/models/conversation';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/conversations/[id]/messages
 * Add a message to a conversation
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.CHAT);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { role, content, thinking, metadata } = body;

    // Validate inputs
    if (!role || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: role, content' },
        { status: 400 }
      );
    }

    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be user, assistant, or system' },
        { status: 400 }
      );
    }

    // Validate conversation ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 });
    }

    // Connect to database
    await connectDB();

    // Find conversation
    const conversation = await Conversation.findOne({
      _id: id,
      userId: user.userId,
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Add message
    const newMessage = conversation.addMessage({
      role,
      content,
      thinking,
      metadata,
    });

    // Auto-generate title from first user message if still default
    if (conversation.title === 'New Conversation' && role === 'user') {
      conversation.title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    }

    await conversation.save();

    return NextResponse.json({
      message: newMessage,
      conversation: {
        id: (conversation._id as mongoose.Types.ObjectId).toString(),
        title: conversation.title,
        messageCount: conversation.messages.length,
      },
    });
  } catch (error: any) {
    console.error('[Messages] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add message', message: error.message },
      { status: 500 }
    );
  }
}
