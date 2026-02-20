/**
 * API Route: Get conversations that have logs
 * Returns a list of conversations with log counts and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/red';
import { getLogReader } from '@/lib/redlog';
import { verifyAuth } from '@/lib/auth/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all conversations that have logs
    const reader = getLogReader();
    const conversationsWithLogs = await reader.getConversationsWithLogs();

    // Filter to only include user's conversations
    const db = getDatabase();
    const userConversations = [];
    for (const conv of conversationsWithLogs) {
      const conversation = await db.getConversation(conv.conversationId);
      if (conversation && (!conversation.userId || conversation.userId === user.userId)) {
        userConversations.push(conv);
      }
    }
    
    return NextResponse.json({
      success: true,
      conversations: userConversations,
      total: userConversations.length
    });
  } catch (error) {
    console.error('Error fetching conversations with logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch conversations',
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
