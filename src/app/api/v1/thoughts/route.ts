import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';

/**
 * GET /api/v1/thoughts?conversationId=xxx&generationId=yyy
 * 
 * Fetch thoughts/reasoning for a conversation or generation
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const generationId = searchParams.get('generationId');
    const source = searchParams.get('source'); // Optional: filter by 'chat', 'router', 'toolPicker'

    if (!conversationId && !generationId) {
      return NextResponse.json(
        {
          error: {
            message: 'Either conversationId or generationId is required',
            type: 'invalid_request_error',
            code: 'missing_parameters'
          }
        },
        { status: 400 }
      );
    }

    const db = await import('@redbtn/ai/dist/lib/memory/database').then(m => m.getDatabase());

    interface ThoughtDoc {
      thoughtId: string;
      messageId?: string;
      conversationId: string;
      generationId?: string;
      source: string;
      content: string;
      timestamp: Date;
      metadata?: Record<string, unknown>;
    }

    let thoughts: ThoughtDoc[] = [];

    if (generationId) {
      // Get thoughts for a specific generation
      thoughts = await db.getThoughtsByGeneration(generationId);
    } else if (conversationId) {
      if (source) {
        // Get thoughts by source for a conversation
        thoughts = await db.getThoughtsBySource(source, conversationId);
      } else {
        // Get all thoughts for a conversation
        thoughts = await db.getThoughtsByConversation(conversationId);
      }
    }

    // Transform MongoDB documents to plain objects
    const cleanedThoughts = thoughts.map((thought: ThoughtDoc) => ({
      thoughtId: thought.thoughtId,
      messageId: thought.messageId,
      conversationId: thought.conversationId,
      generationId: thought.generationId,
      source: thought.source,
      content: thought.content,
      timestamp: thought.timestamp,
      metadata: thought.metadata,
    }));

    return NextResponse.json({
      thoughts: cleanedThoughts,
      count: cleanedThoughts.length,
    });
  } catch (error) {
    console.error('Error fetching thoughts:', error);
    return NextResponse.json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          type: 'internal_error',
          code: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}
