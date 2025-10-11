/**
 * Local storage for last active conversation
 * Remembers which conversation was active per device
 */

const STORAGE_KEY = 'last_conversation_id';

export const lastConversationStorage = {
  /**
   * Store last active conversation ID
   */
  set(conversationId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, conversationId);
    } catch (error) {
      console.error('Failed to store last conversation ID:', error);
    }
  },

  /**
   * Get last active conversation ID
   */
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to retrieve last conversation ID:', error);
      return null;
    }
  },

  /**
   * Clear last conversation ID
   */
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear last conversation ID:', error);
    }
  }
};
