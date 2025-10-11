/**
 * Helper functions for API routes
 */
import crypto from 'crypto';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  chat_id?: string;
  conversation_id?: string;
  conversationId?: string;
  session_id?: string;
  sessionId?: string;
  messageId?: string; // Client-provided message ID for reconnection support
  [key: string]: unknown;
}

/**
 * Generate a unique ID for chat completion
 */
export function generateCompletionId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Extract the last user message from the conversation
 */
export function extractUserMessage(messages: ChatMessage[]): string {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  return lastUserMessage?.content || '';
}

/**
 * Extract conversation ID from request body
 */
export function getConversationIdFromBody(body: ChatCompletionRequest): string | undefined {
  const possibleFields = [
    'chat_id',
    'chatId',
    'conversation_id',
    'conversationId',
    'session_id',
    'sessionId',
    'thread_id',
    'threadId'
  ];

  for (const field of possibleFields) {
    if (body[field]) {
      return body[field] as string;
    }
  }

  return undefined;
}

/**
 * Generate a stable conversation ID from message history
 */
export function generateStableConversationId(messages: ChatMessage[]): string {
  const firstUserMessage = messages.find(m => m.role === 'user');

  if (!firstUserMessage) {
    return `conv_${crypto.randomBytes(8).toString('hex')}`;
  }

  const hash = crypto.createHash('sha256')
    .update(firstUserMessage.content)
    .digest('hex')
    .substring(0, 16);

  return `conv_${hash}`;
}

/**
 * Get models list response
 */
export function getModelsList() {
  return {
    object: 'list',
    data: [
      {
        id: 'Red',
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'redbtn',
        permission: [],
        root: 'Red',
        parent: null
      }
    ]
  };
}

/**
 * Get specific model details
 */
export function getModelDetails(modelId: string) {
  if (modelId === 'Red' || modelId === 'red') {
    return {
      id: 'Red',
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'redbtn',
      permission: [],
      root: 'Red',
      parent: null
    };
  }
  return null;
}
