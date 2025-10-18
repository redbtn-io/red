'use client';

import { useEffect, useState, useRef } from 'react';
import { generationStorage } from '@/lib/storage/generation-storage';
import { lastConversationStorage } from '@/lib/storage/last-conversation-storage';
import { useConversationState } from '@/lib/conversation/use-conversation-state';
import { conversationState } from '@/lib/conversation/conversation-state';
import { ConfirmModal } from '@/components/ui/Modal';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatInput } from '@/components/chat/ChatInput';
import { Messages } from '@/components/chat/Messages';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations } from '@/contexts/ConversationContext';

export default function ChatPage() {
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
    loadConversation,
    clearConversation,
    addMessage: addLocalMessage,
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
  const [currentStatus, setCurrentStatus] = useState<{action: string; description?: string} | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef<string>(''); // Track streaming content immediately
  const streamingMessageIdRef = useRef<string | null>(null); // Track which message is streaming
  const currentStreamingMessageRef = useRef<{ id: string; content: string } | null>(null); // Track current streaming message

  // Helper function to save tool executions to database
  const saveToolExecutionsToDatabase = async (messageId: string, conversationId: string | null) => {
    if (!conversationId) return;
    
    const toolExecutions = conversationState.getToolExecutions(messageId);
    if (toolExecutions.length === 0) return;
    
    console.log(`[Stream] Saving ${toolExecutions.length} tool executions for message ${messageId}`);
    
    try {
      const response = await fetch(`/api/v1/conversations/${conversationId}/messages/${messageId}/tool-executions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ toolExecutions }),
      });
      
      if (response.ok) {
        console.log(`[Stream] Successfully saved tool executions to database`);
      } else {
        console.warn(`[Stream] Failed to save tool executions:`, response.status);
      }
    } catch (error) {
      console.warn(`[Stream] Error saving tool executions:`, error);
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
    if (!user || !user.profileComplete || reconnectAttempted || !currentConversation || !currentConversation.id) {
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
  }, [user, currentConversation, reconnectAttempted]);

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
      
      // If already streaming, don't interrupt
      if (isStreaming || streamingMessageId) {
        console.log('[Visibility] Already streaming, skipping check');
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
          return;
        }
        
        // Found an active generation - reconnect to it
        const { messageId, conversationId } = data;
        console.log('[Visibility] Found active generation, reconnecting to message:', messageId);
        
        setIsReconnecting(true);
        setIsLoading(true);
        setStreamingMessageId(messageId);

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  // Load last conversation on mount
  useEffect(() => {
    if (!user || !user.profileComplete || conversationsLoading) return;
    if (conversationLoaded && localConversationId) return; // Already have a conversation loaded
    if (conversations.length === 0) return; // No conversations yet

    const lastConvId = lastConversationStorage.get();
    if (lastConvId && lastConvId !== 'undefined') {
      // Check if the last conversation still exists
      const exists = conversations.some(c => c.id === lastConvId);
      if (exists) {
        fetchConversation(lastConvId).then(conv => {
          // Load conversation into our state manager
          if (conv) {
            loadConversation({
              id: conv.id,
              title: conv.title,
              messages: conv.messages || [],
              thoughts: conv.thoughts || {}
            });
          }
        }).catch(err => {
          console.error('[Init] Failed to load last conversation:', err);
          // If fails, just use the first conversation
          if (conversations.length > 0 && conversations[0].id) {
            fetchConversation(conversations[0].id).then((conv) => {
              lastConversationStorage.set(conversations[0].id);
              if (conv) {
                loadConversation({
                  id: conv.id,
                  title: conv.title,
                  messages: conv.messages || [],
                  thoughts: conv.thoughts || {}
                });
              }
            }).catch(console.error);
          }
        });
      } else {
        // Last conversation doesn't exist anymore, load first available
        if (conversations.length > 0 && conversations[0].id) {
          fetchConversation(conversations[0].id).then((conv) => {
            lastConversationStorage.set(conversations[0].id);
            if (conv) {
              loadConversation({
                id: conv.id,
                title: conv.title,
                messages: conv.messages || [],
                thoughts: conv.thoughts || {}
              });
            }
          }).catch(console.error);
        }
      }
    } else if (conversations.length > 0 && conversations[0].id) {
      // No last conversation stored, load first available
      fetchConversation(conversations[0].id).then((conv) => {
        lastConversationStorage.set(conversations[0].id);
        if (conv) {
          loadConversation({
            id: conv.id,
            title: conv.title,
            messages: conv.messages || [],
            thoughts: conv.thoughts || {}
          });
        }
      }).catch(console.error);
    }
  }, [user, conversations, conversationLoaded, localConversationId, conversationsLoading, fetchConversation, loadConversation]);

  const createNewConversation = async () => {
    try {
      const newConv = await createConversation('New Conversation');
      setCurrentConversation(newConv);
      lastConversationStorage.set(newConv.id); // Save as last conversation
      setIsSidebarOpen(false);
      
      // Load the new conversation into local state
      loadConversation({
        id: newConv.id,
        title: newConv.title,
        messages: [],
        thoughts: {}
      });
    } catch (error) {
      console.error('[Chat] Failed to create conversation:', error);
      alert('Failed to create conversation');
    }
  };

  const switchConversation = async (id: string) => {
    if (!id || id === 'undefined') {
      console.error('[Chat] Invalid conversation ID:', id);
      return;
    }
    
    try {
      const conversation = await fetchConversation(id);
      lastConversationStorage.set(id); // Save as last conversation
      setIsSidebarOpen(false);
      
      // Load conversation into our state manager
      if (conversation) {
        loadConversation({
          id: conversation.id,
          title: conversation.title,
          messages: conversation.messages || [],
          thoughts: conversation.thoughts || {}
        });
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
      await deleteConversation(conversationToDelete);

      // If we deleted the active conversation, clear it
      if (conversationToDelete === currentConversation?.id) {
        setCurrentConversation(null);
        // Switch to first available conversation
        if (conversations.length > 0) {
          const firstConv = conversations.find(c => c.id !== conversationToDelete);
          if (firstConv) {
            await fetchConversation(firstConv.id);
          }
        }
      }

      setConversationToDelete(null);
      setDeleteModalOpen(false);
    } catch (error) {
      console.error('[Chat] Failed to delete conversation:', error);
      alert('Failed to delete conversation');
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
      
      // When thinking animation completes AND server thinking is done, start content after delay
      if (!thinkingCompleted && displayedThinking.length > 0 && thinkingStreamingComplete && thinkingQueue.length === 0) {
        thinkingCompleted = true;
        setIsThinkingDisplayComplete(true); // Mark thinking display as complete
        console.log('[Stream] Thinking fully completed (server done + display done), starting content after brief delay');
        
        // Wait for thinking bubble shrink animation to complete (400ms)
        setTimeout(() => {
          contentCanStart = true;
          console.log('[Stream] Content can now start after thinking bubble shrink completed');
          
          // Create initial streaming message immediately so bubble appears
          const initialStreamingMsg = { id: messageId, content: '' };
          setStreamingMessage(initialStreamingMsg);
          currentStreamingMessageRef.current = initialStreamingMsg;
          
          // Trigger content display if there's queued content
          if (displayQueue.length > 0 && !isDisplaying) {
            displayNextChar();
          }
        }, 400); // Wait for full shrink animation duration
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
                  setCurrentStatus({ action: event.action, description: event.description });
                  continue;
                }

                if (event.type === 'tool_status') {
                  setCurrentStatus({ action: event.action, description: event.status });
                  continue;
                }

                // NEW: Handle unified tool events
                if (event.type === 'tool_event' && event.event) {
                  const toolEvent = event.event;
                  console.log('[Stream] Received tool_event:', toolEvent.type, toolEvent.toolName || toolEvent.toolId);
                  
                  if (toolEvent.type === 'tool_start') {
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
                    
                    // Immediately save tool execution when it starts
                    saveToolExecutionsToDatabase(messageId, localConversationId || null);
                  } else if (toolEvent.type === 'tool_progress') {
                    // Add progress step
                    conversationState.addToolStep(messageId, toolEvent.toolId, {
                      step: toolEvent.step,
                      timestamp: toolEvent.timestamp,
                      progress: toolEvent.progress,
                      data: toolEvent.data,
                    });
                    
                    // Handle streaming content (not for thinking - that has its own state)
                    if (toolEvent.streamingContent && toolEvent.toolType !== 'thinking') {
                      // Update tool execution streaming content
                      conversationState.updateToolStreamingContent(
                        messageId,
                        toolEvent.toolId,
                        toolEvent.streamingContent
                      );
                    }
                    
                    // Save progress step immediately
                    saveToolExecutionsToDatabase(messageId, localConversationId || null);
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
                    
                    // Save completion immediately
                    saveToolExecutionsToDatabase(messageId, localConversationId || null);
                  } else if (toolEvent.type === 'tool_error') {
                    // Mark tool as failed
                    conversationState.failToolExecution(
                      messageId,
                      toolEvent.toolId,
                      toolEvent.error,
                      toolEvent.timestamp
                    );
                    console.error(`[Stream] Tool failed: ${toolEvent.toolName} - ${toolEvent.error}`);
                    
                    // Save error state immediately
                    saveToolExecutionsToDatabase(messageId, localConversationId || null);
                  }
                  continue;
                }

                if (event.type === 'chunk' && event.content) {
                  // Check if this is a thinking chunk or content chunk
                  if (event.thinking) {
                    // Handle thinking chunks - only queue for character-by-character animation
                    console.log('[Stream] Received thinking chunk, length:', event.content.length, 'content:', event.content.substring(0, 50));
                    
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
                    console.log('[Stream] Received content chunk, length:', event.content.length);
                    if (!firstCharReceived) {
                      firstCharReceived = true;
                      startSkeletonShrink();
                      
                      // If no thinking was received, allow content to start immediately
                      if (!firstThinkingReceived) {
                        contentCanStart = true;
                        
                        // Create initial streaming message immediately so bubble appears
                        const initialStreamingMsg = { id: messageId, content: '' };
                        setStreamingMessage(initialStreamingMsg);
                        currentStreamingMessageRef.current = initialStreamingMsg;
                      }
                    }
                    
                    // Always queue content chunks, but don't display until thinking is complete
                    console.log('[Stream] Queueing content chunk for later display');
                    displayQueue.push(...event.content.split(''));
                    
                    // Only start displaying if content can start (thinking is complete)
                    if (contentCanStart && !isDisplaying) {
                      displayNextChar();
                    }
                  }
                  continue;
                }

                if (event.type === 'thinking' && event.content) {
                  console.log('[Stream] Received thinking (full block), length:', event.content.length);
                  // This is the final complete thinking (sent after chunks)
                  thinkingStreamingComplete = true;
                  console.log('[Stream] Thinking streaming from server is now complete');
                  
                  // Don't accumulate - just replace with the complete version
                  // to avoid duplication if we already received thinking chunks
                  if (displayedThinking.length === 0) {
                    // Only use this if we didn't get chunks (non-streaming path)
                    displayedThinking = event.content;
                    setThought(messageId, displayedThinking, false); // Not streaming
                  } else {
                    console.log('[Stream] Ignoring thinking event, already have chunks');
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

        // Save the completed streaming message to permanent conversation state
        if (completedStreamingMessage && localConversationId) {
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
              conversationId: localConversationId,
            }
          });
          
          console.log(`[Stream] addLocalMessage called, waiting for state update...`);
          
          // Wait a bit to ensure state has updated
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log(`[Stream] After state update wait - messageCount should be:`, localMessages.length + 1);

          // Save tool execution data to database (if any exist for this message)
          const toolExecutions = conversationState.getToolExecutions(completedStreamingMessage.id);
          if (toolExecutions.length > 0) {
            console.log(`[Stream] Saving ${toolExecutions.length} tool executions for message ${completedStreamingMessage.id}`);
            
            try {
              const response = await fetch(`/api/v1/conversations/${localConversationId}/messages/${completedStreamingMessage.id}/tool-executions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ toolExecutions }),
              });
              
              if (response.ok) {
                console.log(`[Stream] Successfully saved tool executions to database`);
              } else {
                console.warn(`[Stream] Failed to save tool executions:`, response.status);
              }
            } catch (error) {
              console.warn(`[Stream] Error saving tool executions:`, error);
            }
          } else {
            console.log(`[Stream] No tool executions to save for message ${completedStreamingMessage.id}`);
          }
        }

        // Mark any streaming thoughts as completed
        if (messageId) {
          completeThought(messageId);
        }

        console.log(`[Stream] Streaming completed for message ${messageId}.`);
        
        console.log(`[Stream] About to clear streaming message. Current state:`, {
          capturedMessageId: completedStreamingMessage?.id,
          capturedMessageContent: completedStreamingMessage?.content?.length || 0,
          currentStreamingMessageId: streamingMessage?.id,
          currentStreamingMessageContent: streamingMessage?.content?.length || 0,
          localMessagesCount: localMessages.length,
          hasStreamingMessage: !!streamingMessage
        });
        
        // Clear streaming state
        console.log(`[Stream] Clearing streaming message in completion`);
        setStreamingMessage(null);
        currentStreamingMessageRef.current = null;
        
        console.log(`[Stream] Streaming message cleared`);
      }
    } catch (error: unknown) {
      console.error('[Stream] Error:', error);
      console.log(`[Stream] Clearing streaming message due to error`);
      setStreamingMessage(null);
      currentStreamingMessageRef.current = null;
      throw error;
    } finally {
      console.log('[Stream] Cleaning up - clearing generation storage');
      generationStorage.clear();
      activeStreamRef.current = null;
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
        // Load the new conversation into local state
        loadConversation({
          id: newConv.id,
          title: newConv.title,
          messages: [],
          thoughts: {}
        });
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
      const userMessageId = `msg_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
            />

            {conversationsLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-white/60">Loading conversations...</div>
              </div>
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
                />

                <ChatInput
                  value={input}
                  disabled={isLoading}
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
        </>
      )}
    </div>
  );
}
