'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: string;
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  thoughts?: Record<string, string>; // Map of messageId -> thoughts content from MongoDB
  lastMessageAt: Date;
  messageCount: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  hasMore?: boolean; // Pagination: are there more messages to load
  totalMessages?: number; // Pagination: total messages in conversation
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessageAt: Date;
  messageCount: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationContextType {
  // State
  conversations: ConversationSummary[];
  currentConversation: Conversation | null;
  loading: boolean;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchConversation: (id: string, silent?: boolean, limit?: number) => Promise<Conversation | undefined>;
  createConversation: (title?: string, initialMessage?: Partial<Message>) => Promise<Conversation>;
  updateConversation: (id: string, updates: Partial<Pick<Conversation, 'title' | 'isArchived'>>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  setCurrentConversation: (conversation: Conversation | null) => void;
  clearError: () => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function ConversationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all conversations (summaries only)
  const fetchConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/conversations', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations);
    } catch (err: unknown) {
      console.error('[Conversations] Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch a specific conversation with messages (optionally limited)
  const fetchConversation = useCallback(async (id: string, silent: boolean = false, limit?: number) => {
    if (!id || id === 'undefined') {
      console.error('[Conversation] Invalid conversation ID:', id);
      return;
    }
    
    // Only show loading state if not silent (silent is used for background refreshes)
    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const url = limit ? `/api/v1/conversations/${id}?limit=${limit}` : `/api/v1/conversations/${id}`;
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }

      const data = await response.json();
      setCurrentConversation(data.conversation);
      
      // Return the conversation data so caller can use it immediately
      return data.conversation;
    } catch (err: unknown) {
      console.error('[Conversation] Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch conversation';
      setError(errorMessage);
      throw err;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  // Create a new conversation
  const createConversation = useCallback(async (
    title?: string,
    initialMessage?: Partial<Message>
  ): Promise<Conversation> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title, initialMessage }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const data = await response.json();
      const newConversation = data.conversation;

      // Add to conversations list
      setConversations(prev => [
        {
          id: newConversation.id,
          title: newConversation.title,
          lastMessageAt: newConversation.lastMessageAt,
          messageCount: newConversation.messageCount || newConversation.messages?.length || 0,
          isArchived: newConversation.isArchived,
          createdAt: newConversation.createdAt,
          updatedAt: newConversation.updatedAt,
        },
        ...prev,
      ]);

      setCurrentConversation(newConversation);
      return newConversation;
    } catch (err: unknown) {
      console.error('[Conversation] Create error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update conversation
  const updateConversation = useCallback(async (
    id: string,
    updates: Partial<Pick<Conversation, 'title' | 'isArchived'>>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update conversation');
      }

      const data = await response.json();
      const updatedConversation = data.conversation;

      // Update in conversations list
      setConversations(prev =>
        prev.map(conv =>
          conv.id === id
            ? {
                ...conv,
                title: updatedConversation.title,
                isArchived: updatedConversation.isArchived,
                updatedAt: updatedConversation.updatedAt,
              }
            : conv
        )
      );

      // Update current conversation if it's the one being updated
      if (currentConversation?.id === id) {
        setCurrentConversation(updatedConversation);
      }
    } catch (err: unknown) {
      console.error('[Conversation] Update error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to update conversation';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentConversation]);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      // Remove from conversations list
      setConversations(prev => prev.filter(conv => conv.id !== id));

      // Clear current conversation if it's the one being deleted
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
      }
    } catch (err: unknown) {
      console.error('[Conversation] Delete error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete conversation';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentConversation]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Fetch conversations when user logs in
  useEffect(() => {
    if (user) {
      fetchConversations();
    } else {
      setConversations([]);
      setCurrentConversation(null);
    }
  }, [user, fetchConversations]);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        currentConversation,
        loading,
        error,
        fetchConversations,
        fetchConversation,
        createConversation,
        updateConversation,
        deleteConversation,
        setCurrentConversation,
        clearError,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversations() {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversations must be used within a ConversationProvider');
  }
  return context;
}
