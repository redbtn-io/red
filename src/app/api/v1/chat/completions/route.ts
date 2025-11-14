import { NextRequest, NextResponse } from 'next/server';
import { getRed } from '@/lib/red';
import {
  ChatCompletionRequest,
  generateCompletionId,
  extractUserMessage,
  getConversationIdFromBody,
  generateStableConversationId
} from '@/lib/api/api-helpers';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import type { InvokeOptions } from '@redbtn/ai';

type ExtendedInvokeOptions = InvokeOptions & { userMessageId?: string };

export async function POST(request: NextRequest) {
  // Apply rate limiting (30 requests/minute for chat)
  const rateLimitResult = await rateLimitAPI(request, RateLimits.CHAT);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body: ChatCompletionRequest = await request.json();

    if (!body.messages || body.messages.length === 0) {
      return NextResponse.json(
        {
          error: {
            message: 'messages is required and must not be empty',
            type: 'invalid_request_error',
            code: 'invalid_messages'
          }
        },
        { status: 400 }
      );
    }

    const completionId = generateCompletionId();
    const created = Math.floor(Date.now() / 1000);
    const modelName = body.model || 'Red';
    const userMessage = extractUserMessage(body.messages);

    const conversationId =
      getConversationIdFromBody(body) ||
      request.headers.get('x-conversation-id') ||
      generateStableConversationId(body.messages);

    console.log(`🔗 Using conversation ID: ${conversationId}`);

    const red = await getRed();

  const messageId = body.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const userMessageId = typeof body.userMessageId === 'string' ? body.userMessageId : undefined;

    if (body.stream) {
      await red.messageQueue.startGeneration(conversationId, messageId);

      const encoder = new TextEncoder();
      
      let subscriptionReady = false;
      const subscriptionReadyPromise = new Promise<void>(resolve => {
        const checkReady = () => {
          if (subscriptionReady) {
            resolve();
          } else {
            setTimeout(checkReady, 10);
          }
        };
        checkReady();
      });
      
      // Start generation in background
      (async () => {
        try {
          console.log('[Completions] Waiting for subscription to be ready...');
          await subscriptionReadyPromise;
          console.log('[Completions] Subscription ready, starting generation for', messageId);
          
          const respondOptions: ExtendedInvokeOptions = {
            source: { application: 'redChat' },
            stream: true,
            conversationId,
            messageId,
            userMessageId
          };

          const responseStream = await red.respond(
            { message: userMessage },
            respondOptions
          );

          for await (const chunk of responseStream) {
            if (typeof chunk === 'object' && chunk._metadata) continue;
            
            if (typeof chunk === 'object' && chunk._status) {
              await red.messageQueue.publishStatus(messageId, {
                action: chunk.action,
                description: chunk.description
              });
              continue;
            }
            
            if (typeof chunk === 'object' && chunk._thinkingChunk) {
              // Thinking chunk already published by respond.ts - skip duplicate
              continue;
            }
            
            if (typeof chunk === 'object' && chunk._toolStatus) {
              await red.messageQueue.publishToolStatus(messageId, {
                status: chunk.status,
                action: chunk.action
              });
              continue;
            }

            if (typeof chunk === 'string') {
              await red.messageQueue.appendContent(messageId, chunk);
            } else {
              const metadata = {
                model: chunk.response_metadata?.model,
                tokens: chunk.usage_metadata ? {
                  input: chunk.usage_metadata.input_tokens,
                  output: chunk.usage_metadata.output_tokens,
                  total: chunk.usage_metadata.total_tokens
                } : undefined
              };
              await red.messageQueue.completeGeneration(messageId, metadata);
              
              // Note: Assistant message is already saved by red.memory in respond.ts
              // No need to save here - the AI package handles all message persistence
            }
          }
        } catch (error) {
          console.error(`[Completions] Generation failed:`, error);
          await red.messageQueue.failGeneration(
            messageId,
            error instanceof Error ? error.message : String(error)
          );
        }
      })();
      
      const stream = new ReadableStream({
        async start(controller) {
          let streamClosed = false;
          
          const safeEnqueue = (data: Uint8Array) => {
            if (streamClosed) {
              console.log('[Completions] Skipping enqueue - stream already closed');
              return false;
            }
            try {
              controller.enqueue(data);
              return true;
            } catch (error) {
              if (error instanceof Error && error.message.includes('Controller is already closed')) {
                console.log('[Completions] Stream closed by client');
                streamClosed = true;
                return false;
              }
              throw error;
            }
          };
          
          try {
            const initEvent = { type: 'init', messageId, conversationId };
            console.log('[Completions] Sending init event and subscribing to Redis');
            if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify(initEvent)}\n\n`))) {
              return;
            }

            console.log('[Completions] Subscribing to message queue...');
            const messageStream = red.messageQueue.subscribeToMessage(messageId);
            console.log('[Completions] Subscription established, signaling generation to start');

            subscriptionReady = true;

            for await (const event of messageStream) {
              if (streamClosed) {
                console.log('[Completions] Stream closed, stopping subscription');
                break;
              }
              
              if (event.type === 'init' && event.existingContent) {
                const chunks = event.existingContent.match(/.{1,50}/g) || [];
                for (const chunk of chunks) {
                  if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'chunk',
                    content: chunk
                  })}\n\n`))) break;
                }
              } else if (event.type === 'chunk') {
                // Forward chunk with thinking property if present
                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'chunk',
                  content: event.content,
                  thinking: event.thinking || false
                })}\n\n`))) break;
              } else if (event.type === 'status') {
                console.log('[Completions] Forwarding status:', event.action);
                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'status',
                  action: event.action,
                  description: event.description
                })}\n\n`))) break;
              } else if (event.type === 'tool_status') {
                console.log('[Completions] Forwarding tool_status:', event.action);
                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_status',
                  status: event.status,
                  action: event.action
                })}\n\n`))) break;
              } else if (event.type === 'tool_event') {
                console.log('[Completions] Forwarding tool_event:', event.event?.type);
                if (!safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'tool_event',
                  event: event.event
                })}\n\n`))) break;
              } else if (event.type === 'complete') {
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'complete',
                  metadata: event.metadata
                })}\n\n`));
                break;
              } else if (event.type === 'error') {
                safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                  type: 'error',
                  error: event.error
                })}\n\n`));
                break;
              }
            }
            
            safeEnqueue(encoder.encode('data: [DONE]\n\n'));
            if (!streamClosed) controller.close();
          } catch (error) {
            console.error(`[Completions] Stream error:`, error);
            if (!streamClosed) {
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                error: error instanceof Error ? error.message : String(error)
              })}\n\n`));
              controller.close();
            }
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        }
      });
    }

    const respondOptions: ExtendedInvokeOptions = {
      source: { application: 'redChat' },
      conversationId,
      userMessageId
    };

    const response = await red.respond(
      { message: userMessage },
      respondOptions
    );

    const completion = {
      id: completionId,
      object: 'chat.completion',
      created,
      model: modelName,
      conversationId: response.conversationId || conversationId,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: typeof response.content === 'string' ? response.content : JSON.stringify(response.content)
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    return NextResponse.json(completion);
  } catch (error: unknown) {
    console.error('Completion error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        error: {
          message: errorMessage,
          type: 'internal_error'
        }
      },
      { status: 500 }
    );
  }
}
