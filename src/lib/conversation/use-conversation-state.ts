import { useState, useEffect, useCallback } from 'react';
import { conversationState, type ConversationState, type ConversationMessage, type ConversationThought } from './conversation-state';
import type { ToolExecution } from '../tools/tool-types';

/**
 * Sanitize tool executions to ensure steps are valid
 */
function sanitizeToolExecutions(executions?: Record<string, ToolExecution[]>): Record<string, ToolExecution[]> {
  if (!executions) return {};
  
  const sanitized: Record<string, ToolExecution[]> = {};
  
  for (const [messageId, tools] of Object.entries(executions)) {
    sanitized[messageId] = tools.map(tool => {
      // Sanitize currentStep if it exists
      let sanitizedCurrentStep: string | undefined;
      if (tool.currentStep) {
        if (typeof tool.currentStep === 'string') {
          sanitizedCurrentStep = tool.currentStep;
        } else if (typeof tool.currentStep === 'object' && 'step' in tool.currentStep) {
          // currentStep was accidentally set to step object
          console.warn('[Sanitize] currentStep was an object, extracting step property:', tool.currentStep);
           
          sanitizedCurrentStep = String((tool.currentStep as any).step);
        } else {
          // Fallback: try to convert to string
          sanitizedCurrentStep = String(tool.currentStep);
        }
      }
      
      return {
        ...tool,
        currentStep: sanitizedCurrentStep,
        steps: (tool.steps || [])
          .filter(step => {
            // Filter out invalid steps
            if (!step || typeof step !== 'object') return false;
            // Filter out if this is accidentally an event object
            if ('type' in step && 'toolType' in step && 'toolId' in step) {
              console.warn('[Sanitize] Removed event object from steps:', step);
              return false;
            }
            // Must have a 'step' property
            if (!('step' in step)) return false;
            return true;
          })
          .map(step => ({
            step: String(step.step),
            timestamp: step.timestamp || Date.now(),
            progress: typeof step.progress === 'number' ? step.progress : undefined,
            data: step.data,
          })),
      };
    });
  }
  
  return sanitized;
}

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
    // Sanitize tool executions before loading
    const sanitizedData = {
      ...conversationData,
      toolExecutions: sanitizeToolExecutions(conversationData.toolExecutions),
    };
    conversationState.loadConversation(sanitizedData);
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

  const appendMessages = useCallback((newMessages: ConversationMessage[], newThoughts?: Record<string, string>) => {
    conversationState.appendMessages(newMessages, newThoughts);
  }, []);

  const prependMessages = useCallback((olderMessages: ConversationMessage[], hasMore: boolean) => {
    conversationState.prependMessages(olderMessages, hasMore);
  }, []);

  const setLoadingMore = useCallback((isLoading: boolean) => {
    conversationState.setLoadingMore(isLoading);
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
    pagination: state?.pagination || null,
    
    // Actions
    loadConversation,
    clearConversation,
    createConversation,
    addMessage,
    appendMessages,
    prependMessages,
    setLoadingMore,
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