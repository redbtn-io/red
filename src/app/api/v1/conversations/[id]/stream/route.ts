/**
 * API endpoint for SSE streaming of conversation logs
 * GET /api/v1/conversations/:id/stream
 * 
 * Returns Server-Sent Events with real-time log updates for all generations in a conversation
 */

import { NextRequest } from 'next/server';
import { getDatabase } from '@/lib/red';
import { getLogStream } from '@/lib/redlog';
import { verifyAuth } from '@/lib/auth/auth';
import { createSSEResponse } from '@red/stream/sse';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { id: conversationId } = await params;
  if (!conversationId) {
    return new Response('conversationId is required', { status: 400 });
  }

  // Verify ownership
  const db = getDatabase();
  const conversation = await db.getConversation(conversationId);
  if (conversation?.userId && conversation.userId !== user.userId) {
    return new Response('Forbidden', { status: 403 });
  }

  const logStream = getLogStream();
  return createSSEResponse(logStream.subscribe('conversationId', conversationId, { catchUp: true }));
}
