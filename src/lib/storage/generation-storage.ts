/**
 * Session storage for active generation state
 * Allows reconnecting to in-progress generations after page refresh
 */

export interface ActiveGeneration {
  messageId: string;
  conversationId: string;
  streamUrl: string;
  startedAt: number;
  userMessage?: string; // Store user message for reconnection display
}

const STORAGE_KEY = 'active_generation';

export const generationStorage = {
  /**
   * Store active generation info
   */
  set(generation: ActiveGeneration): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(generation));
    } catch (error) {
      console.error('Failed to store generation state:', error);
    }
  },

  /**
   * Get active generation info
   */
  get(): ActiveGeneration | null {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      console.log('[Storage] Raw data from sessionStorage:', data);
      if (!data) return null;
      
      const generation: ActiveGeneration = JSON.parse(data);
      
      // Check if generation is stale (older than 10 minutes)
      const age = Date.now() - generation.startedAt;
      console.log('[Storage] Generation age:', age, 'ms (max 10 minutes)');
      if (age > 10 * 60 * 1000) {
        console.log('[Storage] Generation is stale, clearing');
        this.clear();
        return null;
      }
      
      return generation;
    } catch (error) {
      console.error('Failed to retrieve generation state:', error);
      return null;
    }
  },

  /**
   * Clear active generation info
   */
  clear(): void {
    try {
      console.log('[Storage] CLEARING generation storage');
      console.trace('[Storage] Clear called from:');
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear generation state:', error);
    }
  },

  /**
   * Check if there's an active generation
   */
  hasActive(): boolean {
    return this.get() !== null;
  }
};
