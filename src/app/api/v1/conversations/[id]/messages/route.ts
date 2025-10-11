import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@redbtn/ai';

/**
 * GET /api/v1/conversations/:id/messages
 * Fetch all messages for a conversation from MongoDB
 * Used for resyncing frontend after stream disconnection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Get messages from MongoDB (if available)
    try {
      const db = getDatabase();
      const messages = await db.getMessages(conversationId);

      // Transform to frontend format
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        metadata: msg.metadata
      }));

      return NextResponse.json({
        conversationId,
        messages: formattedMessages,
        total: formattedMessages.length
      });
    } catch (dbError) {
      // MongoDB not available or not authenticated - return empty array
      console.warn('[API] MongoDB not available for message fetch:', dbError instanceof Error ? dbError.message : String(dbError));
      return NextResponse.json({
        conversationId,
        messages: [],
        total: 0,
        note: 'MongoDB not available, messages only in Redis cache'
      });
    }

  } catch (error) {
    console.error('[API] Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
