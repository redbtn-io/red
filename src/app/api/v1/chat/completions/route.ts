/**
 * Chat Completions API v2
 *
 * Uses the run system with RunPublisher for clean execution.
 * Responsibilities:
 * - Store user message before execution
 * - Start graph execution via run
 * - Return runId for SSE stream subscription
 * - Store assistant message and trigger background tasks after completion
 *
 * @module api/v1/chat/completions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';
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
import {
  run,
  isStreamingResult,
  getDatabase,
  type RunResult,
  type StreamingRunResult,
} from '@redbtn/ai';

// =============================================================================
// Types
// =============================================================================

interface CompletionResponse {
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

  await db.storeMessage(message as any, params.userId);
  console.log(
    `[Completions-v2] Stored ${params.role} message ${params.messageId} for conversation ${params.conversationId}`
  );
}

/**
 * Trigger background tasks after completion
 */
async function triggerBackgroundTasks(params: {
  conversationId: string;
  userId: string;
  messageCount: number;
}): Promise<void> {
  const red = await getRed();

  // Get message count for title generation
  const metadataResult = await red.callMcpTool(
    'get_conversation_metadata',
    { conversationId: params.conversationId },
    { conversationId: params.conversationId }
  );
  const actualMessageCount = metadataResult.isError
    ? params.messageCount
    : JSON.parse(metadataResult.content?.[0]?.text || '{}').messageCount ||
      params.messageCount;

  // Trigger title generation for new conversations (first 2-3 messages)
  if (actualMessageCount <= 3) {
    console.log(
      `[Completions-v2] Triggering title generation for ${params.conversationId}`
    );
    // Title generation is handled internally by the background module
  }

  // Summarization is triggered automatically by memory module
  console.log(
    `[Completions-v2] Background tasks triggered for ${params.conversationId}`
  );
}

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

    // Get Red instance
    const red = await getRed();

    // Get graph ID
    const graphId =
      typeof body.graphId === 'string' ? body.graphId : undefined;

    // 1. Store user message BEFORE execution
    await storeMessage({
      messageId: userMessageId,
      conversationId,
      userId: user.userId,
      role: 'user',
      content: userMessage,
    });

    // Get runId from request (frontend may pre-generate to connect SSE early)
    const requestRunId = typeof (body as any).runId === 'string' ? (body as any).runId : undefined;
    console.log(`[Completions] ${new Date().toISOString()} Starting run with runId=${requestRunId}`);

    // 2. Start run execution
    const result = await run(red, { message: userMessage }, {
      userId: user.userId,
      graphId,
      conversationId, // Pass conversationId for context loading
      stream: body.stream ?? true,
      source: { application: 'redChat' },
      runId: requestRunId, // Use frontend-provided runId if available
    });
    console.log(`[Completions] ${new Date().toISOString()} run returned`);

    // 3. Handle streaming vs non-streaming
    if (body.stream && isStreamingResult(result)) {
      const streamingResult = result as StreamingRunResult;
      console.log(`[Completions-v2] ${new Date().toISOString()} Returning streaming response for runId=${streamingResult.runId}`);

      // Set up completion callback to store assistant message and trigger background tasks
      streamingResult.completion
        .then(async (finalResult: RunResult) => {
          // Map tool executions from RunResult to stored format
          const toolExecutions = (finalResult.tools || []).map(tool => ({
            toolId: tool.toolId,
            toolName: tool.toolName,
            toolType: tool.toolType,
            status: tool.status,
            startTime: new Date(tool.startedAt),
            endTime: tool.completedAt ? new Date(tool.completedAt) : undefined,
            duration: tool.duration,
            steps: tool.steps?.map(step => ({
              name: step.name,
              timestamp: step.timestamp,
              data: step.data,
            })) || [],
            result: tool.result,
            error: tool.error,
          }));

          // Store assistant message with graph run data and tool executions
          await storeMessage({
            messageId: assistantMessageId,
            conversationId,
            userId: user.userId,
            role: 'assistant',
            content: finalResult.content,
            thinking: finalResult.thinking || undefined,
            toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
            metadata: {
              runId: finalResult.runId,
              graphId: finalResult.graphId,
              graphName: finalResult.graphName,
              model: finalResult.metadata.model,
              tokens: finalResult.metadata.tokens,
              executionPath: finalResult.metadata.executionPath,
              duration: finalResult.metadata.duration,
            },
            graphRun: {
              graphId: finalResult.graphId,
              graphName: finalResult.graphName,
              runId: finalResult.runId,
              status: finalResult.status,
              executionPath: finalResult.graphTrace.executionPath,
              nodeProgress: Object.fromEntries(
                Object.entries(finalResult.graphTrace.nodeProgress).map(([nodeId, progress]) => [
                  nodeId,
                  {
                    nodeId,
                    status: progress.status,
                    stepName: progress.nodeName,
                    startTime: progress.startedAt,
                    endTime: progress.completedAt,
                    error: progress.error,
                  },
                ])
              ),
              startTime: finalResult.graphTrace.startTime,
              endTime: finalResult.graphTrace.endTime,
              duration: finalResult.metadata.duration,
              error: finalResult.error,
            },
          });

          // Trigger background tasks
          await triggerBackgroundTasks({
            conversationId,
            userId: user.userId,
            messageCount: body.messages.length + 1,
          });

          console.log(
            `[Completions-v2] Run ${streamingResult.runId} completed, assistant message stored`
          );
        })
        .catch((error: Error) => {
          console.error(
            `[Completions-v2] Run ${streamingResult.runId} failed:`,
            error
          );
        });

      // Return immediately with run info for SSE subscription
      const response: StreamingCompletionResponse = {
        id: completionId,
        object: 'chat.completion.stream',
        created,
        model: modelName,
        conversationId,
        runId: streamingResult.runId,
        messageId: assistantMessageId,
        userMessageId,
        streamUrl: `/api/v1/runs/${streamingResult.runId}/stream`,
      };

      return NextResponse.json(response);
    }

    // Non-streaming: wait for completion
    const finalResult = result as RunResult;

    // Map tool executions from RunResult to stored format
    const toolExecutions = (finalResult.tools || []).map(tool => ({
      toolId: tool.toolId,
      toolName: tool.toolName,
      toolType: tool.toolType,
      status: tool.status,
      startTime: new Date(tool.startedAt),
      endTime: tool.completedAt ? new Date(tool.completedAt) : undefined,
      duration: tool.duration,
      steps: tool.steps?.map(step => ({
        name: step.name,
        timestamp: step.timestamp,
        data: step.data,
      })) || [],
      result: tool.result,
      error: tool.error,
    }));

    // Store assistant message with graph run data and tool executions
    await storeMessage({
      messageId: assistantMessageId,
      conversationId,
      userId: user.userId,
      role: 'assistant',
      content: finalResult.content,
      thinking: finalResult.thinking || undefined,
      toolExecutions: toolExecutions.length > 0 ? toolExecutions : undefined,
      metadata: {
        runId: finalResult.runId,
        graphId: finalResult.graphId,
        graphName: finalResult.graphName,
        model: finalResult.metadata.model,
        tokens: finalResult.metadata.tokens,
        executionPath: finalResult.metadata.executionPath,
        duration: finalResult.metadata.duration,
      },
      graphRun: {
        graphId: finalResult.graphId,
        graphName: finalResult.graphName,
        runId: finalResult.runId,
        status: finalResult.status,
        executionPath: finalResult.graphTrace.executionPath,
        nodeProgress: Object.fromEntries(
          Object.entries(finalResult.graphTrace.nodeProgress).map(([nodeId, progress]) => [
            nodeId,
            {
              nodeId,
              status: progress.status,
              stepName: progress.nodeName,
              startTime: progress.startedAt,
              endTime: progress.completedAt,
              error: progress.error,
            },
          ])
        ),
        startTime: finalResult.graphTrace.startTime,
        endTime: finalResult.graphTrace.endTime,
        duration: finalResult.metadata.duration,
        error: finalResult.error,
      },
    });

    // Trigger background tasks
    await triggerBackgroundTasks({
      conversationId,
      userId: user.userId,
      messageCount: body.messages.length + 1,
    });

    // Return complete response
    const response: CompletionResponse = {
      id: completionId,
      object: 'chat.completion',
      created,
      model: modelName,
      conversationId,
      runId: finalResult.runId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: finalResult.content,
          },
          finish_reason: finalResult.status === 'completed' ? 'stop' : 'error',
        },
      ],
      usage: {
        prompt_tokens: finalResult.metadata.tokens?.input || 0,
        completion_tokens: finalResult.metadata.tokens?.output || 0,
        total_tokens: finalResult.metadata.tokens?.total || 0,
      },
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('[Completions-v2] Error:', error);

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
