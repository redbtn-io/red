import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';

interface MessageState {
  messageId: string;
  status: 'generating' | 'completed' | 'error';
  content: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * GET /api/v1/conversations/:id/status
 * Check if there are any messages currently being generated for this conversation
 * Returns current generation state for reconnection/polling
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

    const red = await getRed();
    const generatingMessages = await red.messageQueue.getGeneratingMessages(conversationId);

    if (generatingMessages.length === 0) {
      return NextResponse.json({
        conversationId,
        generating: false,
        messages: []
      });
    }

    return NextResponse.json({
      conversationId,
      generating: true,
      messages: generatingMessages.map((msg: MessageState) => ({
        messageId: msg.messageId,
        status: msg.status,
        content: msg.content,
        startedAt: msg.startedAt,
        completedAt: msg.completedAt,
        error: msg.error
      }))
    });

  } catch (error) {
    console.error('[API] Error checking conversation status:', error);
    return NextResponse.json(
      { error: 'Failed to check status', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
