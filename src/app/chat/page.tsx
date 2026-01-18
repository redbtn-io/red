'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { flushSync } from 'react-dom';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { generationStorage } from '@/lib/storage/generation-storage';
import { lastConversationStorage } from '@/lib/storage/last-conversation-storage';
import { useConversationState } from '@/lib/conversation/use-conversation-state';
import { conversationState } from '@/lib/conversation/conversation-state';
import { ConfirmModal, ErrorModal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatInput } from '@/components/chat/ChatInput';
import { Messages } from '@/components/chat/Messages';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/contexts/ConversationContext';
import { AgentSelector } from '@/components/chat/AgentSelector';
import { GraphRunDrawer, GraphViewButton, type GraphDefinition } from '@/components/graph';
import { useGraphRunState } from '@/hooks/useGraphRunState';
import type { ToolExecution } from '@/lib/tools/tool-types';

// Agent graph type
interface AgentGraph {
  graphId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isDefault: boolean;
}

/**
 * Extract tool executions from messages and organize by messageId
 * API returns toolExecutions at message level, but we store at conversation level
 */
function extractToolExecutionsFromMessages(messages: Array<{id: string; toolExecutions?: ToolExecution[]}>): Record<string, ToolExecution[]> {
  const toolExecutionsMap: Record<string, ToolExecution[]> = {};
  
  for (const message of messages) {
    if (message.id && message.toolExecutions && Array.isArray(message.toolExecutions) && message.toolExecutions.length > 0) {
      toolExecutionsMap[message.id] = message.toolExecutions;
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
  const [errorModal, setErrorModal] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
  const [isSwitchingConversation, setIsSwitchingConversation] = useState(false);
  const [isIntentionallyEmpty, setIsIntentionallyEmpty] = useState(false); // Track "new chat" state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [reconnectAttempted, setReconnectAttempted] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<{ id: string; content: string } | null>(null);
  
  // Agent graph selection state
  const [availableAgents, setAvailableAgents] = useState<AgentGraph[]>([]);
  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [currentGraphDefinition, setCurrentGraphDefinition] = useState<GraphDefinition | null>(null);
  
  // Graph run state for visual viewer
  const {
    runState: graphRunState,
    isRunning: graphIsRunning,
    showDrawer: showGraphDrawer,
    openDrawer: openGraphDrawer,
    closeDrawer: closeGraphDrawer,
    toggleDrawer: toggleGraphDrawer,
    processGraphEvent,
    resetRunState: resetGraphRunState,
    startRun: startGraphRun,
    getRunState: getGraphRunState,
    initializeFromState: initGraphFromState,
    loadRunState: loadGraphRunState,
    graph: activeGraph,
  } = useGraphRunState({ graphDefinition: currentGraphDefinition });
  
  // Modal state - using both state and ref to prevent stale closure issues
  const [modalState, setModalState] = useState<{ isOpen: boolean; messageId: string | null }>({ isOpen: false, messageId: null });
  const modalStateRef = useRef<{ isOpen: boolean; messageId: string | null }>({ isOpen: false, messageId: null });
  
  // Sync ref with state
  useEffect(() => {
    modalStateRef.current = modalState;
  }, [modalState]);
  
  const activeStreamRef = useRef<string | null>(null);
  const activeReaderRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null); // Track active reader for aborting
  const eventSourceRef = useRef<EventSource | null>(null); // EventSource for SSE connection
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
  
  // Handler to view a historical graph run from message details
  const handleViewHistoricalGraph = useCallback((graphRun: unknown) => {
    // Type check and load the graph run
    const run = graphRun as {
      graphId?: string;
      status?: 'running' | 'completed' | 'error';
      executionPath?: string[];
      nodeProgress?: Record<string, {
        nodeId: string;
        status: 'pending' | 'running' | 'completed' | 'error';
        stepName?: string;
        startTime?: number;
        endTime?: number;
        error?: string;
      }>;
      startTime?: number;
      endTime?: number;
      error?: string;
    };
    
    if (run && run.executionPath && run.status) {
      loadGraphRunState({
        graphId: run.graphId,
        status: run.status,
        executionPath: run.executionPath,
        nodeProgress: run.nodeProgress || {},
        startTime: run.startTime,
        endTime: run.endTime,
        error: run.error,
      });
      // Close the message details modal
      setModalState({ isOpen: false, messageId: null });
    }
  }, [loadGraphRunState]);

  const handleLoginSuccess = async () => {
    await refreshUser();
  };

  const handleProfileComplete = () => {
    // Profile is now complete, refreshUser will update the user object
  };

  // Fetch available agent graphs
  useEffect(() => {
    if (!user || !user.profileComplete) return;
    
    const fetchAgents = async () => {
      try {
        setAgentsLoading(true);
        const res = await fetch('/api/v1/graphs?graphType=agent', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          // Get user's default graph ID (from user object or fall back to system default)
          const userDefaultGraphId = user?.defaultGraphId || 'red-assistant';
          
          // Format agent graphs for selection
          const agents: AgentGraph[] = (data.graphs || [])
            .map((g: any) => ({
              graphId: g.graphId,
              name: g.name,
              description: g.description,
              isSystem: g.isSystem || false,
              // Mark as default if it matches user's preference
              isDefault: g.graphId === userDefaultGraphId,
            }));
          setAvailableAgents(agents);
          
          // Check URL for graph parameter
          const urlGraphId = searchParams.get('graph');
          if (urlGraphId && agents.some(a => a.graphId === urlGraphId)) {
            setSelectedGraphId(urlGraphId);
          } else {
            // Default to user's default graph or first one
            const defaultAgent = agents.find(a => a.graphId === userDefaultGraphId);
            if (defaultAgent) {
              setSelectedGraphId(defaultAgent.graphId);
            } else if (agents.length > 0) {
              setSelectedGraphId(agents[0].graphId);
            }
          }
        }
      } catch (err) {
        console.error('[Chat] Error fetching agents:', err);
      } finally {
        setAgentsLoading(false);
      }
    };
    
    fetchAgents();
  }, [user, searchParams]);

  // Fetch graph definition when selectedGraphId changes (for visual viewer)
  useEffect(() => {
    if (!selectedGraphId || !user) return;
    
    const fetchGraphDefinition = async () => {
      try {
        const res = await fetch(`/api/v1/graphs/${selectedGraphId}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          const graph = data.graph || data; // API returns { graph: {...} }
          // Transform API response to GraphDefinition format
          const graphDef: GraphDefinition = {
            id: graph.graphId,
            name: graph.name,
            nodes: (graph.nodes || []).map((n: any) => ({
              id: n.id || n.nodeId,
              type: n.type || 'universal',
              name: n.name || n.id,
              config: n.config,
            })),
            edges: (graph.edges || []).map((e: any) => ({
              from: e.from || e.source,
              to: e.to || e.target,
              condition: e.condition,
              targets: e.targets,
              fallback: e.fallback,
            })),
            entryNodeId: graph.entryNodeId || graph.nodes?.[0]?.id,
          };
          setCurrentGraphDefinition(graphDef);
        }
      } catch (err) {
        console.error('[Chat] Error fetching graph definition:', err);
      }
    };
    
    fetchGraphDefinition();
  }, [selectedGraphId, user]);

  // Handle setting default graph
  const handleSetDefaultGraph = async (graphId: string) => {
    // Optimistically update local state first
    setAvailableAgents(prev => 
      prev.map(agent => ({
        ...agent,
        isDefault: agent.graphId === graphId,
      }))
    );
    
    try {
      const res = await fetch('/api/v1/user/preferences/default-graph', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ graphId }),
      });
      
      if (!res.ok) {
        console.error('[Chat] Failed to set default graph:', res.status);
        // Optionally revert on failure, but for now just log
      }
    } catch (err) {
      console.error('[Chat] Error setting default graph:', err);
    }
  };

  // Check for active generation and reconnect
  useEffect(() => {
    if (!user || !user.profileComplete || reconnectAttempted || !currentConversation || !currentConversation.id || !conversationLoaded) {
      return;
    }

    // Check if there's an active generation for this conversation
    const checkActiveGeneration = async () => {
      try {
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
        
        setReconnectAttempted(true);
        setIsReconnecting(true);
        setIsLoading(true);
        
        // Set initial status so LoadingStates shows immediately
        setCurrentStatus({ action: 'processing', description: 'Reconnecting...' });

        // Check if this is a v2 run (has runId) or legacy (has messageId)
        if (data.runId) {
          // v2 run-based streaming
          const { runId, conversationId } = data;
          console.log(`[Reconnect] Found active run ${runId}, reconnecting...`);
          
          // Generate a placeholder messageId for the streaming message
          const messageId = `msg_${Date.now()}_reconnect`;
          setStreamingMessageId(messageId);
          
          // Connect to the run stream
          const streamUrl = `/api/v1/runs/${runId}/stream`;
          await streamMessage(conversationId, messageId, streamUrl);
        } else if (data.messageId) {
          // Legacy message-based streaming
          const { messageId, conversationId } = data;
          console.log(`[Reconnect] Found active legacy generation ${messageId}, reconnecting...`);
          
          setStreamingMessageId(messageId);
          const reconnectUrl = `/api/v1/messages/${messageId}/reconnect`;
          await streamMessage(conversationId, messageId, reconnectUrl);
        }
        
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
      if (document.hidden) return;
      
      // If already actively streaming (not just having a streamingMessageId), don't interrupt
      // Note: streamingMessageId can be set from a previous generation, so we check isStreaming
      if (isStreaming) return;

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
          // Only check for new messages if we have messages and last one is from user
          // This means there might be an assistant response that completed while we were away
          const shouldCheckForNewMessages = localMessages.length > 0 && 
            localMessages[localMessages.length - 1].role === 'user';

          if (shouldCheckForNewMessages) {
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
                  appendMessages(messagesData.messages);
                }
              }
            } catch (err) {
              console.error('[Visibility] Failed to fetch new messages:', err);
            }
          }
          return;
        }
        
        // Found an active generation - reconnect to it
        setIsReconnecting(true);
        setIsLoading(true);
        setCurrentStatus({ action: 'processing', description: 'Reconnecting...' });

        // Check if this is a v2 run (has runId) or legacy (has messageId)
        if (data.runId) {
          // v2 run-based streaming
          const { runId, conversationId } = data;
          console.log(`[Visibility] Found active run ${runId}, reconnecting...`);
          
          // Generate a placeholder messageId for the streaming message
          const messageId = `msg_${Date.now()}_reconnect`;
          setStreamingMessageId(messageId);
          
          // Connect to the run stream
          const streamUrl = `/api/v1/runs/${runId}/stream`;
          await streamMessage(conversationId, messageId, streamUrl);
        } else if (data.messageId) {
          // Legacy message-based streaming
          const { messageId, conversationId } = data;
          console.log(`[Visibility] Found active legacy generation ${messageId}, reconnecting...`);
          
          setStreamingMessageId(messageId);
          const reconnectUrl = `/api/v1/messages/${messageId}/reconnect`;
          await streamMessage(conversationId, messageId, reconnectUrl);
        }
        
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
      } else {
        console.warn('[Init] URL conversation not found:', urlConversationId);
      }
    }
    
    if (!conversationToLoad && lastConvId && lastConvId !== 'undefined') {
      // Fall back to last conversation from storage
      const exists = conversations.some(c => c.id === lastConvId);
      if (exists) {
        conversationToLoad = lastConvId;
      }
    }
    
    if (!conversationToLoad && conversations.length > 0 && conversations[0].id) {
      // Fall back to first available conversation
      conversationToLoad = conversations[0].id;
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
    
    setLoadingMore(true);

    try {
      const response = await fetch(
        `/api/v1/conversations/${localConversationId}/messages?before=${beforeTimestamp}&limit=50`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          prependMessages(data.messages, data.hasMore);
        } else {
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

  const scrollToBottom = () => {
    if (messagesScrollRef.current) {
      // With flex-col-reverse, scrollTop 0 is the bottom (newest messages)
      messagesScrollRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const createNewConversation = async () => {
    try {
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
    } catch (error) {
      console.error('[Chat] Failed to clear conversation:', error);
    }
  };

  // Cleanup active stream and all streaming state
  const cleanupActiveStream = () => {
    // Cancel the active reader if it exists
    if (activeReaderRef.current) {
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
      // Don't show error during reconnection
      if (!isReconnecting) {
        setErrorModal({ isOpen: true, message: 'Failed to load conversation' });
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
      setErrorModal({ isOpen: true, message: 'Failed to delete conversation' });
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
        setErrorModal({ isOpen: true, message: 'Failed to update title' });
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
      // Use native EventSource for SSE with automatic reconnection support
      console.log(`[Stream] ${new Date().toISOString()} Starting SSE with EventSource to: ${typeof responseOrUrl === 'string' ? responseOrUrl : 'Response object'}`);

      // For backward compatibility, handle Response object by extracting URL or falling back to reader
      if (typeof responseOrUrl !== 'string') {
        console.warn('[Stream] Response object passed - extracting via reader (legacy path)');
        const reader = responseOrUrl.body?.getReader();
        if (!reader) throw new Error('No reader available from Response');
        // Fall through to legacy reader logic below
        activeReaderRef.current = reader;
        const decoder = new TextDecoder();
        let partialLine = '';
        let chunkCount = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunkCount++;
          const chunkText = decoder.decode(value, { stream: true });
          const lines = (partialLine + chunkText).split('\n');
          partialLine = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;
              try {
                const event = JSON.parse(data);
                await processEvent(event);
              } catch (e) {
                if (!(e instanceof SyntaxError)) throw e;
              }
            }
          }
        }
        return;
      }

      // Create EventSource for SSE
      const streamUrl = responseOrUrl;
      
      await new Promise<void>((resolve, reject) => {
        // Close any existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        
        const eventSource = new EventSource(streamUrl, { withCredentials: true });
        eventSourceRef.current = eventSource;
        let messageCount = 0;
        let openResolved = false;
        
        // Timeout if connection doesn't open within 30 seconds
        const openTimeout = setTimeout(() => {
          if (!openResolved) {
            console.error('[Stream] SSE connection timeout');
            eventSource.close();
            eventSourceRef.current = null;
            reject(new Error('SSE connection timeout'));
          }
        }, 30000);
        
        eventSource.onopen = () => {
          console.log(`[Stream] ${new Date().toISOString()} EventSource connection opened`);
          if (!openResolved) {
            openResolved = true;
            clearTimeout(openTimeout);
          }
        };
        
        eventSource.onerror = (err) => {
          console.error('[Stream] EventSource error:', err);
          // EventSource auto-reconnects, but if connection never opened, reject
          if (!openResolved) {
            clearTimeout(openTimeout);
            eventSource.close();
            eventSourceRef.current = null;
            reject(new Error('SSE connection failed'));
          }
          // If already connected, EventSource will auto-reconnect with Last-Event-ID
        };
        
        eventSource.onmessage = async (evt) => {
          messageCount++;
          const data = evt.data;
          
          if (data === '[DONE]') {
            console.log('[Stream] SSE stream complete');
            eventSource.close();
            eventSourceRef.current = null;
            resolve();
            return;
          }
          
          try {
            const event = JSON.parse(data);
            const isDone = await processEvent(event);
            if (isDone) {
              console.log('[Stream] SSE stream complete (via processEvent)');
              eventSource.close();
              eventSourceRef.current = null;
              resolve();
            }
          } catch (e) {
            // Ignore parse errors (comments, keepalives)
            if (!(e instanceof SyntaxError)) {
              console.error('[Stream] Error processing event:', e);
            }
          }
        };
      });

      // Helper function to process a single SSE event
      // Returns true if the stream should close (complete event received)
      async function processEvent(event: any): Promise<boolean> {

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
                  
                  // Process graph state from init event
                  // This catches up the graph viewer on any nodes that executed before SSE connected
                  if (event.state?.graph) {
                    const graphState = event.state.graph;
                    console.log('[Stream] Init event with graph state:', {
                      runId: event.state.runId,
                      executionPath: graphState.executionPath,
                      nodeCount: Object.keys(graphState.nodeProgress || {}).length,
                      status: event.state.status,
                      stateTimestamp: event.timestamp,
                    });
                    
                    // Initialize the graph viewer from the existing run state
                    // Pass the init event timestamp so we can filter stale buffered events
                    // Returns any buffered events that are newer than state for replay
                    const eventsToReplay = initGraphFromState({
                      runId: event.state.runId,
                      graphId: event.state.graphId,
                      executionPath: graphState.executionPath || [],
                      nodeProgress: graphState.nodeProgress || {},
                      startTime: event.state.startedAt,
                      endTime: event.state.completedAt,
                      status: event.state.status,
                      stateTimestamp: event.timestamp,
                    });
                    
                    // Open the graph drawer when reconnecting to show the graph view
                    if (event.state.status === 'running') {
                      openGraphDrawer();
                    }
                    
                    // Replay any buffered events that arrived before init but are newer than state
                    if (eventsToReplay && eventsToReplay.length > 0) {
                      console.log(`[Stream] Replaying ${eventsToReplay.length} buffered graph events`);
                      for (const bufferedEvent of eventsToReplay) {
                        processGraphEvent(bufferedEvent);
                      }
                    }
                  }
                  
                  // Skip existingThinking - we'll get it through real-time chunks instead
                  // This prevents the "appears all at once" issue
                  return false;
                }

                if (event.type === 'status') {
                  setCurrentStatus({ action: event.action, description: event.description, reasoning: event.reasoning, confidence: event.confidence });
                  return false;
                }

                if (event.type === 'tool_status') {
                  setCurrentStatus({ action: event.action, description: event.status, reasoning: event.reasoning, confidence: event.confidence });
                  return false;
                }

                // NEW: Handle unified tool events
                if (event.type === 'tool_event' && event.event) {
                  const toolEvent = event.event;
                  
                  // Handle graph/node events for visual viewer
                  if (toolEvent.type.startsWith('graph_') || toolEvent.type.startsWith('node_')) {
                    console.log(`[Stream] ${new Date().toISOString()} Graph event: ${toolEvent.type}`, {
                      nodeId: toolEvent.nodeId,
                      status: toolEvent.status,
                    });
                    // Use flushSync to force immediate render for live visual feedback
                    flushSync(() => {
                      processGraphEvent(toolEvent);
                    });
                    // Don't continue - these may also be tool events
                  }
                  
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
                      
                      // Tool executions are saved by backend when streaming completes
                      // No need for immediate save - this caused race conditions and duplicates
                    }
                  } else if (toolEvent.type === 'tool_progress') {
                    // Add progress step
                    const stepData = {
                      step: toolEvent.step,
                      timestamp: toolEvent.timestamp,
                      progress: toolEvent.progress,
                      data: toolEvent.data,
                    };
                    
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
                    
                    // Check if all tools are now complete
                    const runningTools = conversationState.getToolExecutions(messageId).filter(t => t.status === 'running');
                    if (runningTools.length === 0) {
                      allToolsComplete = true;
                      
                      // Update status to show we're generating response
                      setCurrentStatus({ action: 'processing', description: 'Generating response' });
                      
                      // Allow content to start - whether it's already queued or will arrive soon
                      if (!contentCanStart) {
                        contentCanStart = true;
                        
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
                  return false;
                }

                // ========================================
                // v2 Event Format: Flat events (no wrapper)
                // These handle events from RunPublisher
                // ========================================
                
                // Handle graph/node/run events directly (v2 format - no wrapper)
                if (event.type.startsWith('graph_') || event.type.startsWith('node_') || event.type.startsWith('run_')) {
                  flushSync(() => {
                    processGraphEvent(event);
                  });
                  // Continue processing - node events don't need additional handling
                  if (event.type.startsWith('node_')) return false;
                }
                
                // v2: tool_start (flat, not wrapped in tool_event)
                if (event.type === 'tool_start' && event.toolId) {
                  hasTools = true;
                  const toolAction = event.toolType === 'search' ? 'searching' 
                    : event.toolType === 'scrape' ? 'scraping'
                    : event.toolType === 'command' ? 'running_command'
                    : 'processing';
                  setCurrentStatus({ action: toolAction, description: event.toolName || event.toolType || 'Running tool' });
                  
                  const existingExecutions = conversationState.getToolExecutions(messageId);
                  if (!existingExecutions.find(e => e.toolId === event.toolId)) {
                    conversationState.addToolExecution(messageId, {
                      toolId: event.toolId,
                      toolType: event.toolType,
                      toolName: event.toolName,
                      status: 'running' as const,
                      startTime: event.timestamp,
                      steps: [],
                      streamingContent: '',
                    });
                  }
                  return false;
                }
                
                // v2: tool_progress (flat)
                if (event.type === 'tool_progress' && event.toolId) {
                  conversationState.addToolStep(messageId, event.toolId, {
                    step: event.step,
                    timestamp: event.timestamp,
                    progress: event.progress,
                    data: event.data,
                  });
                  return false;
                }
                
                // v2: tool_complete (flat)
                if (event.type === 'tool_complete' && event.toolId) {
                  conversationState.completeToolExecution(
                    messageId,
                    event.toolId,
                    event.result,
                    event.metadata,
                    event.timestamp
                  );
                  
                  const runningTools = conversationState.getToolExecutions(messageId).filter(t => t.status === 'running');
                  if (runningTools.length === 0) {
                    allToolsComplete = true;
                    setCurrentStatus({ action: 'processing', description: 'Generating response' });
                    if (!contentCanStart) {
                      contentCanStart = true;
                      if (displayQueue.length > 0 && !currentStreamingMessageRef.current) {
                        setStreamingMessage({ id: messageId, content: '' });
                        currentStreamingMessageRef.current = { id: messageId, content: '' };
                      }
                      if (displayQueue.length > 0 && !isDisplaying) {
                        displayNextChar();
                      }
                    }
                  }
                  return false;
                }
                
                // v2: tool_error (flat)
                if (event.type === 'tool_error' && event.toolId) {
                  const errorMessage = typeof event.error === 'string' ? event.error : JSON.stringify(event.error);
                  conversationState.failToolExecution(messageId, event.toolId, errorMessage, event.timestamp);
                  console.error(`[Stream] Tool failed: ${event.toolId} - ${errorMessage}`);
                  return false;
                }
                
                // v2: run_complete (replaces 'complete')
                if (event.type === 'run_complete') {
                  setIsStreaming(false);
                  if (!thinkingStreamingComplete && firstThinkingReceived) {
                    thinkingStreamingComplete = true;
                  }
                  const runningTools = conversationState.getToolExecutions(messageId).filter(t => t.status === 'running');
                  runningTools.forEach(tool => {
                    conversationState.updateToolExecution(messageId, tool.toolId, {
                      status: 'completed',
                      endTime: Date.now(),
                      result: 'Completed successfully'
                    });
                  });
                  return true; // Signal completion
                }
                
                // v2: run_error (replaces 'error')
                if (event.type === 'run_error') {
                  throw new Error(event.error || 'Run failed');
                }
                
                // v2: thinking_complete
                if (event.type === 'thinking_complete') {
                  thinkingStreamingComplete = true;
                  return false;
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
                          
                          // Create initial streaming message immediately so bubble appears
                          const initialStreamingMsg = { id: messageId, content: '' };
                          setStreamingMessage(initialStreamingMsg);
                          currentStreamingMessageRef.current = initialStreamingMsg;
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
                  return false;
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
                  return false;
                }

                if (event.type === 'complete') {
                  // Stop streaming animation but keep message visible until display queue finishes
                  setIsStreaming(false);
                  
                  // Ensure thinking streaming is marked complete if not already
                  if (!thinkingStreamingComplete && firstThinkingReceived) {
                    thinkingStreamingComplete = true;
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
                  
                  // Break out of SSE loop - we'll fetch MongoDB data after display finishes
                  return true; // Signal completion
                }

                if (event.type === 'error') {
                  throw new Error(event.error);
                }
                
                // Unknown event type, just ignore
                return false;
      }

      // Wait for both display queues to finish rendering all characters
      while (displayQueue.length > 0 || isDisplaying || thinkingQueue.length > 0 || isDisplayingThinking) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Capture the streaming message immediately to avoid closure/error issues
      const completedStreamingMessage = currentStreamingMessageRef.current;

      // Save the completed streaming message to permanent conversation state
      // USE convId parameter, not localConversationId from closure!
      if (completedStreamingMessage && convId) {
        // Check if message already exists (can happen during reconnect to completed generation)
        const existingMessage = localMessages.find(m => m.id === completedStreamingMessage.id);
        
        if (!existingMessage) {
          addLocalMessage({
            id: completedStreamingMessage.id,
            role: 'assistant',
            content: completedStreamingMessage.content,
            timestamp: new Date(),
            metadata: {
              conversationId: convId, // Use convId parameter, not localConversationId!
            }
          });
          
          // Wait a bit to ensure state has updated
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // Note: localMessages might not update here due to closure, but that's okay
        // The important thing is that conversationState has it

        // Tool executions are already saved by the backend in respond.ts when streaming completes
        // Backend collects tool executions from Redis state and passes to store_message
        // No need for frontend to make a separate POST - that caused race conditions
        
        // Save graph run state to the message for later retrieval
        // Graph run is now saved by the backend automatically during execution
        // No need to save from frontend
      } else {
        console.error('[Stream] Failed to add message - no completed message or convId');
      }

      // Mark any streaming thoughts as completed
      if (messageId) {
        completeThought(messageId);
      }

      // DON'T clear streamingMessage immediately - let it stay until we're sure the permanent message is rendered
      // This prevents the message from disappearing during the React render cycle
      // The streaming message will be cleaned up in finally{} when all streaming state is cleared
    } catch (error: unknown) {
      console.error('[Stream] Error:', error);
      setStreamingMessage(null);
      currentStreamingMessageRef.current = null;
      throw error;
    } finally {
      // Clear streaming message (if not already cleared by error)
      setStreamingMessage(null);
      currentStreamingMessageRef.current = null;
      
      generationStorage.clear();
      activeStreamRef.current = null;
      activeReaderRef.current = null; // Clear reader ref (legacy path)
      
      // Clean up EventSource if it's still open
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
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
        setErrorModal({ isOpen: true, message: 'Failed to create conversation' });
        return;
      }
    }

    const userMessageContent = input.trim();
    setInput('');
    setIsLoading(true);
    setCurrentStatus(null);
    // Start graph run immediately - shows "starting" state with entry node active
    startGraphRun(selectedGraphId || undefined);
    // Don't clear currentThinking here - it removes thinking from existing messages

    try {
      // Generate IDs upfront
      const userMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const streamUrl = `/api/v1/runs/${runId}/stream`;
      
      // Add user message to conversation state immediately
      addLocalMessage({
        id: userMessageId,
        role: 'user',
        content: userMessageContent,
        timestamp: new Date(),
        metadata: {
          conversationId: convId,
        }
      });

      setStreamingMessageId(messageId);
      setIsThinkingDisplayComplete(false); // Reset for new message
      
      // Initialize streaming refs
      streamingContentRef.current = '';
      streamingMessageIdRef.current = messageId;

      // Store generation info for reconnection (before we start)
      const generationData = {
        messageId,
        conversationId: convId,
        streamUrl,
        runId,
        startedAt: Date.now(),
        userMessage: userMessageContent,
      };
      generationStorage.set(generationData);

      // CRITICAL: Connect to SSE FIRST, then start run via API
      // This ensures we don't miss any events
      // The SSE endpoint will wait for the run to exist
      console.log(`[Chat] ${new Date().toISOString()} Starting SSE connection for runId=${runId}`);
      const ssePromise = streamMessage(convId, messageId, streamUrl);
      
      // Start run via v2 API (pass the runId we pre-generated)
      console.log(`[Chat] ${new Date().toISOString()} Starting POST to /api/v1/chat/completions`);
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          model: 'Red',
          messages: [{ role: 'user', content: userMessageContent }],
          stream: true,
          conversationId: convId,
          userMessageId,
          graphId: selectedGraphId,
          runId, // Pass pre-generated runId so backend uses it
        }),
      });
      console.log(`[Chat] ${new Date().toISOString()} POST completed with status ${response.status}`);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Failed to start generation: ${response.status} - ${errorBody}`);
      }

      // Wait for SSE stream to complete
      await ssePromise;
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
        setErrorModal({ isOpen: true, message: `Failed to send message: ${errorMessage}` });
      } else {
        console.warn('[Chat] Network error (not showing alert):', errorMessage);
      }
      setIsLoading(false);
      setSkeletonShrinking(false);
    }
  };

  return (
    <div className="flex bg-bg-primary overflow-hidden" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {!authLoading && !user ? (
        <LoginModal
          isOpen={true}
          onClose={() => {}}
          onSuccess={handleLoginSuccess}
          canDismiss={false}
        />
      ) : authLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-text-primary/60">Loading...</div>
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

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header
              title={localConversation?.title || 'Chat'}
              onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
              onNewChat={createNewConversation}
              onTitleClick={scrollToTop}
              extra={
                <div className="flex items-center gap-2">
                  <AgentSelector
                    agents={availableAgents}
                    selectedGraphId={selectedGraphId}
                    onSelectGraph={setSelectedGraphId}
                    onSetDefault={handleSetDefaultGraph}
                    disabled={isLoading || isStreaming}
                    loading={agentsLoading}
                  />
                  {currentGraphDefinition && (
                    <GraphViewButton
                      isRunning={graphIsRunning}
                      onClick={toggleGraphDrawer}
                      iconOnly={true}
                      size="sm"
                    />
                  )}
                </div>
              }
            />

            {conversationsLoading ? (
              <LoadingSpinner 
                mode="fullscreen" 
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
                  onViewGraph={handleViewHistoricalGraph}
                  pagination={pagination}
                  onLoadMore={loadMoreMessages}
                  scrollContainerRef={messagesScrollRef}
                  preventScrollRestorationRef={preventScrollRestorationRef}
                />

                <ChatInput
                  value={input}
                  disabled={isLoading || isStreaming}
                  isStreaming={isStreaming}
                  messagesEndRef={messagesEndRef}
                  onChange={setInput}
                  onSend={sendMessage}
                  onScrollToBottom={scrollToBottom}
                  onViewGraph={openGraphDrawer}
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

          <ErrorModal
            isOpen={errorModal.isOpen}
            onClose={() => setErrorModal({ isOpen: false, message: '' })}
            message={errorModal.message}
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

          {/* Graph Run Viewer Drawer */}
          <GraphRunDrawer
            isOpen={showGraphDrawer}
            onClose={closeGraphDrawer}
            graph={activeGraph || null}
            runState={graphRunState}
            onReset={resetGraphRunState}
          />
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
