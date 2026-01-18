import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@redbtn/ai';
import { verifyAuth } from '@/lib/auth/auth';

interface DbMessage {
  messageId?: string;
  _id?: { toString: () => string };
  role: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  toolExecutions?: unknown[];
  graphRun?: {
    graphId: string;
    graphName?: string;
    runId?: string;
    status: 'running' | 'completed' | 'error';
    executionPath: string[];
    nodeProgress: Record<string, unknown>;
    startTime?: number;
    endTime?: number;
    duration?: number;
    error?: string;
  };
}

/**
 * GET /api/v1/conversations/:id/messages
 * Fetch messages for a conversation from MongoDB
 * Supports optional 'after' query parameter to fetch only messages newer than a timestamp
 * Used for resyncing frontend after stream disconnection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: conversationId } = await params;
    
    if (!conversationId) {
      return NextResponse.json(
        { error: 'Conversation ID is required' },
        { status: 400 }
      );
    }

    // Verify conversation ownership
    const db = getDatabase();
    const conversation = await db.getConversation(conversationId);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    if (conversation.userId && conversation.userId !== user.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const afterParam = searchParams.get('after');
    const beforeParam = searchParams.get('before');
    const limitParam = searchParams.get('limit');
    
    const afterTimestamp = afterParam ? parseInt(afterParam, 10) : null;
    const beforeTimestamp = beforeParam ? parseInt(beforeParam, 10) : null;
    const limit = limitParam ? parseInt(limitParam, 10) : null;

    // Get messages from MongoDB (if available)
    try {
      const allMessages = await db.getMessages(conversationId);

      // Apply filters
      let filteredMessages = allMessages;
      
      // Filter by 'after' (for incremental updates - messages newer than timestamp)
      if (afterTimestamp && !isNaN(afterTimestamp)) {
        filteredMessages = filteredMessages.filter((msg: DbMessage) => 
          msg.timestamp.getTime() > afterTimestamp
        );
        console.log(`[API] Filtered messages after ${new Date(afterTimestamp).toISOString()}: ${filteredMessages.length} of ${allMessages.length}`);
      }
      
      // Filter by 'before' (for pagination - messages older than timestamp)
      if (beforeTimestamp && !isNaN(beforeTimestamp)) {
        filteredMessages = filteredMessages.filter((msg: DbMessage) => 
          msg.timestamp.getTime() < beforeTimestamp
        );
        console.log(`[API] Filtered messages before ${new Date(beforeTimestamp).toISOString()}: ${filteredMessages.length} messages`);
      }
      
      // Sort by timestamp ascending (oldest first)
      filteredMessages.sort((a: DbMessage, b: DbMessage) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      );
      
      // Apply limit (get last N messages if no 'before', or first N if 'before' specified)
      let limitedMessages = filteredMessages;
      let hasMore = false;
      
      if (limit && !isNaN(limit) && limit > 0) {
        if (beforeTimestamp) {
          // For pagination (loading older): take last N messages before the timestamp
          // Reverse to get oldest first, take limit, reverse back
          limitedMessages = [...filteredMessages].reverse().slice(0, limit).reverse();
          hasMore = filteredMessages.length > limit;
        } else {
          // For initial load: take last N messages (most recent)
          const startIndex = Math.max(0, filteredMessages.length - limit);
          limitedMessages = filteredMessages.slice(startIndex);
          hasMore = startIndex > 0;
        }
        console.log(`[API] Limited to ${limit} messages: ${limitedMessages.length} returned, hasMore: ${hasMore}`);
      }

      // Transform to frontend format
      const formattedMessages = limitedMessages.map((msg: DbMessage) => ({
        id: msg.messageId || msg._id?.toString() || '', // Include message ID
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        metadata: msg.metadata,
        toolExecutions: msg.toolExecutions || [], // Include tool executions
        graphRun: msg.graphRun || undefined // Include graph run data
      }));

      return NextResponse.json({
        conversationId,
        messages: formattedMessages,
        total: allMessages.length,
        returned: formattedMessages.length,
        hasMore,
        filtered: afterTimestamp !== null || beforeTimestamp !== null
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
