/**
 * Chat Completions API v2
 *
 * DISTRIBUTED ARCHITECTURE VERSION
 * 
 * Offloads graph execution to BullMQ workers for horizontal scaling.
 * 
 * Responsibilities:
 * - Store user message before execution
 * - Initialize run state in Redis
 * - Submit job to worker queue
 * - Return runId for SSE stream subscription
 * - Worker handles: execution, assistant message storage, background tasks
 *
 * @module api/v1/chat/completions
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import {
    ChatCompletionRequest,
    generateCompletionId,
    extractUserMessage,
    getConversationIdFromBody,
    generateStableConversationId,
} from '@/lib/api/api-helpers';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { verifyAuth } from '@/lib/auth/auth';
import { getDatabase } from '@/lib/red';
import { submitGraphJob, initializeRunState } from '@/lib/queue';

// =============================================================================
// Types
// =============================================================================

/**
 * Non-streaming response format (kept for potential sync API support)
 * @deprecated In distributed architecture, always use streaming response
 */
interface _CompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  conversationId: string;
  runId: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface StreamingCompletionResponse {
  id: string;
  object: 'chat.completion.stream';
  created: number;
  model: string;
  conversationId: string;
  runId: string;
  messageId: string;
  userMessageId: string;
  streamUrl: string;
}

// =============================================================================
// Helpers
// =============================================================================

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Store a message to the database
 */
async function storeMessage(params: {
  messageId: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  thinking?: string;
  metadata?: Record<string, unknown>;
  toolExecutions?: Array<{
    toolId: string;
    toolName: string;
    toolType: string;
    status: 'running' | 'completed' | 'error';
    startTime: Date;
    endTime?: Date;
    duration?: number;
    steps?: Array<{ name: string; timestamp: number; data?: unknown }>;
    result?: unknown;
    error?: string;
  }>;
  graphRun?: {
    graphId: string;
    graphName?: string;
    runId?: string;
    status: 'completed' | 'error';
    executionPath: string[];
    nodeProgress: Record<string, unknown>;
    startTime?: number;
    endTime?: number;
    duration?: number;
    error?: string;
  };
}): Promise<void> {
  const db = await getDatabase();

  const message: Record<string, unknown> = {
    messageId: params.messageId,
    conversationId: params.conversationId,
    role: params.role,
    content: params.content,
    thinking: params.thinking,
    timestamp: new Date(),
    metadata: params.metadata || {},
  };

  // Add tool executions if provided
  if (params.toolExecutions && params.toolExecutions.length > 0) {
    message.toolExecutions = params.toolExecutions;
  }

  // Add graphRun if provided (for graph visualization)
  if (params.graphRun) {
    message.graphRun = params.graphRun;
  }

  await db.storeMessage(message as any, params.userId, params.source);
  console.log(
    `[Completions] Stored ${params.role} message ${params.messageId} for conversation ${params.conversationId}`
  );
}

// Note: Background tasks (title generation, summarization) are now handled
// by the worker after graph execution completes. See worker/src/processors/graph.ts

// =============================================================================
// POST Handler
// =============================================================================

export async function POST(request: NextRequest) {
  // Apply rate limiting (30 requests/minute for chat)
  const rateLimitResult = await rateLimitAPI(request, RateLimits.CHAT);
  if (rateLimitResult) return rateLimitResult;

  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json(
      {
        error: {
          message: 'Authentication required',
          type: 'authentication_error',
          code: 'unauthorized',
        },
      },
      { status: 401 }
    );
  }

  try {
    const body: ChatCompletionRequest = await request.json();

    // Validate request
    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: 'messages is required and must not be empty',
            type: 'invalid_request_error',
            code: 'invalid_messages',
          },
        },
        { status: 400 }
      );
    }

    const completionId = generateCompletionId();
    const created = Math.floor(Date.now() / 1000);
    const modelName = body.model || 'Red';
    const userMessage = extractUserMessage(body.messages);

    // Generate IDs
    const conversationId =
      getConversationIdFromBody(body) ||
      request.headers.get('x-conversation-id') ||
      generateStableConversationId(body.messages);
    const userMessageId =
      (body as any).userMessageId || generateMessageId();
    const assistantMessageId = generateMessageId();

    // Get graph ID (default graph if not specified)
    const graphId =
      typeof body.graphId === 'string' ? body.graphId : undefined;
    const graphName = 'Default Graph'; // TODO: Look up graph name from DB

    // Get conversation source (chat, terminal, api)
    const conversationSource: string = (body as any).source || 'chat';

    // 1. Store user message BEFORE execution
    await storeMessage({
      messageId: userMessageId,
      conversationId,
      userId: user.userId,
      role: 'user',
      content: userMessage,
      source: conversationSource,
    });

    // Generate or use provided runId
    const runId = typeof (body as any).runId === 'string' 
      ? (body as any).runId 
      : `run_${nanoid()}`;
    
    console.log(`[Completions] ${new Date().toISOString()} Submitting job runId=${runId}`);

    // Extract source info from request
    const source = {
      application: 'redChat' as const,
      device: request.headers.get('x-device-type') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    };

    // 2. Initialize run state in Redis (allows SSE to connect immediately)
    await initializeRunState({
      runId,
      userId: user.userId,
      graphId: graphId || 'default',
      graphName,
      input: { message: userMessage },
      conversationId,
    });

    // 3. Submit job to worker queue
    await submitGraphJob({
      runId,
      userId: user.userId,
      graphId: graphId || 'default',
      conversationId,
      input: { message: userMessage },
      stream: body.stream ?? true,
      source,
      storeMessage: {
        messageId: assistantMessageId,
        conversationId,
        userMessageId,
      },
    });

    console.log(`[Completions] ${new Date().toISOString()} Job submitted to queue`);

    // 4. Return immediately with stream URL
    // Both streaming and non-streaming modes use the same response format now
    // Client connects to SSE endpoint to get real-time updates
    const response: StreamingCompletionResponse = {
      id: completionId,
      object: 'chat.completion.stream',
      created,
      model: modelName,
      conversationId,
      runId,
      messageId: assistantMessageId,
      userMessageId,
      streamUrl: `/api/v1/runs/${runId}/stream`,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[Completions] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      {
        error: {
          message: errorMessage,
          type: 'internal_error',
        },
      },
      { status: 500 }
    );
  }
}
