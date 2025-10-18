import { useState, useEffect, useCallback } from 'react';
import { conversationState, type ConversationState, type ConversationMessage, type ConversationThought } from './conversation-state';
import type { ToolExecution } from '../tools/tool-types';

/**
 * React hook for managing conversation state
 */
export function useConversationState() {
  const [state, setState] = useState<ConversationState | null>(conversationState.getCurrentConversation());

  useEffect(() => {
    const unsubscribe = conversationState.subscribe(() => {
      setState(conversationState.getCurrentConversation());
    });

    return unsubscribe;
  }, []);

  // Helper functions
  const loadConversation = useCallback((conversationData: {
    id: string;
    title?: string;
    messages: ConversationMessage[];
    thoughts?: Record<string, string>;
    toolExecutions?: Record<string, ToolExecution[]>; // Add tool executions support
  }) => {
    conversationState.loadConversation(conversationData);
  }, []);

  const clearConversation = useCallback(() => {
    conversationState.clearConversation();
  }, []);

  const createConversation = useCallback((id: string, title?: string) => {
    conversationState.createConversation(id, title);
  }, []);

  const addMessage = useCallback((message: ConversationMessage) => {
    conversationState.addMessage(message);
  }, []);

  const updateMessage = useCallback((messageId: string, updates: Partial<ConversationMessage>) => {
    conversationState.updateMessage(messageId, updates);
  }, []);

  const setThought = useCallback((messageId: string, content: string, isStreaming: boolean = false) => {
    conversationState.setThought(messageId, content, isStreaming);
  }, []);

  const updateStreamingThought = useCallback((messageId: string, additionalContent: string) => {
    conversationState.updateStreamingThought(messageId, additionalContent);
  }, []);

  const completeThought = useCallback((messageId: string) => {
    conversationState.completeThought(messageId);
  }, []);

  const getThought = useCallback((messageId: string): ConversationThought | null => {
    return conversationState.getThought(messageId);
  }, []);

  const updateTitle = useCallback((title: string) => {
    conversationState.updateTitle(title);
  }, []);

  return {
    // State
    conversation: state,
    messages: state?.messages || [],
    thoughts: state?.thoughts || {},
    
    // Actions
    loadConversation,
    clearConversation,
    createConversation,
    addMessage,
    updateMessage,
    setThought,
    updateStreamingThought,
    completeThought,
    getThought,
    updateTitle,
    
    // Helpers
    isLoaded: !!state,
    conversationId: state?.id,
  };
}