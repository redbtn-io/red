/**
 * Types for the chat application
 * Note: These types are now compatible with server-stored conversations
 */

export interface NodeProgress {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface GraphRun {
  graphId: string;
  graphName?: string;
  runId?: string;
  status: 'running' | 'completed' | 'error';
  executionPath: string[];
  nodeProgress: Record<string, NodeProgress>;
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string; // Extracted thinking/reasoning (if present)
  timestamp: number | Date;
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
  graphRun?: GraphRun; // Graph execution history
}

export interface Conversation {
  id: string;
  title: string;
  titleSetByUser?: boolean; // True if user manually set the title
  messages: Message[];
  thoughts?: Record<string, string>; // Map of messageId -> thoughts content
  createdAt: number | Date;
  updatedAt: number | Date;
  isArchived?: boolean;
  messageCount?: number;
  lastMessageAt?: number | Date;
}

/**
 * LocalStorage utilities for conversation management
 */
const CONVERSATIONS_KEY = 'red_conversations';
const ACTIVE_CONVERSATION_KEY = 'red_active_conversation';

export const conversationStorage = {
  /**
   * Get all conversations
   */
  getAll(): Conversation[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(CONVERSATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  /**
   * Get a specific conversation by ID
   */
  get(id: string): Conversation | null {
    const conversations = this.getAll();
    return conversations.find(c => c.id === id) || null;
  },

  /**
   * Save a conversation
   */
  save(conversation: Conversation): void {
    const conversations = this.getAll();
    const index = conversations.findIndex(c => c.id === conversation.id);
    
    if (index >= 0) {
      conversations[index] = conversation;
    } else {
      conversations.push(conversation);
    }
    
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  },

  /**
   * Delete a conversation
   */
  delete(id: string): void {
    const conversations = this.getAll().filter(c => c.id !== id);
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  },

  /**
   * Get active conversation ID
   */
  getActiveId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_CONVERSATION_KEY);
  },

  /**
   * Set active conversation ID
   */
  setActiveId(id: string): void {
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
  },

  /**
   * Create a new conversation
   */
  create(): Conversation {
    const conversation: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.save(conversation);
    return conversation;
  },

  /**
   * Add a message to a conversation
   */
  addMessage(conversationId: string, message: Message): void {
    const conversation = this.get(conversationId);
    if (!conversation) return;
    
    conversation.messages.push(message);
    conversation.updatedAt = Date.now();
    
    // Update title from first message if still "New Conversation"
    if (conversation.title === 'New Conversation' && message.role === 'user') {
      conversation.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
    }
    
    this.save(conversation);
  }
};
