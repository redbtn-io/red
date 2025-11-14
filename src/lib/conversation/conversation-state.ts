/**
 * Unified conversation state manager
 * Handles all messages, thoughts, and metadata for the current conversation
 */

import type { ToolExecution } from '../tools/tool-types';

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
    status?: 'processing' | 'searching' | 'thinking' | 'streaming' | 'completed' | 'error';
    conversationId?: string;
    generationId?: string;
  };
  // NEW: Tool executions for this message
  toolExecutions?: ToolExecution[];
}

export interface ConversationThought {
  messageId: string;
  content: string;
  isStreaming: boolean;
  lastUpdated: number;
}

export interface ConversationState {
  id: string;
  title?: string;
  messages: ConversationMessage[];
  thoughts: Record<string, ConversationThought>;
  // NEW: Track tool executions by message ID
  toolExecutions: Record<string, ToolExecution[]>;
  metadata?: {
    lastActivity: Date;
    messageCount: number;
  };
  // Pagination state
  pagination?: {
    hasMore: boolean;
    isLoadingMore: boolean;
    totalMessages?: number;
  };
}

class ConversationStateManager {
  private currentConversation: ConversationState | null = null;
  private listeners: Set<() => void> = new Set();

  /**
   * Subscribe to conversation state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Get current conversation state
   */
  getCurrentConversation(): ConversationState | null {
    return this.currentConversation;
  }

  /**
   * Load conversation from database data
   */
  loadConversation(conversationData: {
    id: string;
    title?: string;
    messages: ConversationMessage[];
    thoughts?: Record<string, string>;
    toolExecutions?: Record<string, ToolExecution[]>; // Add tool executions support
    hasMore?: boolean;
    totalMessages?: number;
  }): void {
    console.log(`[ConversationState] Loading conversation ${conversationData.id}`);
    
    // Convert messages to our format
    const messages: ConversationMessage[] = conversationData.messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
      metadata: msg.metadata,
      toolExecutions: msg.toolExecutions || [] // Include tool executions from message
    }));

    // Convert thoughts to our format
    const thoughts: Record<string, ConversationThought> = {};
    if (conversationData.thoughts) {
      Object.entries(conversationData.thoughts).forEach(([messageId, content]) => {
        thoughts[messageId] = {
          messageId,
          content: content as string,
          isStreaming: false,
          lastUpdated: Date.now()
        };
      });
    }

    // Restore tool executions from messages or use provided data
    const toolExecutions: Record<string, ToolExecution[]> = {};
    
    // First, use explicitly provided tool executions (if any)
    if (conversationData.toolExecutions) {
      Object.assign(toolExecutions, conversationData.toolExecutions);
      console.log(`[ConversationState] Loaded ${Object.keys(conversationData.toolExecutions).length} explicit tool execution sets`);
    }
    
    // Then, extract tool executions from messages (this is the primary source)
    messages.forEach(message => {
      if (message.toolExecutions && message.toolExecutions.length > 0) {
        toolExecutions[message.id] = message.toolExecutions;
        console.log(`[ConversationState] Restored ${message.toolExecutions.length} tool executions for message ${message.id}`);
      }
    });

    this.currentConversation = {
      id: conversationData.id,
      title: conversationData.title,
      messages,
      thoughts,
      toolExecutions, // Use restored tool executions
      metadata: {
        lastActivity: new Date(),
        messageCount: messages.length
      },
      pagination: {
        hasMore: conversationData.hasMore ?? false,
        isLoadingMore: false,
        totalMessages: conversationData.totalMessages
      }
    };

    console.log(`[ConversationState] Loaded ${messages.length} messages, ${Object.keys(thoughts).length} thoughts, and ${Object.keys(toolExecutions).length} messages with tool executions`);
    console.log(`[ConversationState] Pagination: hasMore=${conversationData.hasMore}, total=${conversationData.totalMessages}`);
    console.log(`[ConversationState] Tool execution details:`, Object.entries(toolExecutions).map(([msgId, executions]) => `${msgId}: ${executions.length} tools`));
    this.notify();
  }

  /**
   * Clear current conversation
   */
  clearConversation(): void {
    console.log('[ConversationState] Clearing conversation');
    this.currentConversation = null;
    this.notify();
  }

  /**
   * Create new empty conversation
   */
  createConversation(id: string, title?: string): void {
    console.log(`[ConversationState] Creating new conversation ${id}`);
    this.currentConversation = {
      id,
      title,
      messages: [],
      thoughts: {},
      toolExecutions: {}, // Initialize empty tool executions
      metadata: {
        lastActivity: new Date(),
        messageCount: 0
      }
    };
    this.notify();
  }

  /**
   * Add a message to the current conversation
   */
  addMessage(message: ConversationMessage): void {
    console.log(`[ConversationState] addMessage called:`, {
      messageId: message.id,
      role: message.role,
      hasCurrentConversation: !!this.currentConversation,
      currentConversationId: this.currentConversation?.id,
      currentMessageCount: this.currentConversation?.messages.length || 0
    });
    
    if (!this.currentConversation) {
      console.error(`[ConversationState] Cannot add message - no current conversation!`);
      return;
    }

    console.log(`[ConversationState] Adding message ${message.id} (${message.role})`);
    this.currentConversation.messages.push(message);
    this.currentConversation.metadata!.messageCount = this.currentConversation.messages.length;
    this.currentConversation.metadata!.lastActivity = new Date();
    
    console.log(`[ConversationState] After adding message:`, {
      totalMessages: this.currentConversation.messages.length,
      lastMessageId: this.currentConversation.messages[this.currentConversation.messages.length - 1]?.id
    });
    
    this.notify();
  }

  /**
   * Prepend older messages to the current conversation (for pagination)
   */
  prependMessages(olderMessages: ConversationMessage[], hasMore: boolean): void {
    if (!this.currentConversation) {
      console.error('[ConversationState] Cannot prepend messages - no current conversation');
      return;
    }

    console.log(`[ConversationState] Prepending ${olderMessages.length} older messages`);

    // Avoid duplicates
    const existingIds = new Set(this.currentConversation.messages.map(m => m.id));
    const uniqueOlderMessages = olderMessages.filter(msg => !existingIds.has(msg.id));

    if (uniqueOlderMessages.length !== olderMessages.length) {
      console.log(`[ConversationState] Filtered out ${olderMessages.length - uniqueOlderMessages.length} duplicate messages`);
    }

    // Convert timestamps if needed
    const formattedMessages = uniqueOlderMessages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
    }));

    // Prepend to beginning of array
    this.currentConversation.messages.unshift(...formattedMessages);

    // Extract and store tool executions from older messages
    formattedMessages.forEach(message => {
      if (message.toolExecutions && message.toolExecutions.length > 0) {
        this.currentConversation!.toolExecutions[message.id] = message.toolExecutions;
      }
    });

    // Update pagination state
    if (this.currentConversation.pagination) {
      this.currentConversation.pagination.hasMore = hasMore;
      this.currentConversation.pagination.isLoadingMore = false;
    }

    // Update metadata
    this.currentConversation.metadata!.messageCount = this.currentConversation.messages.length;
    this.currentConversation.metadata!.lastActivity = new Date();

    console.log(`[ConversationState] After prepend: ${this.currentConversation.messages.length} total messages, hasMore: ${hasMore}`);
    this.notify();
  }

  /**
   * Append new messages to the current conversation (for incremental updates)
   */
  appendMessages(newMessages: ConversationMessage[], newThoughts?: Record<string, string>): void {
    if (!this.currentConversation) {
      console.error('[ConversationState] Cannot append messages - no current conversation');
      return;
    }

    console.log(`[ConversationState] Appending ${newMessages.length} new messages`);

    // Add new messages, avoiding duplicates
    const existingIds = new Set(this.currentConversation.messages.map(m => m.id));
    const uniqueNewMessages = newMessages.filter(msg => !existingIds.has(msg.id));

    if (uniqueNewMessages.length !== newMessages.length) {
      console.log(`[ConversationState] Filtered out ${newMessages.length - uniqueNewMessages.length} duplicate messages`);
    }

    // Convert timestamps if needed
    const formattedMessages = uniqueNewMessages.map(msg => ({
      ...msg,
      timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
    }));

    this.currentConversation.messages.push(...formattedMessages);

    // Extract and store tool executions from new messages
    formattedMessages.forEach(message => {
      if (message.toolExecutions && message.toolExecutions.length > 0) {
        this.currentConversation!.toolExecutions[message.id] = message.toolExecutions;
        console.log(`[ConversationState] Stored ${message.toolExecutions.length} tool executions for message ${message.id}`);
      }
    });

    // Add new thoughts if provided
    if (newThoughts) {
      Object.entries(newThoughts).forEach(([messageId, content]) => {
        if (content && !this.currentConversation!.thoughts[messageId]) {
          this.currentConversation!.thoughts[messageId] = {
            messageId,
            content,
            isStreaming: false,
            lastUpdated: Date.now()
          };
        }
      });
    }

    // Update metadata
    this.currentConversation.metadata!.messageCount = this.currentConversation.messages.length;
    this.currentConversation.metadata!.lastActivity = new Date();

    console.log(`[ConversationState] After append: ${this.currentConversation.messages.length} total messages`);
    this.notify();
  }

  /**
   * Update a message (for streaming updates)
   */
  updateMessage(messageId: string, updates: Partial<ConversationMessage>): void {
    if (!this.currentConversation) return;

    const messageIndex = this.currentConversation.messages.findIndex(m => m.id === messageId);
    if (messageIndex !== -1) {
      this.currentConversation.messages[messageIndex] = {
        ...this.currentConversation.messages[messageIndex],
        ...updates
      };
      this.currentConversation.metadata!.lastActivity = new Date();
      this.notify();
    }
  }

  /**
   * Set or update thoughts for a message
   */
  setThought(messageId: string, content: string, isStreaming: boolean = false): void {
    if (!this.currentConversation) return;

    this.currentConversation.thoughts[messageId] = {
      messageId,
      content,
      isStreaming,
      lastUpdated: Date.now()
    };
    this.notify();
  }

  /**
   * Update streaming thought (accumulate content)
   */
  updateStreamingThought(messageId: string, additionalContent: string): void {
    if (!this.currentConversation) return;

    const existing = this.currentConversation.thoughts[messageId];
    const newContent = (existing?.content || '') + additionalContent;
    
    this.setThought(messageId, newContent, true);
  }

  /**
   * Mark thought as completed (no longer streaming)
   */
  completeThought(messageId: string): void {
    if (!this.currentConversation) return;

    const thought = this.currentConversation.thoughts[messageId];
    if (thought) {
      thought.isStreaming = false;
      thought.lastUpdated = Date.now();
      this.notify();
    }
  }

  /**
   * Get thought for a specific message
   */
  getThought(messageId: string): ConversationThought | null {
    if (!this.currentConversation) return null;
    return this.currentConversation.thoughts[messageId] || null;
  }

  /**
   * Get all messages
   */
  getMessages(): ConversationMessage[] {
    return this.currentConversation?.messages || [];
  }

  /**
   * Get all thoughts
   */
  getThoughts(): Record<string, ConversationThought> {
    return this.currentConversation?.thoughts || {};
  }

  /**
   * Update conversation title
   */
  updateTitle(title: string): void {
    if (!this.currentConversation) return;
    
    this.currentConversation.title = title;
    this.notify();
  }

  /**
   * Get conversation metadata
   */
  getMetadata() {
    return this.currentConversation?.metadata;
  }

  // ============================================================================
  // Tool Execution Management
  // ============================================================================

  /**
   * Add a new tool execution to a message
   */
  addToolExecution(messageId: string, toolExecution: ToolExecution): void {
    if (!this.currentConversation) return;

    console.log(`[ConversationState] Adding tool execution: ${toolExecution.toolName} (${toolExecution.toolId})`);

    if (!this.currentConversation.toolExecutions[messageId]) {
      this.currentConversation.toolExecutions[messageId] = [];
    }

    this.currentConversation.toolExecutions[messageId].push(toolExecution);
    this.currentConversation.metadata!.lastActivity = new Date();
    this.notify();
  }

  /**
   * Update an existing tool execution
   */
  updateToolExecution(messageId: string, toolId: string, updates: Partial<ToolExecution>): void {
    if (!this.currentConversation) return;

    const executions = this.currentConversation.toolExecutions[messageId];
    if (!executions) return;

    const executionIndex = executions.findIndex(e => e.toolId === toolId);
    if (executionIndex !== -1) {
      executions[executionIndex] = {
        ...executions[executionIndex],
        ...updates
      };
      this.currentConversation.metadata!.lastActivity = new Date();
      this.notify();
    }
  }

  /**
   * Add a step to a tool execution
   */
  addToolStep(messageId: string, toolId: string, step: { step: string; timestamp: number; progress?: number; data?: unknown }): void {
    if (!this.currentConversation) return;

    const executions = this.currentConversation.toolExecutions[messageId];
    if (!executions) return;

    const execution = executions.find(e => e.toolId === toolId);
    if (execution) {
      execution.steps.push(step);
      execution.currentStep = step.step;
      if (step.progress !== undefined) {
        execution.progress = step.progress;
      }
      this.currentConversation.metadata!.lastActivity = new Date();
      this.notify();
    }
  }

  /**
   * Update streaming content for a tool execution
   */
  updateToolStreamingContent(messageId: string, toolId: string, content: string): void {
    if (!this.currentConversation) return;

    const executions = this.currentConversation.toolExecutions[messageId];
    if (!executions) return;

    const execution = executions.find(e => e.toolId === toolId);
    if (execution) {
      execution.streamingContent = (execution.streamingContent || '') + content;
      this.notify();
    }
  }

  /**
   * Mark a tool execution as complete
   */
  completeToolExecution(messageId: string, toolId: string, result?: unknown, metadata?: Record<string, unknown>, endTimestamp?: number): void {
    if (!this.currentConversation) return;

    const executions = this.currentConversation.toolExecutions[messageId];
    if (!executions) return;

    const execution = executions.find(e => e.toolId === toolId);
    if (execution) {
      execution.status = 'completed';
      // Use provided end timestamp from server event, or fallback to client time
      execution.endTime = endTimestamp || Date.now();
      // Calculate duration from timestamps (startTime is from tool_start event timestamp)
      execution.duration = execution.endTime - execution.startTime;
      if (result !== undefined) {
        execution.result = result;
      }
      if (metadata) {
        execution.metadata = { ...execution.metadata, ...metadata };
      }
      this.currentConversation.metadata!.lastActivity = new Date();
      this.notify();
    }
  }

  /**
   * Mark a tool execution as failed
   */
  failToolExecution(messageId: string, toolId: string, error: string, errorTimestamp?: number): void {
    if (!this.currentConversation) return;

    const executions = this.currentConversation.toolExecutions[messageId];
    if (!executions) return;

    const execution = executions.find(e => e.toolId === toolId);
    if (execution) {
      execution.status = 'error';
      // Use provided error timestamp from server event, or fallback to client time
      execution.endTime = errorTimestamp || Date.now();
      // Calculate duration from timestamps
      execution.duration = execution.endTime - execution.startTime;
      execution.error = error;
      this.currentConversation.metadata!.lastActivity = new Date();
      this.notify();
    }
  }

  /**
   * Get all tool executions for a message
   */
  getToolExecutions(messageId: string): ToolExecution[] {
    if (!this.currentConversation) {
      console.log(`[ConversationState] getToolExecutions(${messageId}): No conversation loaded`);
      return [];
    }
    const executions = this.currentConversation.toolExecutions[messageId] || [];
    console.log(`[ConversationState] getToolExecutions(${messageId}): Found ${executions.length} tool executions`);
    return executions;
  }

  /**
   * Get a specific tool execution
   */
  getToolExecution(messageId: string, toolId: string): ToolExecution | null {
    const executions = this.getToolExecutions(messageId);
    return executions.find(e => e.toolId === toolId) || null;
  }

  /**
   * Set loading more state for pagination
   */
  setLoadingMore(isLoading: boolean): void {
    if (!this.currentConversation || !this.currentConversation.pagination) {
      return;
    }
    this.currentConversation.pagination.isLoadingMore = isLoading;
    this.notify();
  }

  /**
   * Get pagination state
   */
  getPaginationState(): { hasMore: boolean; isLoadingMore: boolean; totalMessages?: number } | null {
    if (!this.currentConversation || !this.currentConversation.pagination) {
      return null;
    }
    return this.currentConversation.pagination;
  }
}

// Global instance
export const conversationState = new ConversationStateManager();