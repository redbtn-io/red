/**
 * Client-side helper for consuming the logging API
 * 
 * Usage:
 * import { LoggingClient } from '@/lib/logging-client';
 * 
 * const client = new LoggingClient();
 * const generation = await client.getGeneration(generationId);
 */

import { LogEntry, Generation, ConversationGenerationState } from '@redbtn/ai';

export class LoggingClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Get generation metadata
   */
  async getGeneration(generationId: string): Promise<Generation> {
    const response = await fetch(`${this.baseUrl}/api/v1/generations/${generationId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch generation: ${response.statusText}`);
    }
    return response.json();
  }
  
  /**
   * Get all logs for a generation
   */
  async getGenerationLogs(generationId: string): Promise<LogEntry[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/generations/${generationId}/logs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.statusText}`);
    }
    const data = await response.json();
    return data.logs;
  }
  
  /**
   * Stream generation logs in real-time
   */
  async *streamGenerationLogs(generationId: string): AsyncGenerator<LogEntry> {
    const response = await fetch(`${this.baseUrl}/api/v1/generations/${generationId}/stream`);
    if (!response.ok) {
      throw new Error(`Failed to stream logs: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Stream not available');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const log: LogEntry = JSON.parse(line.slice(6));
              yield log;
            } catch (e) {
              console.error('Failed to parse log:', e);
            }
          } else if (line.startsWith('event: complete')) {
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * Get all logs for a conversation
   */
  async getConversationLogs(conversationId: string, limit?: number): Promise<LogEntry[]> {
    const url = new URL(`${this.baseUrl}/api/v1/conversations/${conversationId}/logs`, window.location.origin);
    if (limit) {
      url.searchParams.set('limit', limit.toString());
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch conversation logs: ${response.statusText}`);
    }
    const data = await response.json();
    return data.logs;
  }
  
  /**
   * Stream conversation logs in real-time
   */
  async *streamConversationLogs(conversationId: string): AsyncGenerator<LogEntry> {
    const response = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}/stream`);
    if (!response.ok) {
      throw new Error(`Failed to stream conversation logs: ${response.statusText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Stream not available');
    }
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const log: LogEntry = JSON.parse(line.slice(6));
              yield log;
            } catch (e) {
              console.error('Failed to parse log:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
  
  /**
   * Get generation state for a conversation
   */
  async getGenerationState(conversationId: string): Promise<ConversationGenerationState & { isGenerating: boolean }> {
    const response = await fetch(`${this.baseUrl}/api/v1/conversations/${conversationId}/generation-state`);
    if (!response.ok) {
      throw new Error(`Failed to fetch generation state: ${response.statusText}`);
    }
    return response.json();
  }
  
  /**
   * Get logging statistics
   */
  async getStats(conversationId?: string): Promise<{
    conversationId?: string;
    totalLogs: number;
    generationCount: number;
    isGenerating: boolean;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    const url = new URL(`${this.baseUrl}/api/v1/logs/stats`, window.location.origin);
    if (conversationId) {
      url.searchParams.set('conversationId', conversationId);
    }
    
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch stats: ${response.statusText}`);
    }
    return response.json();
  }
}

/**
 * React hook for using the logging client
 */
export function useLoggingClient() {
  return new LoggingClient();
}
