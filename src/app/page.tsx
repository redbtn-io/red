'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { generationStorage } from '@/lib/storage/generation-storage';
import { lastConversationStorage } from '@/lib/storage/last-conversation-storage';
import { useConversationState } from '@/lib/conversation/use-conversation-state';
import { conversationState } from '@/lib/conversation/conversation-state';
import { ConfirmModal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatInput } from '@/components/chat/ChatInput';
import { Messages } from '@/components/chat/Messages';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/contexts/ConversationContext';
import type { ToolExecution } from '@/lib/tools/tool-types';

/**
 * Extract tool executions from messages and organize by messageId
 * API returns toolExecutions at message level, but we store at conversation level
 */
function extractToolExecutionsFromMessages(messages: Array<{id: string; toolExecutions?: ToolExecution[]}>): Record<string, ToolExecution[]> {
  const toolExecutionsMap: Record<string, ToolExecution[]> = {};
  
  for (const message of messages) {
    if (message.id && message.toolExecutions && Array.isArray(message.toolExecutions) && message.toolExecutions.length > 0) {
      toolExecutionsMap[message.id] = message.toolExecutions;
      console.log(`[Load] Found ${message.toolExecutions.length} tool executions for message ${message.id}`);
    }
  }
  
  return toolExecutionsMap;
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const { user, loading: authLoading, refreshUser } = useAuth();
  const {
    conversations,
    currentConversation,
    loading: conversationsLoading,
    fetchConversation,
    createConversation,
    deleteConversation,
    updateConversation,
    setCurrentConversation,
  } = useConversations();

  // Use new conversation state manager
  const {
    conversation: localConversation,
    messages: localMessages,
    thoughts: localThoughts,
    pagination,
    loadConversation,
    clearConversation,
    addMessage: addLocalMessage,
    appendMessages,
    prependMessages,
    setLoadingMore,
    setThought,
    completeThought,
    isLoaded: conversationLoaded,
    conversationId: localConversationId,
  } = useConversationState();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [skeletonShrinking, setSkeletonShrinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isThinkingDisplayComplete, setIsThinkingDisplayComplete] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState<{action: string; description?: string; reasoning?: string; confidence?: number} | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [isIntentionallyEmpty, setIsIntentionallyEmpty] = useState(false); // Track "new chat" state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [reconnectAttempted, setReconnectAttempted] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{ id: string; content: string } | null>(null);
  
  // Modal state - using both state and ref to prevent stale closure issues
  const [modalState, setModalState] = useState<{ isOpen: boolean; messageId: string | null }>({ isOpen: false, messageId: null });
  const modalStateRef = useRef<{ isOpen: boolean; messageId: string | null }>({ isOpen: false, messageId: null });
  
  // Sync ref with state
  useEffect(() => {
    modalStateRef.current = modalState;
  }, [modalState]);
  
  const activeStreamRef = useRef<string | null>(null);
  const activeReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null); // Track active reader for aborting
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const preventScrollRestorationRef = useRef<boolean>(false);
  const streamingContentRef = useRef<string>(''); // Track streaming content immediately
  const streamingMessageIdRef = useRef<string | null>(null); // Track which message is streaming
  const currentStreamingMessageRef = useRef<{ id: string; content: string } | null>(null); // Track current streaming message

  // Helper function to update URL with conversation parameter
  const updateConversationUrl = (conversationId: string | null) => {
    if (conversationId) {
      router.push(`${pathname}?conversation=${conversationId}`, { scroll: false });
    } else {
      router.push(pathname, { scroll: false });
    }
  };

  const handleLoginSuccess = async () => {
    await refreshUser();
  };

  const handleProfileComplete = () => {
    // Profile is now complete, refreshUser will update the user object
  };

  // Check for active generation and reconnect
  useEffect(() => {
    if (!user || !user.profileComplete || reconnectAttempted || !currentConversation || !currentConversation.id || !conversationLoaded) {
      return;
    }

    // Check if there's an active generation for this conversation
    const checkActiveGeneration = async () => {
      try {
        console.log('[Reconnect] Checking for active generation in conversation:', currentConversation.id);
        
        const response = await fetch(`/api/v1/conversations/${currentConversation.id}/active-generation`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          console.error('[Reconnect] Failed to check active generation:', response.status);
          return;
        }
        
        const data = await response.json();
        
        if (!data.active) {
          return;
        }
        
        // Found an active generation - reconnect to it
        const { messageId, conversationId } = data;
        
        setReconnectAttempted(true);
        setIsReconnecting(true);
        setIsLoading(true);
        setStreamingMessageId(messageId);
        // Set initial status so LoadingStates shows immediately
        setCurrentStatus({ action: 'processing', description: 'Reconnecting...' });

        // Reconnect to the stream
        const reconnectUrl = `/api/v1/messages/${messageId}/reconnect`;
        await streamMessage(conversationId, messageId, reconnectUrl);
        
      } catch (error) {
        console.error('[Reconnect] Error checking active generation:', error);
        setIsLoading(false);
        setStreamingMessageId(null);
        setIsReconnecting(false);
      }
    };
    
    checkActiveGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentConversation, reconnectAttempted, conversationLoaded]);

  // Handle page visibility changes (mobile app background/foreground)
  useEffect(() => {
    if (!user || !user.profileComplete || !currentConversation?.id) {
      return;
    }

    const handleVisibilityChange = async () => {
      // Only check when page becomes visible
      if (document.hidden) {
        console.log('[Visibility] Page hidden');
        return;
      }

      console.log('[Visibility] Page became visible, checking for active generation');
      
      // If already actively streaming (not just having a streamingMessageId), don't interrupt
      // Note: streamingMessageId can be set from a previous generation, so we check isStreaming
      if (isStreaming) {
        console.log('[Visibility] Already actively streaming, skipping check');
        return;
      }

      try {
        const response = await fetch(`/api/v1/conversations/${currentConversation.id}/active-generation`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          console.error('[Visibility] Failed to check active generation:', response.status);
          return;
        }
        
        const data = await response.json();
        
        if (!data.active) {
          console.log('[Visibility] No active generation found');
          // Only check for new messages if we have messages and last one is from user
          // This means there might be an assistant response that completed while we were away
          const shouldCheckForNewMessages = localMessages.length > 0 && 
            localMessages[localMessages.length - 1].role === 'user';

          if (shouldCheckForNewMessages) {
            console.log('[Visibility] Last message is from user, checking for assistant response');
            try {
              // Get timestamp of the latest message (the user message)
              const latestMessage = localMessages[localMessages.length - 1];
              const afterTimestamp = latestMessage.timestamp instanceof Date ? 
                latestMessage.timestamp.getTime() : latestMessage.timestamp;

              // Fetch messages after this timestamp (user message ID now matches between frontend and DB)
              const messagesResponse = await fetch(
                `/api/v1/conversations/${currentConversation.id}/messages?after=${afterTimestamp}`,
                { credentials: 'include' }
              );

              if (messagesResponse.ok) {
                const messagesData = await messagesResponse.json();
                if (messagesData.messages && messagesData.messages.length > 0) {
                  console.log(`[Visibility] Appending ${messagesData.messages.length} new messages`);
                  appendMessages(messagesData.messages);
                }
              }
            } catch (err) {
              console.error('[Visibility] Failed to fetch new messages:', err);
            }
          } else {
            console.log('[Visibility] No need to check for new messages (last message not from user)');
          }
          return;
        }
        
        // Found an active generation - reconnect to it
        const { messageId, conversationId } = data;
        console.log('[Visibility] Found active generation, reconnecting to message:', messageId);
        
        setIsReconnecting(true);
        setIsLoading(true);
        setStreamingMessageId(messageId);
        // Set initial status so LoadingStates shows immediately
        setCurrentStatus({ action: 'processing', description: 'Reconnecting...' });

        // Reconnect to the stream
        const reconnectUrl = `/api/v1/messages/${messageId}/reconnect`;
        await streamMessage(conversationId, messageId, reconnectUrl);
        
      } catch (error) {
        console.error('[Visibility] Error checking active generation:', error);
        setIsLoading(false);
        setStreamingMessageId(null);
        setIsReconnecting(false);
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for pageshow event (iOS Safari back/forward cache)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        console.log('[PageShow] Page restored from cache');
        handleVisibilityChange();
      }
    });

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, currentConversation, isStreaming, streamingMessageId]);

  // Note: Removed auto-scroll effect - with flex-col-reverse, scroll naturally starts at bottom (newest messages)
  // messagesEndRef is still used for programmatic scrolling when new messages arrive during streaming

  // Debug: Track message state changes
  useEffect(() => {
    console.log('[Debug] localMessages changed:', localMessages.length, 'messages');
    console.log('[Debug] Message IDs:', localMessages.map(m => m.id));
    console.log('[Debug] conversationLoaded:', conversationLoaded);
    console.log('[Debug] localConversationId:', localConversationId);
    console.log('[Debug] streamingMessage:', streamingMessage?.id);
  }, [localMessages, conversationLoaded, localConversationId, streamingMessage]);

  // Load conversation on mount - prioritize URL parameter, then lastConversationStorage
  useEffect(() => {
    if (!user || !user.profileComplete || conversationsLoading) return;
    if (conversationLoaded && localConversationId) return; // Already have a conversation loaded
    if (isIntentionallyEmpty) return; // User clicked "New Chat" - stay empty
    if (conversations.length === 0) return; // No conversations yet

    // Priority 1: Check URL parameter
    const urlConversationId = searchParams.get('conversation');
    
    // Priority 2: Check lastConversationStorage
    const lastConvId = lastConversationStorage.get();
    
    // Determine which conversation to load
    let conversationToLoad: string | null = null;
    
    if (urlConversationId && urlConversationId !== 'undefined') {
      // URL parameter takes precedence
      const exists = conversations.some(c => c.id === urlConversationId);
      if (exists) {
        conversationToLoad = urlConversationId;
        console.log('[Init] Loading conversation from URL:', urlConversationId);
      } else {
        console.warn('[Init] URL conversation not found:', urlConversationId);
      }
    }
    
    if (!conversationToLoad && lastConvId && lastConvId !== 'undefined') {
      // Fall back to last conversation from storage
      const exists = conversations.some(c => c.id === lastConvId);
      if (exists) {
        conversationToLoad = lastConvId;
        console.log('[Init] Loading last conversation from storage:', lastConvId);
      }
    }
    
    if (!conversationToLoad && conversations.length > 0 && conversations[0].id) {
      // Fall back to first available conversation
      conversationToLoad = conversations[0].id;
      console.log('[Init] Loading first available conversation:', conversationToLoad);
    }
    
    // Load the determined conversation (limit to 50 most recent messages)
    if (conversationToLoad) {
      fetchConversation(conversationToLoad, false, 50).then(conv => {
        if (conv) {
          loadConversation({
            id: conv.id,
            title: conv.title,
            messages: conv.messages || [],
            thoughts: conv.thoughts || {},
            toolExecutions: extractToolExecutionsFromMessages(conv.messages || []),
            ...(conv.hasMore !== undefined && { hasMore: conv.hasMore }),
            ...(conv.totalMessages !== undefined && { totalMessages: conv.totalMessages })
          });
          lastConversationStorage.set(conv.id);
          // Sync URL if it's different
          if (urlConversationId !== conv.id) {
            updateConversationUrl(conv.id);
          }
        }
      }).catch(err => {
        console.error('[Init] Failed to load conversation:', err);
      });
    }
  }, [user, conversations, conversationLoaded, localConversationId, conversationsLoading, fetchConversation, loadConversation, searchParams]);

  // Load more (older) messages for pagination
  const loadMoreMessages = async () => {
    if (!localConversationId || !pagination || !pagination.hasMore || pagination.isLoadingMore) {
      return;
    }

    // Get the oldest message timestamp
    const oldestMessage = localMessages[0];
    if (!oldestMessage) return;

    const beforeTimestamp = oldestMessage.timestamp instanceof Date ?
      oldestMessage.timestamp.getTime() : oldestMessage.timestamp;

    console.log(`[Pagination] Loading messages before ${new Date(beforeTimestamp).toISOString()}`);
    
    setLoadingMore(true);

    try {
      const response = await fetch(
        `/api/v1/conversations/${localConversationId}/messages?before=${beforeTimestamp}&limit=50`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          console.log(`[Pagination] Prepending ${data.messages.length} older messages, hasMore: ${data.hasMore}`);
          prependMessages(data.messages, data.hasMore);
        } else {
          console.log('[Pagination] No more messages to load');
          setLoadingMore(false);
        }
      } else {
        console.error('[Pagination] Failed to load more messages:', response.status);
        setLoadingMore(false);
      }
    } catch (err) {
      console.error('[Pagination] Error loading more messages:', err);
      setLoadingMore(false);
    }
  };

  const scrollToTop = () => {
    if (messagesScrollRef.current) {
      const container = messagesScrollRef.current;
      const currentScroll = container.scrollTop;
      const maxScroll = -(container.scrollHeight - container.clientHeight);
      
      // Set flag to prevent scroll restoration when manually scrolling to top
      preventScrollRestorationRef.current = true;
      
      // If all messages are loaded (no more to paginate), toggle between top and bottom
      if (pagination && !pagination.hasMore) {
        // If we're close to the top (within 100px), scroll to bottom
        // Otherwise, scroll to top
        const threshold = 100;
        const distanceFromTop = Math.abs(currentScroll - maxScroll);
        
        if (distanceFromTop < threshold) {
          // Currently at top, scroll to bottom (newest messages)
          container.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        } else {
          // Not at top, scroll to top (oldest messages)
          container.scrollTo({
            top: maxScroll,
            behavior: 'smooth'
          });
        }
      } else {
        // If there are more messages to load, always scroll to top
        container.scrollTo({
          top: maxScroll,
          behavior: 'smooth'
        });
      }
    }
  };

  const createNewConversation = async () => {
    try {
      console.log('[NewChat] Starting new chat - clearing all state');
      
      // Clean up any active streaming
      cleanupActiveStream();
      
      // Mark as intentionally empty (prevents auto-load)
      setIsIntentionallyEmpty(true);
      
      // Clear current conversation state
      clearConversation();
      setCurrentConversation(null);
      setIsSidebarOpen(false);
      
      // Clear URL parameter - conversation will be created on first message
      updateConversationUrl(null);
      
      // Clear lastConversationStorage so the load effect doesn't reload it
      lastConversationStorage.clear();
      
      // Clear any streaming/loading states
      setCurrentStatus(null);
      setIsLoading(false);
      setIsStreaming(false);
      setStreamingMessageId(null);
      setStreamingMessage(null);
      setInput('');
      
      console.log('[NewChat] State cleared - localMessages should be empty now');
      console.log('[NewChat] conversationLoaded:', conversationLoaded);
      console.log('[NewChat] localConversationId:', localConversationId);
    } catch (error) {
      console.error('[Chat] Failed to clear conversation:', error);
    }
  };

  // Cleanup active stream and all streaming state
  const cleanupActiveStream = () => {
    console.log('[Chat] Cleaning up active stream');
    
    // Cancel the active reader if it exists
    if (activeReaderRef.current) {
      console.log('[Chat] Cancelling active stream reader');
      try {
        activeReaderRef.current.cancel();
      } catch (error) {
        console.error('[Chat] Error cancelling reader:', error);
      }
      activeReaderRef.current = null;
    }
    
    // Clear all streaming state
    activeStreamRef.current = null;
    streamingContentRef.current = '';
    streamingMessageIdRef.current = null;
    currentStreamingMessageRef.current = null;
    
    setIsLoading(false);
    setSkeletonShrinking(false);
    setIsStreaming(false);
    setIsThinkingDisplayComplete(false);
    setStreamingMessageId(null);
    setStreamingMessage(null);
    setCurrentStatus(null);
    setIsReconnecting(false);
    
    // Clear generation storage
    generationStorage.clear();
    
    console.log('[Chat] Stream cleanup complete');
  };

  const switchConversation = async (id: string) => {
    if (!id || id === 'undefined') {
      console.error('[Chat] Invalid conversation ID:', id);
      return;
    }
    
    // Clean up any active streaming before switching
    cleanupActiveStream();
    
    try {
      setIsSwitchingConversation(true);
      setIsIntentionallyEmpty(false); // Clear the empty flag when switching
      
      const conversation = await fetchConversation(id);
      lastConversationStorage.set(id); // Save as last conversation
      setIsSidebarOpen(false);
      
      // Load conversation into our state manager
      if (conversation) {
        loadConversation({
          id: conversation.id,
          title: conversation.title,
          messages: conversation.messages || [],
          thoughts: conversation.thoughts || {},
          toolExecutions: extractToolExecutionsFromMessages(conversation.messages || [])
        });
        
        // Update URL with new conversation ID
        updateConversationUrl(conversation.id);
      } else {
        clearConversation();
      }
      
      setCurrentStatus(null);
    } catch (error) {
      console.error('[Chat] Failed to load conversation:', error);
      // Don't show alert during reconnection
      if (!isReconnecting) {
        alert('Failed to load conversation');
      }
    } finally {
      setIsSwitchingConversation(false);
    }
  };

  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setConversationToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!conversationToDelete) return;

    try {
      setIsDeleting(true);
      await deleteConversation(conversationToDelete);

      // If we deleted the active conversation, clear it
      if (conversationToDelete === currentConversation?.id) {
        setCurrentConversation(null);
        
        // Switch to first available conversation OR clear state if none left
        const remainingConversations = conversations.filter(c => c.id !== conversationToDelete);
        if (remainingConversations.length > 0) {
          const firstConv = remainingConversations[0];
          await fetchConversation(firstConv.id);
        } else {
          // No more conversations - clear all local state
          console.log('[Chat] No conversations remaining - clearing local state');
          clearConversation();
          updateConversationUrl(null);
          lastConversationStorage.clear();
          setIsIntentionallyEmpty(true);
        }
      }

      setConversationToDelete(null);
      setDeleteModalOpen(false);
    } catch (error) {
      console.error('[Chat] Failed to delete conversation:', error);
      alert('Failed to delete conversation');
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditingTitle = (convId: string, currentTitle: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingTitleId(convId);
    setEditingTitleValue(currentTitle);
  };

  const saveEditedTitle = async (conversationId: string) => {
    if (editingTitleValue.trim()) {
      try {
        await updateConversation(conversationId, { title: editingTitleValue.trim() });
        setEditingTitleId(null);
        setEditingTitleValue('');
      } catch (error) {
        console.error('[Chat] Failed to update title:', error);
        alert('Failed to update title');
      }
    }
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitleValue('');
  };

  // Stream message function
  const streamMessage = async (convId: string, messageId: string, responseOrUrl: Response | string) => {
    if (activeStreamRef.current === messageId) {
      return;
    }

    activeStreamRef.current = messageId;

    let canStartDisplaying = false;
    let firstCharReceived = false;
    let firstThinkingReceived = false; // Track first thinking to start UI
    let streamingStarted = false;
    const displayQueue: string[] = [];
    const thinkingQueue: string[] = []; // Queue for thinking characters
    let isDisplaying = false;
    let isDisplayingThinking = false; // Separate flag for thinking display
    let displayedContent = '';
    let displayedThinking = ''; // Track displayed thinking separately
    let thinkingCompleted = false; // Track when thinking animation finishes
    let thinkingStreamingComplete = false; // Track when thinking streaming from server is complete
    let contentCanStart = false; // Track when content display can begin
    let hasTools = false; // Track if this message uses tools
    let allToolsComplete = false; // Track when all tools have finished

    const startSkeletonShrink = () => {
      if (streamingStarted) return;
      streamingStarted = true;
      setSkeletonShrinking(true);
      setIsStreaming(true);
      setTimeout(() => {
        setIsLoading(false);
        setSkeletonShrinking(false);
        canStartDisplaying = true;
      }, 400);
    };

    // Display thinking character-by-character
    const displayNextThinkingChar = async () => {
      if (isDisplayingThinking) return;
      if (!canStartDisplaying) {
        setTimeout(() => displayNextThinkingChar(), 50);
        return;
      }
      isDisplayingThinking = true;

      while (thinkingQueue.length > 0) {
        const char = thinkingQueue.shift();
        if (char) {
          displayedThinking += char;
          
          // Update thinking with full accumulated content (not appending)
          setThought(messageId, displayedThinking, true);
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      isDisplayingThinking = false;
      
      // After displaying all queued thinking, mark thinking as complete
      if (thinkingStreamingComplete && !thinkingCompleted) {
        thinkingCompleted = true;
        
        // Mark thinking as NOT streaming - this triggers the shrink
        setThought(messageId, displayedThinking, false);
        
        // Wait for shrink animation (400ms), then allow content to start
        setTimeout(() => {
          contentCanStart = true;
          
          // Create streaming message bubble
          const initialStreamingMsg = { id: messageId, content: '' };
          setStreamingMessage(initialStreamingMsg);
          currentStreamingMessageRef.current = initialStreamingMsg;
          
          // Start displaying queued content
          if (displayQueue.length > 0 && !isDisplaying) {
            displayNextChar();
          }
        }, 400);
      }
    };

    const displayNextChar = async () => {
      if (isDisplaying) return;
      if (!canStartDisplaying) {
        setTimeout(() => displayNextChar(), 50);
        return;
      }
      
      // If we have thinking, wait for it to complete + delay before starting content
      if (displayedThinking.length > 0 && !contentCanStart) {
        console.log('[Stream] Content waiting for thinking to complete + delay');
        setTimeout(() => displayNextChar(), 100); // Check again in 100ms
        return;
      }
      
      isDisplaying = true;

      while (displayQueue.length > 0) {
        const char = displayQueue.shift();
        if (char) {
          displayedContent += char;
          
          // Update streaming message state for live display
          const streamingMsg = { id: messageId, content: displayedContent };
          setStreamingMessage(streamingMsg);
          currentStreamingMessageRef.current = streamingMsg; // Keep ref in sync
          
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      isDisplaying = false;
    };

    try {
      let eventSource: Response;

      if (typeof responseOrUrl === 'string') {
        console.log(`[Stream] Reconnecting to ${responseOrUrl}`);
        try {
          eventSource = await fetch(responseOrUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });
        } catch (fetchError) {
          console.error('[Stream] Fetch failed:', fetchError);
          // If it's a network error, don't show alert
          throw new Error('Network error - could not reconnect to stream');
        }
      } else {
        eventSource = responseOrUrl;
      }

      if (!eventSource.ok) {
        const errorText = await eventSource.text();
        console.error('[Stream] Server returned error:', eventSource.status, errorText);
        throw new Error(`Stream connection failed: ${eventSource.status}`);
      }

      const reader = eventSource.body?.getReader();
      const decoder = new TextDecoder();
      
      // Store reader ref so it can be cancelled during conversation switching
      if (reader) {
        activeReaderRef.current = reader;
      }

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                if (event.type === 'init') {
                  // Clear any previous thinking to avoid duplication with real-time chunks
                  displayedThinking = '';
                  setThought(messageId, '', false); // Clear thinking display
                  
                  if (event.existingContent) {
                    firstCharReceived = true;
                    startSkeletonShrink();
                    
                    // If no thinking was received, allow content to start immediately
                    if (!firstThinkingReceived) {
                      contentCanStart = true;
                    }
                    
                    // Set the streaming message immediately with existing content
                    displayedContent = event.existingContent;
                    const streamingMsg = { id: messageId, content: displayedContent };
                    setStreamingMessage(streamingMsg);
                    currentStreamingMessageRef.current = streamingMsg; // Keep ref in sync
                    // Also add to queue for smooth char-by-char display
                    displayQueue.push(...event.existingContent.split(''));
                    if (!isDisplaying) displayNextChar();
                  }
                  // Skip existingThinking - we'll get it through real-time chunks instead
                  // This prevents the "appears all at once" issue
                  continue;
                }

                if (event.type === 'status') {
                  setCurrentStatus({ action: event.action, description: event.description, reasoning: event.reasoning, confidence: event.confidence });
                  continue;
                }

                if (event.type === 'tool_status') {
                  setCurrentStatus({ action: event.action, description: event.status, reasoning: event.reasoning, confidence: event.confidence });
                  continue;
                }

                // NEW: Handle unified tool events
                if (event.type === 'tool_event' && event.event) {
                  const toolEvent = event.event;
                  console.log('[Stream] Received tool_event:', toolEvent.type, toolEvent.toolName || toolEvent.toolId);
                  
                  if (toolEvent.type === 'tool_start') {
                    // Mark that this message uses tools
                    hasTools = true;
                    
                    // Update status to show tool is running
                    const toolAction = toolEvent.toolType === 'search' ? 'searching' 
                      : toolEvent.toolType === 'scrape' ? 'scraping'
                      : toolEvent.toolType === 'command' ? 'running_command'
                      : 'processing';
                    const toolDescription = toolEvent.toolName || toolEvent.toolType || 'Running tool';
                    setCurrentStatus({ action: toolAction, description: toolDescription });
                    
                    // Check if this tool execution already exists (e.g., during reconnection)
                    const existingExecutions = conversationState.getToolExecutions(messageId);
                    const existingExecution = existingExecutions.find(e => e.toolId === toolEvent.toolId);
                    
                    if (!existingExecution) {
                      // Create new tool execution
                      const newExecution = {
                        toolId: toolEvent.toolId,
                        toolType: toolEvent.toolType,
                        toolName: toolEvent.toolName,
                        status: 'running' as const,
                        startTime: toolEvent.timestamp,
                        steps: [],
                        streamingContent: '',
                        metadata: toolEvent.metadata,
                      };
                      conversationState.addToolExecution(messageId, newExecution);
                      console.log(`[Stream] Tool started: ${toolEvent.toolName}, executions for ${messageId}:`, conversationState.getToolExecutions(messageId).length);
                      console.log(`[Stream] Current tool executions for ${messageId}:`, conversationState.getToolExecutions(messageId).map(t => `${t.toolName}(${t.status})`));
                      
                      // Tool executions are saved by backend when streaming completes
                      // No need for immediate save - this caused race conditions and duplicates
                    } else {
                      console.log(`[Stream] Tool execution already exists (reconnection): ${toolEvent.toolName} (${toolEvent.toolId})`);
                    }
                  } else if (toolEvent.type === 'tool_progress') {
                    // Add progress step
                    const stepData = {
                      step: toolEvent.step,
                      timestamp: toolEvent.timestamp,
                      progress: toolEvent.progress,
                      data: toolEvent.data,
                    };
                    
                    // Debug log to see what we're storing
                    console.log('[Stream] Adding tool step:', {
                      messageId,
                      toolId: toolEvent.toolId,
                      stepData,
                      rawEvent: toolEvent
                    });
                    
                    conversationState.addToolStep(messageId, toolEvent.toolId, stepData);
                    
                    // Handle streaming content (not for thinking - that has its own state)
                    if (toolEvent.streamingContent && toolEvent.toolType !== 'thinking') {
                      // Update tool execution streaming content
                      conversationState.updateToolStreamingContent(
                        messageId,
                        toolEvent.toolId,
                        toolEvent.streamingContent
                      );
                    }
                    
                    // Progress steps are tracked in memory and saved by backend on completion
                  } else if (toolEvent.type === 'tool_complete') {
                    // Mark tool as complete
                    conversationState.completeToolExecution(
                      messageId,
                      toolEvent.toolId,
                      toolEvent.result,
                      toolEvent.metadata,
                      toolEvent.timestamp
                    );
                    
                    // Calculate duration for logging
                    const completedExecution = conversationState.getToolExecutions(messageId).find(t => t.toolId === toolEvent.toolId);
                    const duration = completedExecution ? completedExecution.duration : 'unknown';
                    console.log(`[Stream] Tool completed: ${toolEvent.toolName} (${duration}ms)`);
                    console.log(`[Stream] Updated tool executions for ${messageId}:`, conversationState.getToolExecutions(messageId).map(t => `${t.toolName}(${t.status})`));
                    
                    // Check if all tools are now complete
                    const runningTools = conversationState.getToolExecutions(messageId).filter(t => t.status === 'running');
                    if (runningTools.length === 0) {
                      allToolsComplete = true;
                      console.log('[Stream] All tools completed, content can now start');
                      
                      // Update status to show we're generating response
                      setCurrentStatus({ action: 'processing', description: 'Generating response' });
                      
                      // Allow content to start - whether it's already queued or will arrive soon
                      if (!contentCanStart) {
                        contentCanStart = true;
                        console.log('[Stream] Content flag set to true, ready for content chunks');
                        
                        // If there's already queued content, start displaying it
                        if (displayQueue.length > 0) {
                          // Create streaming message if it doesn't exist
                          if (!currentStreamingMessageRef.current) {
                            const initialStreamingMsg = { id: messageId, content: '' };
                            setStreamingMessage(initialStreamingMsg);
                            currentStreamingMessageRef.current = initialStreamingMsg;
                          }
                          
                          // Start displaying content
                          if (!isDisplaying) {
                            displayNextChar();
                          }
                        }
                      }
                    }
                    
                    // Tool completion tracked in memory, saved by backend on stream completion
                  } else if (toolEvent.type === 'tool_error') {
                    // Mark tool as failed
                    // Ensure error is a string (handle cases where it might be an object)
                    const errorMessage = typeof toolEvent.error === 'string' 
                      ? toolEvent.error 
                      : JSON.stringify(toolEvent.error);
                    
                    conversationState.failToolExecution(
                      messageId,
                      toolEvent.toolId,
                      errorMessage,
                      toolEvent.timestamp
                    );
                    console.error(`[Stream] Tool failed: ${toolEvent.toolName} - ${errorMessage}`);
                    
                    // Tool error tracked in memory, saved by backend on stream completion
                  }
                  continue;
                }

                if (event.type === 'chunk' && event.content) {
                  // Check if this is a thinking chunk or content chunk
                  if (event.thinking) {
                    // Handle thinking chunks - only queue for character-by-character animation
                    // console.log('[Stream] Received thinking chunk, length:', event.content.length, 'content:', event.content.substring(0, 50));
                    
                    // Start UI on first thinking chunk (same as content)
                    if (!firstThinkingReceived) {
                      firstThinkingReceived = true;
                      startSkeletonShrink();
                    }
                    
                    // Queue for smooth character-by-character display (no immediate bulk update)
                    thinkingQueue.push(...event.content.split(''));
                    if (!isDisplayingThinking) displayNextThinkingChar();
                  } else {
                    // Handle regular content chunks
                    
                    // If we received thinking before, thinking is NOW DONE (streaming from backend complete)
                    if (firstThinkingReceived && !thinkingStreamingComplete) {
                      thinkingStreamingComplete = true;
                      console.log('🔥🔥🔥 THINKING STREAMING ENDED - First content chunk arrived:', JSON.stringify(event.content));
                      
                      // The shrink will be triggered by displayNextThinkingChar() when it finishes
                      // Don't call setThought here - let the display loop finish first
                    }
                    
                    if (!firstCharReceived) {
                      firstCharReceived = true;
                      startSkeletonShrink();
                      
                      // If no thinking was received, check if we can start content
                      if (!firstThinkingReceived) {
                        // Only allow content if no tools, or all tools are complete
                        if (!hasTools || allToolsComplete) {
                          contentCanStart = true;
                          console.log('[Stream] ✅ No thinking - starting content immediately');
                          
                          // Create initial streaming message immediately so bubble appears
                          const initialStreamingMsg = { id: messageId, content: '' };
                          setStreamingMessage(initialStreamingMsg);
                          currentStreamingMessageRef.current = initialStreamingMsg;
                        } else {
                          console.log('[Stream] Content blocked - waiting for tools to complete (no thinking case)');
                        }
                      }
                    }
                    
                    // Always queue content chunks, but don't display until thinking is complete
                    // console.log('[Stream] Queueing content chunk for later display');
                    displayQueue.push(...event.content.split(''));
                    
                    // Only start displaying if content can start (thinking is complete)
                    if (contentCanStart && !isDisplaying) {
                      displayNextChar();
                    }
                  }
                  continue;
                }

                if (event.type === 'thinking' && event.content) {
                  // console.log('[Stream] Received thinking (full block), length:', event.content.length);
                  // This is the final complete thinking (sent after chunks)
                  thinkingStreamingComplete = true;
                  // console.log('[Stream] Thinking streaming from server is now complete');
                  
                  // Don't accumulate - just replace with the complete version
                  // to avoid duplication if we already received thinking chunks
                  if (displayedThinking.length === 0) {
                    // Only use this if we didn't get chunks (non-streaming path)
                    displayedThinking = event.content;
                    setThought(messageId, displayedThinking, false); // Not streaming
                  } else {
                    // console.log('[Stream] Ignoring thinking event, already have chunks');
                  }
                  continue;
                }

                if (event.type === 'complete') {
                  console.log('[Stream] Received complete event');
                  // Stop streaming animation but keep message visible until display queue finishes
                  setIsStreaming(false);
                  
                  // Ensure thinking streaming is marked complete if not already
                  if (!thinkingStreamingComplete && firstThinkingReceived) {
                    thinkingStreamingComplete = true;
                    console.log('[Stream] Marking thinking streaming complete on stream end');
                  }
                  
                  // Mark all running tools as completed
                  const runningTools = conversationState.getToolExecutions(messageId).filter(t => t.status === 'running');
                  runningTools.forEach(tool => {
                    conversationState.updateToolExecution(messageId, tool.toolId, {
                      status: 'completed',
                      endTime: Date.now(),
                      result: 'Completed successfully'
                    });
                  });
                  if (runningTools.length > 0) {
                    console.log(`[Stream] Marked ${runningTools.length} tools as complete`);
                  }
                  
                  // Break out of SSE loop - we'll fetch MongoDB data after display finishes
                  break;
                }

                if (event.type === 'error') {
                  throw new Error(event.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue;
                throw e;
              }
            }
          }
        }

        // Wait for both display queues to finish rendering all characters
        while (displayQueue.length > 0 || isDisplaying || thinkingQueue.length > 0 || isDisplayingThinking) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Capture the streaming message immediately to avoid closure/error issues
        const completedStreamingMessage = currentStreamingMessageRef.current;
        console.log(`[Stream] Captured streaming message:`, {
          hasMessage: !!completedStreamingMessage,
          messageId: completedStreamingMessage?.id,
          contentLength: completedStreamingMessage?.content?.length || 0
        });
        
        console.log(`[Stream] 🔍 CRITICAL CHECK - completedStreamingMessage:`, !!completedStreamingMessage, 'convId (param):', convId, 'localConversationId (closure):', localConversationId);

        // Save the completed streaming message to permanent conversation state
        // USE convId parameter, not localConversationId from closure!
        if (completedStreamingMessage && convId) {
          // Check if message already exists (can happen during reconnect to completed generation)
          const existingMessage = localMessages.find(m => m.id === completedStreamingMessage.id);
          
          if (existingMessage) {
            console.log(`[Stream] Message ${completedStreamingMessage.id} already exists in conversation, skipping add`);
          } else {
            console.log(`[Stream] ✅ ADDING MESSAGE TO PERMANENT STATE using convId:`, convId);
            console.log(`[Stream] Adding completed message to permanent state:`, {
              messageId: completedStreamingMessage.id,
              contentLength: completedStreamingMessage.content.length,
              currentStateMessageCount: localMessages.length
            });
            console.log(`[Stream] Before saving - tool executions for ${completedStreamingMessage.id}:`, conversationState.getToolExecutions(completedStreamingMessage.id).map(t => `${t.toolName}(${t.status})`));
            
            addLocalMessage({
              id: completedStreamingMessage.id,
              role: 'assistant',
              content: completedStreamingMessage.content,
              timestamp: new Date(),
              metadata: {
                conversationId: convId, // Use convId parameter, not localConversationId!
              }
            });
            
            console.log(`[Stream] addLocalMessage called, waiting for state update...`);
            console.log(`[Stream] localMessages.length BEFORE addLocalMessage:`, localMessages.length);
            
            // Wait a bit to ensure state has updated
            await new Promise(resolve => setTimeout(resolve, 200)); // Increased wait time
            
            console.log(`[Stream] After state update wait - checking if message appeared in state...`);
          }
          
          // Note: localMessages might not update here due to closure, but that's okay
          // The important thing is that conversationState has it

          // Tool executions are already saved by the backend in respond.ts when streaming completes
          // Backend collects tool executions from Redis state and passes to store_message
          // No need for frontend to make a separate POST - that caused race conditions
          const toolExecutions = conversationState.getToolExecutions(completedStreamingMessage.id);
          if (toolExecutions.length > 0) {
            console.log(`[Stream] Tool executions already saved by backend: ${toolExecutions.length} executions for message ${completedStreamingMessage.id}`);
          }
        } else {
          console.error(`[Stream] ❌ FAILED TO ADD MESSAGE - completedStreamingMessage:`, !!completedStreamingMessage, 'convId:', convId);
          console.error(`[Stream] ❌ This is why the message disappears! It's never added to localMessages!`);
        }

        // Mark any streaming thoughts as completed
        if (messageId) {
          completeThought(messageId);
        }

        console.log(`[Stream] Streaming completed for message ${messageId}.`);
        
        console.log(`[Stream] Message should now be in permanent state. Waiting to ensure React has rendered it...`);
        
        // DON'T clear streamingMessage immediately - let it stay until we're sure the permanent message is rendered
        // This prevents the message from disappearing during the React render cycle
        // The streaming message will be cleaned up in finally{} when all streaming state is cleared
        
        console.log(`[Stream] Keeping streaming message visible until finally cleanup`);
      }
    } catch (error: unknown) {
      console.error('[Stream] Error:', error);
      console.log(`[Stream] Clearing streaming message due to error`);
      setStreamingMessage(null);
      currentStreamingMessageRef.current = null;
      throw error;
    } finally {
      console.log('[Stream] Cleaning up - clearing all streaming state');
      
      // Clear streaming message (if not already cleared by error)
      setStreamingMessage(null);
      currentStreamingMessageRef.current = null;
      
      generationStorage.clear();
      activeStreamRef.current = null;
      activeReaderRef.current = null; // Clear reader ref
      setIsLoading(false);
      setSkeletonShrinking(false);
      setIsStreaming(false);
      setIsThinkingDisplayComplete(false);
      setStreamingMessageId(null);
      setCurrentStatus(null);
      setIsReconnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let convId = localConversationId;

    // Create new conversation if none exists
    if (!convId) {
      try {
        const newConv = await createConversation('New Conversation');
        convId = newConv.id;
        setCurrentConversation(newConv);
        lastConversationStorage.set(newConv.id);
        
        // Clear the intentionally empty flag
        setIsIntentionallyEmpty(false);
        
        // Load the new conversation into local state
        loadConversation({
          id: newConv.id,
          title: newConv.title,
          messages: [],
          thoughts: {}
        });
        
        // Update URL with new conversation ID
        updateConversationUrl(newConv.id);
      } catch (error) {
        console.error('[Chat] Failed to create conversation:', error);
        alert('Failed to create conversation');
        return;
      }
    }

    const userMessageContent = input.trim();
    setInput('');
    setIsLoading(true);
    setCurrentStatus(null);
    // Don't clear currentThinking here - it removes thinking from existing messages

    try {
      // Add user message to conversation state immediately
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      addLocalMessage({
        id: userMessageId,
        role: 'user',
        content: userMessageContent,
        timestamp: new Date(),
        metadata: {
          conversationId: convId,
        }
      });

      // Generate messageId for assistant response
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[Stream] Will stream assistant response with messageId: ${messageId}`);
      
      setStreamingMessageId(messageId);
      setIsThinkingDisplayComplete(false); // Reset for new message
      
      // Initialize streaming refs
      streamingContentRef.current = '';
      streamingMessageIdRef.current = messageId;

      // Store generation info for reconnection BEFORE fetch
      // This ensures storage is set even if user refreshes before fetch completes
      const generationData = {
        messageId,
        conversationId: convId,
        streamUrl: `/api/v1/chat/completions`,
        startedAt: Date.now(),
        userMessage: userMessageContent, // Store user message for reconnection display
      };
      console.log('[Chat] Storing generation data for reconnection:', generationData);
      generationStorage.set(generationData);
      console.log('[Chat] Verification - stored data:', generationStorage.get());

      // Start streaming response
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model: 'Red',
          messages: [{ role: 'user', content: userMessageContent }],
          stream: true,
          conversationId: convId,
          messageId,
          userMessageId, // Pass frontend's user message ID so backend uses the same one
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start generation: ${response.status}`);
      }

      await streamMessage(convId, messageId, response);
    } catch (error) {
      console.error('[Chat] Error sending message:', error);
      // Clear storage on error since generation failed
      generationStorage.clear();
      // Don't show alert for network/reconnection errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorMessageLower = errorMessage.toLowerCase();
      const isNetworkError = errorMessageLower.includes('failed to fetch') || 
                           errorMessageLower.includes('load failed') ||
                           errorMessageLower.includes('network error') ||
                           errorMessageLower.includes('stream connection failed') ||
                           errorMessageLower.includes('networkerror');
      if (!isNetworkError) {
        alert(`Failed to send message: ${errorMessage}`);
      } else {
        console.warn('[Chat] Network error (not showing alert):', errorMessage);
      }
      setIsLoading(false);
      setSkeletonShrinking(false);
    }
  };

  return (
    <div className="flex bg-[#0a0a0a]" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {!authLoading && !user ? (
        <LoginModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={handleLoginSuccess}
          canDismiss={false}
        />
      ) : authLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      ) : user && !user.profileComplete ? (
        <CompleteProfileModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={handleProfileComplete}
        />
      ) : (
        <>
          <Sidebar
            isOpen={isSidebarOpen}
            conversations={conversations}
            activeConversationId={currentConversation?.id || null}
            editingTitleId={editingTitleId}
            editingTitleValue={editingTitleValue}
            onClose={() => setIsSidebarOpen(false)}
            onNewChat={createNewConversation}
            onSwitchConversation={switchConversation}
            onDeleteClick={handleDeleteClick}
            onStartEditingTitle={(conv, e) => startEditingTitle(conv.id, conv.title, e)}
            onSaveEditedTitle={saveEditedTitle}
            onCancelEditingTitle={cancelEditingTitle}
            onEditingTitleChange={setEditingTitleValue}
          />

          <div className="flex-1 flex flex-col">
            <Header
              title={localConversation?.title || 'Chat'}
              onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
              onNewChat={createNewConversation}
              onTitleClick={scrollToTop}
            />

            {conversationsLoading ? (
              <LoadingSpinner 
                mode="fullscreen" 
                message="Loading conversations..." 
                size={32}
              />
            ) : (
              <>
                <Messages
                  messages={localMessages}
                  streamingMessage={streamingMessage}
                  thoughts={localThoughts}
                  currentStatus={currentStatus}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  isThinkingDisplayComplete={isThinkingDisplayComplete}
                  streamingMessageId={streamingMessageId}
                  skeletonShrinking={skeletonShrinking}
                  isReconnecting={isReconnecting}
                  messagesEndRef={messagesEndRef}
                  conversationId={localConversationId}
                  modalState={modalState}
                  onOpenModal={(messageId: string) => setModalState({ isOpen: true, messageId })}
                  onCloseModal={() => setModalState({ isOpen: false, messageId: null })}
                  pagination={pagination}
                  onLoadMore={loadMoreMessages}
                  scrollContainerRef={messagesScrollRef}
                  preventScrollRestorationRef={preventScrollRestorationRef}
                />

                <ChatInput
                  value={input}
                  disabled={isLoading || isStreaming}
                  messagesEndRef={messagesEndRef}
                  onChange={setInput}
                  onSend={sendMessage}
                />
              </>
            )}
          </div>

          <ConfirmModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleDeleteConfirm}
            title="Delete Conversation"
            message="Are you sure you want to delete this conversation? This action cannot be undone."
            confirmText="Delete"
            cancelText="Cancel"
            variant="danger"
          />
          
          {isDeleting && (
            <LoadingSpinner 
              mode="fullscreen" 
              message="Deleting conversation..." 
              size={32}
            />
          )}
          
          {isSwitchingConversation && (
            <LoadingSpinner 
              mode="fullscreen" 
              message="Loading conversation..." 
              size={32}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingSpinner mode="fullscreen" message="Loading..." size={32} />}>
      <ChatPageContent />
    </Suspense>
  );
}
