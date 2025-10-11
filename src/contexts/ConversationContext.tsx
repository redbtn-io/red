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
  lastMessageAt: Date;
  messageCount: number;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  fetchConversation: (id: string) => Promise<void>;
  createConversation: (title?: string, initialMessage?: Partial<Message>) => Promise<Conversation>;
  updateConversation: (id: string, updates: Partial<Pick<Conversation, 'title' | 'isArchived'>>) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => Promise<Message>;
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
    } catch (err: any) {
      console.error('[Conversations] Fetch error:', err);
      setError(err.message || 'Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch a specific conversation with all messages
  const fetchConversation = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/conversations/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }

      const data = await response.json();
      setCurrentConversation(data.conversation);
    } catch (err: any) {
      console.error('[Conversation] Fetch error:', err);
      setError(err.message || 'Failed to fetch conversation');
    } finally {
      setLoading(false);
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
    } catch (err: any) {
      console.error('[Conversation] Create error:', err);
      setError(err.message || 'Failed to create conversation');
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
    } catch (err: any) {
      console.error('[Conversation] Update error:', err);
      setError(err.message || 'Failed to update conversation');
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
    } catch (err: any) {
      console.error('[Conversation] Delete error:', err);
      setError(err.message || 'Failed to delete conversation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [currentConversation]);

  // Add message to conversation
  // DEPRECATED: Messages are now saved automatically by red.memory in respond.ts
  // This method is kept for backward compatibility but is no longer used
  // @deprecated Use respond() function which saves messages via red.memory
  const addMessage = useCallback(async (
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp'>
  ): Promise<Message> => {
    console.warn('[addMessage] DEPRECATED: This method is no longer used. Messages are saved by respond.ts via red.memory');
    setError(null);

    try {
      // This endpoint no longer exists - messages saved by respond.ts
      throw new Error('addMessage is deprecated - messages saved automatically by respond.ts');
    } catch (err: any) {
      console.error('[Message] Add error:', err);
      setError(err.message || 'Failed to add message');
      throw err;
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
        addMessage,
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
