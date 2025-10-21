/**
 * Thought management for conversation messages
 * Handles caching and real-time updates of message thoughts
 * Note: Thoughts are now only provided via real-time streaming, no legacy API fetching
 */

export interface ThoughtData {
  content: string;
  isLoading: boolean;
  lastFetched?: number;
  error?: string;
}

export interface ConversationThoughts {
  [messageId: string]: ThoughtData;
}

export interface ThoughtCache {
  [conversationId: string]: ConversationThoughts;
}

class ThoughtManager {
  private cache: ThoughtCache = {};

  /**
   * Get thoughts for a message (from cache only - no network fetching)
   */
  getThoughts(conversationId: string, messageId: string): ThoughtData {
    // Initialize conversation cache if needed
    if (!this.cache[conversationId]) {
      this.cache[conversationId] = {};
    }

    const existing = this.cache[conversationId][messageId];
    if (existing) {
      return existing;
    }

    // Return empty state for messages without cached thoughts
    // Thoughts are now only provided via real-time streaming
    const placeholder: ThoughtData = {
      content: '',
      isLoading: false,
    };
    
    this.cache[conversationId][messageId] = placeholder;
    return placeholder;
  }

  /**
   * Set thoughts directly (for streaming or manual updates)
   */
  setThoughts(conversationId: string, messageId: string, content: string): void {
    if (!this.cache[conversationId]) {
      this.cache[conversationId] = {};
    }

    this.cache[conversationId][messageId] = {
      content,
      isLoading: false,
      lastFetched: Date.now(),
    };
  }

  /**
   * Update thoughts content (for streaming updates)
   */
  updateThoughts(conversationId: string, messageId: string, content: string): void {
    if (!this.cache[conversationId]?.[messageId]) {
      this.setThoughts(conversationId, messageId, content);
      return;
    }

    this.cache[conversationId][messageId] = {
      ...this.cache[conversationId][messageId],
      content,
      isLoading: false,
    };
  }

  /**
   * Clear cache for a conversation (when switching conversations)
   */
  clearConversation(conversationId: string): void {
    delete this.cache[conversationId];
  }

  /**
   * Get all cached thoughts for a conversation
   */
  getAllThoughts(conversationId: string): ConversationThoughts {
    return this.cache[conversationId] || {};
  }

  /**
   * Load initial thoughts from a conversation response
   */
  loadInitialThoughts(conversationId: string, thoughts: Record<string, string>): void {
    if (!this.cache[conversationId]) {
      this.cache[conversationId] = {};
    }

    Object.entries(thoughts).forEach(([messageId, content]) => {
      this.cache[conversationId][messageId] = {
        content,
        isLoading: false,
        lastFetched: Date.now(),
      };
    });
  }
}

// Global instance
export const thoughtManager = new ThoughtManager();