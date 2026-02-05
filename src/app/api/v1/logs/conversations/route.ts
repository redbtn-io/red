/**
 * API Route: Get conversations that have logs
 * Returns a list of conversations with log counts and metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { Red } from '@redbtn/redbtn';
import { getDatabase } from '@/lib/red';
import { verifyAuth } from '@/lib/auth/auth';

const red = new Red({
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  vectorDbUrl: process.env.QDRANT_URL || 'http://localhost:6333',
  databaseUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/redbtn',
  chatLlmUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  workLlmUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
});

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all conversations that have logs
    const conversationsWithLogs = await red.logger.getConversationsWithLogs();

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
