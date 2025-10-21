import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';

/**
 * Get active generation for a conversation
 * Returns the messageId if there's an ongoing generation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  
  try {
    const red = await getRed();
    
    // Get all generating messages for this conversation
    const generatingMessages = await red.messageQueue.getGeneratingMessages(conversationId);
    
    if (generatingMessages.length === 0) {
      return NextResponse.json({ active: false });
    }
    
    // Return the first active generation (there should only be one)
    const activeGeneration = generatingMessages[0];
    
    return NextResponse.json({
      active: true,
      messageId: activeGeneration.messageId,
      conversationId: activeGeneration.conversationId,
      status: activeGeneration.status,
      startedAt: activeGeneration.startedAt,
    });
  } catch (error) {
    console.error('[API] Error checking active generation:', error);
    return NextResponse.json(
      { error: 'Failed to check active generation' },
      { status: 500 }
    );
  }
}
