'use client';

import { useEffect, useState, useRef } from 'react';
import { conversationStorage, type Conversation, type Message } from '@/lib/conversation';
import { generationStorage } from '@/lib/generation-storage';
import { ConfirmModal } from '@/components/Modal';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { ChatInput } from '@/components/ChatInput';
import { Messages } from '@/components/Messages';
import { LoginModal } from '@/components/LoginModal';
import { CompleteProfileModal } from '@/components/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';

export default function ChatPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [skeletonShrinking, setSkeletonShrinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [currentThinking, setCurrentThinking] = useState<Record<string, string>>({});
  const [currentStatus, setCurrentStatus] = useState<{action: string; description?: string} | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');
  const [reconnectAttempted, setReconnectAttempted] = useState(false);
  const activeStreamRef = useRef<string | null>(null); // Track active stream by messageId
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Show login modal if not authenticated (after auth loading completes)
  // Show profile modal if authenticated but profile incomplete
  // User cannot dismiss these - they must complete the flow
  useEffect(() => {
    if (!authLoading && !user) {
      setShowLoginModal(true);
      setShowProfileModal(false);
    } else if (user) {
      setShowLoginModal(false);
      // Check if profile is complete
      if (!user.profileComplete) {
        setShowProfileModal(true);
      } else {
        setShowProfileModal(false);
      }
    }
  }, [authLoading, user]);

  const handleLoginSuccess = async (isNewUser: boolean, profileComplete: boolean) => {
    // Refresh user data from the server
    await refreshUser();
    
    setShowLoginModal(false);
    if (isNewUser && !profileComplete) {
      setShowProfileModal(true);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileModal(false);
  };

  // Only load conversations and chat state if user is authenticated AND profile is complete
  // This prevents loading chat data before authentication and profile completion
  useEffect(() => {
    if (!user || !user.profileComplete) return; // Don't load anything if not authenticated or profile incomplete
    
    const stored = conversationStorage.getAll();
    setConversations(stored);
    
    const activeId = conversationStorage.getActiveId();
    if (activeId && stored.some(c => c.id === activeId)) {
      setActiveConversationId(activeId);
    } else if (stored.length > 0) {
      setActiveConversationId(stored[0].id);
      conversationStorage.setActiveId(stored[0].id);
    }
    
    // Check for active generation and reconnect
    const activeGeneration = generationStorage.get();
    if (activeGeneration && !reconnectAttempted) {
      console.log('[Reconnect] Found active generation, reconnecting:', activeGeneration.messageId);
      setReconnectAttempted(true); // Prevent multiple reconnection attempts
      setIsReconnecting(true); // Mark as reconnecting for UI
      
      // Switch to the conversation
      if (activeGeneration.conversationId !== activeId) {
        setActiveConversationId(activeGeneration.conversationId);
        conversationStorage.setActiveId(activeGeneration.conversationId);
      }
      
      // Set loading state
      setIsLoading(true);
      setStreamingMessageId(activeGeneration.messageId);
      
      // Reconnect to dedicated reconnect endpoint (doesn't need full URL anymore)
      const reconnectUrl = `/api/v1/messages/${activeGeneration.messageId}/reconnect`;
      streamMessage(
        activeGeneration.conversationId,
        activeGeneration.messageId,
        reconnectUrl
      ).catch(error => {
        console.error('[Reconnect] Failed to reconnect:', error);
        generationStorage.clear();
        setIsLoading(false);
        setStreamingMessageId(null);
        setReconnectAttempted(false); // Allow retry on error
        setIsReconnecting(false);
      });
    }
  }, [user]); // Only run when user changes

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  const createNewConversation = () => {
    const newConv = conversationStorage.create();
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConv.id);
    conversationStorage.setActiveId(newConv.id);
    setIsSidebarOpen(false);
  };

  const switchConversation = (id: string) => {
    setActiveConversationId(id);
    conversationStorage.setActiveId(id);
    setIsSidebarOpen(false);
    // Clear state when switching conversations
    setCurrentThinking({});
    setCurrentStatus(null);
  };

  const handleDeleteClick = (id: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent switching to the conversation
    setConversationToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!conversationToDelete) return;

    // Delete the conversation
    conversationStorage.delete(conversationToDelete);
    const updatedConversations = conversationStorage.getAll();
    setConversations(updatedConversations);

    // If we deleted the active conversation, switch to another one
    if (conversationToDelete === activeConversationId) {
      if (updatedConversations.length > 0) {
        setActiveConversationId(updatedConversations[0].id);
        conversationStorage.setActiveId(updatedConversations[0].id);
      } else {
        setActiveConversationId(null);
      }
    }

    setConversationToDelete(null);
  };

  // Fetch conversation title from Redis (generated by Red AI)
  const fetchConversationTitle = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/v1/conversations/${conversationId}/title`);
      if (response.ok) {
        const data = await response.json();
        if (data.title) {
          const conv = conversationStorage.get(conversationId);
          if (conv && !conv.titleSetByUser) {
            // Only update if user hasn't set a custom title
            conv.title = data.title;
            conversationStorage.save(conv);
            setConversations(conversationStorage.getAll());
          }
        }
      }
    } catch (error) {
      console.error('Error fetching conversation title:', error);
    }
  };

  // Update conversation title (user override)
  const updateConversationTitle = async (conversationId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/v1/conversations/${conversationId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      
      if (response.ok) {
        const conv = conversationStorage.get(conversationId);
        if (conv) {
          conv.title = newTitle;
          conv.titleSetByUser = true;
          conversationStorage.save(conv);
          setConversations(conversationStorage.getAll());
        }
      }
    } catch (error) {
      console.error('Error updating conversation title:', error);
    }
  };

  const startEditingTitle = (conv: Conversation, event: React.MouseEvent) => {
    event.stopPropagation();
    setEditingTitleId(conv.id);
    setEditingTitleValue(conv.title);
  };

  const saveEditedTitle = async (conversationId: string) => {
    if (editingTitleValue.trim()) {
      await updateConversationTitle(conversationId, editingTitleValue.trim());
    }
    setEditingTitleId(null);
    setEditingTitleValue('');
  };

  const cancelEditingTitle = () => {
    setEditingTitleId(null);
    setEditingTitleValue('');
  };

  // Separate function to connect to message stream (can be called for reconnection)
  // Separate function to connect to message stream (can be called for reconnection)
  const streamMessage = async (convId: string, messageId: string, responseOrUrl: Response | string) => {
    console.log('[Stream] Called with messageId:', messageId, 'current activeStreamRef:', activeStreamRef.current, 'type:', typeof responseOrUrl);
    
    // Prevent duplicate streaming for same messageId
    if (activeStreamRef.current === messageId) {
      console.log('[Stream] Already streaming messageId:', messageId, '- skipping duplicate');
      return;
    }
    
    // Check if we're streaming a different message - that's ok, update to new one
    if (activeStreamRef.current && activeStreamRef.current !== messageId) {
      console.log('[Stream] Switching from', activeStreamRef.current, 'to', messageId);
    }
    
    console.log('[Stream] Starting stream for messageId:', messageId);
    activeStreamRef.current = messageId;
    
    const assistantMessage: Message = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    };

    let messageAdded = false;
    let canStartDisplaying = false;
    let firstCharReceived = false;
    let streamingStarted = false;
    let receivedThinkingChunks = false;
    const displayQueue: string[] = [];
    let isDisplaying = false;
    let displayedContent = '';

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

    const displayNextChar = async () => {
      if (isDisplaying) return;
      if (!canStartDisplaying) {
        setTimeout(() => displayNextChar(), 50);
        return;
      }
      isDisplaying = true;

      while (displayQueue.length > 0) {
        const char = displayQueue.shift();
        if (char) {
          displayedContent += char;
          assistantMessage.content = displayedContent;

          if (!messageAdded && displayedContent.trim()) {
            const conv = conversationStorage.get(convId);
            if (conv) {
              conv.messages.push(assistantMessage);
              conversationStorage.save(conv);
              setConversations(conversationStorage.getAll());
              messageAdded = true;
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }
          } else if (messageAdded) {
            const conv = conversationStorage.get(convId);
            if (conv) {
              const msgIndex = conv.messages.findIndex(m => m.id === messageId);
              if (msgIndex >= 0) {
                conv.messages[msgIndex] = { ...assistantMessage };
                conv.updatedAt = Date.now();
                conversationStorage.save(conv);
                setConversations(conversationStorage.getAll());
              }
            }
          }

          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }

      isDisplaying = false;
    };

    try {
      let retryCount = 0;
      const maxRetries = 3;
      let lastError: Error | null = null;
      
      // Get the response - either use provided or fetch for reconnection
      let eventSource: Response;
      
      if (typeof responseOrUrl === 'string') {
        // Reconnection case - simple GET request to reconnect endpoint
        console.log(`[Stream] Reconnecting to ${responseOrUrl}`);
        eventSource = await fetch(responseOrUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Initial connection - use provided response
        eventSource = responseOrUrl;
      }
      
      // Retry loop for stream connection
      while (retryCount <= maxRetries) {
        try {
          if (!eventSource.ok) {
            const errorText = await eventSource.text();
            console.error('[Stream] Error response:', errorText);
            
            // If 404, generation might not have started yet - retry with backoff
            if (eventSource.status === 404 && retryCount < maxRetries) {
              const delay = Math.min(1000 * Math.pow(2, retryCount), 4000); // 500ms, 1s, 2s
              console.log(`[Stream] Stream not ready (404), retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, delay));
              retryCount++;
              continue;
            }
            
            // If it's a 504 timeout, show a more helpful message
            if (eventSource.status === 504) {
              throw new Error('Request is taking longer than expected. The AI is still processing - please wait or try a simpler question.');
            }
            
            throw new Error(`Failed to connect to stream: ${eventSource.status} ${errorText.substring(0, 200)}`);
          }

          // Successfully connected, break retry loop
          const reader = eventSource.body?.getReader();
          const decoder = new TextDecoder();

          console.log('[Stream] Got reader:', !!reader, 'eventSource.ok:', eventSource.ok);

          if (reader) {
            console.log('[Stream] Starting to read from stream...');
        while (true) {
          const { done, value } = await reader.read();
          console.log('[Stream] Read chunk - done:', done, 'value length:', value?.length);
          if (done) break;

          const chunk = decoder.decode(value);
          console.log('[Stream] Decoded chunk:', chunk.substring(0, 200)); // First 200 chars
          const lines = chunk.split('\n');
          console.log('[Stream] Split into', lines.length, 'lines');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              console.log('[Stream] Found SSE line, data:', data.substring(0, 100));
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);
                
                console.log('[Stream Event]', event.type, event);
                
                // Handle init event
                if (event.type === 'init') {
                  console.log('[INIT] Received messageId:', event.messageId);
                  
                  // Check for existing content (reconnection case)
                  if (event.existingContent) {
                    console.log('[INIT] Found existing content:', event.existingContent.length, 'chars');
                    // Display existing content immediately
                    firstCharReceived = true;
                    startSkeletonShrink();
                    
                    const characters = event.existingContent.split('');
                    displayQueue.push(...characters);
                    
                    if (!isDisplaying) {
                      displayNextChar();
                    }
                  }
                  
                  continue;
                }
                
                // Handle different event types
                if (event.type === 'status') {
                  console.log('[STATUS UPDATE] Received status event:', event);
                  setCurrentStatus({ action: event.action, description: event.description });
                  continue;
                }
                
                if (event.type === 'tool_status') {
                  console.log('[STATUS UPDATE] Received tool_status event:', event);
                  // Convert tool action to status for consistent UI display
                  setCurrentStatus({ action: event.action, description: event.status });
                  continue;
                }
                
                if (event.type === 'thinking_chunk' && event.content) {
                  if (!receivedThinkingChunks) {
                    receivedThinkingChunks = true;
                  }
                  setCurrentThinking(prev => ({
                    ...prev,
                    [messageId]: (prev[messageId] || '') + event.content
                  }));
                  
                  // DON'T call startSkeletonShrink here - keep loading state visible during thinking
                  // It will shrink when content starts arriving
                  continue;
                }
                
                if (event.type === 'content' && event.content) {
                  if (!firstCharReceived) {
                    firstCharReceived = true;
                    startSkeletonShrink();
                  }
                  
                  const characters = event.content.split('');
                  displayQueue.push(...characters);
                  
                  if (!isDisplaying) {
                    displayNextChar();
                  }
                  continue;
                }
                
                if (event.type === 'thinking' && event.content) {
                  // Legacy: Store full thinking block
                  setCurrentThinking(prev => ({
                    ...prev,
                    [messageId]: (prev[messageId] || '') + event.content
                  }));
                  
                  // Ensure streaming state is set when thinking arrives
                  if (!streamingStarted) {
                    startSkeletonShrink();
                  }
                  continue;
                }
                
                if (event.type === 'complete') {
                  // Generation complete
                  break; // Exit the stream reader loop
                }
                
                if (event.type === 'error') {
                  throw new Error(event.error);
                }
              } catch (e) {
                if (e instanceof SyntaxError) continue; // Ignore JSON parse errors
                throw e;
              }
            }
          }
        }

        // Wait for display queue to finish
        while (displayQueue.length > 0 || isDisplaying) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        if (displayedContent.trim() && !messageAdded) {
          const conv = conversationStorage.get(convId);
          if (conv) {
            conv.messages.push(assistantMessage);
            conversationStorage.save(conv);
          }
        }
        
        // Successfully completed stream - break retry loop
        break;
      } // Close if (reader) block
        } catch (streamError) {
          lastError = streamError as Error;
          
          // If we've exhausted retries, throw the error
          if (retryCount >= maxRetries) {
            throw lastError;
          }
          
          // Otherwise, retry with backoff
          const delay = Math.min(500 * Math.pow(2, retryCount), 4000);
          console.log(`[Stream] Connection failed, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        }
      } // Close while retry loop
    } catch (error: any) {
      throw error;
    } finally {
      // Clear generation storage on completion or error
      generationStorage.clear();
      activeStreamRef.current = null; // Clear active stream ref
      
      setIsLoading(false);
      setSkeletonShrinking(false);
      setIsStreaming(false);
      setStreamingMessageId(null);
      setCurrentStatus(null);
      setIsReconnecting(false); // Clear reconnecting flag
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    let convId = activeConversationId;
    
    // Create new conversation if none exists
    if (!convId) {
      const newConv = conversationStorage.create();
      setConversations(prev => [newConv, ...prev]);
      convId = newConv.id;
      setActiveConversationId(convId);
      conversationStorage.setActiveId(convId);
    }

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    // Add user message
    conversationStorage.addMessage(convId, userMessage);
    setConversations(conversationStorage.getAll());
    setInput('');
    setIsLoading(true);
    
    // Clear status and thinking - backend router will send the first status update immediately
    setCurrentStatus(null);
    setCurrentThinking({});

    // Generate messageId client-side  
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Set streaming message ID immediately so LoadingStateContainer can render
    setStreamingMessageId(messageId);

    try {
      // Single call that streams everything
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'Red',
          messages: [{ role: 'user', content: userMessage.content }],
          stream: true,
          conversationId: convId,
          messageId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start generation: ${response.status}`);
      }

      // Store generation info for reconnection
      generationStorage.set({
        messageId,
        conversationId: convId,
        streamUrl: `/api/v1/chat/completions`, // For reconnect
        startedAt: Date.now()
      });

      console.log('[SendMessage] About to call streamMessage with messageId:', messageId, 'activeStreamRef:', activeStreamRef.current);
      
      // Stream the response
      await streamMessage(convId, messageId, response);

      console.log('[SendMessage] streamMessage completed for:', messageId);

      // Fetch title after message completes
      const conv = conversationStorage.get(convId);
      const messageCount = conv?.messages.length || 0;
      if (messageCount === 2 || messageCount === 6) {
        setTimeout(() => fetchConversationTitle(convId), 1500);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error
      });
      alert(`Failed to send message: ${error instanceof Error ? error.message : String(error)}`);
      setIsLoading(false);
      setSkeletonShrinking(false);
    }
  };

  return (
    <div className="flex bg-[#0a0a0a]" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Show login modal if not authenticated - blocks everything else */}
      {!authLoading && !user ? (
        <>
          {/* Login Modal - permanent until authenticated */}
          <LoginModal
            isOpen={true}
            onClose={() => {}} // Cannot close without authenticating
            onSuccess={handleLoginSuccess}
            canDismiss={false} // Hide close button
          />
        </>
      ) : authLoading ? (
        // Show loading state while checking authentication
        <div className="flex-1 flex items-center justify-center">
          <div className="text-white/60">Loading...</div>
        </div>
      ) : user && !user.profileComplete ? (
        // User is authenticated but profile is incomplete - show profile modal
        <>
          <CompleteProfileModal
            isOpen={true}
            onClose={() => {}} // Cannot close without completing profile
            onSuccess={handleProfileComplete}
            canDismiss={false} // Hide close button
          />
        </>
      ) : (
        // User is authenticated and profile is complete - show chat interface
        <>
          {/* Sidebar */}
          <Sidebar
            isOpen={isSidebarOpen}
            conversations={conversations}
            activeConversationId={activeConversationId}
            editingTitleId={editingTitleId}
            editingTitleValue={editingTitleValue}
            onClose={() => setIsSidebarOpen(false)}
            onNewChat={createNewConversation}
            onSwitchConversation={switchConversation}
            onDeleteClick={handleDeleteClick}
            onStartEditingTitle={startEditingTitle}
            onSaveEditedTitle={saveEditedTitle}
            onCancelEditingTitle={cancelEditingTitle}
            onEditingTitleChange={setEditingTitleValue}
          />

          {/* Main content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <Header
              title={activeConversation?.title || 'Chat'}
              onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
              onNewChat={createNewConversation}
            />

            {/* Messages */}
            <Messages
              messages={activeConversation?.messages}
              thinking={currentThinking}
              currentStatus={currentStatus}
              isLoading={isLoading}
              isStreaming={isStreaming}
              streamingMessageId={streamingMessageId}
              skeletonShrinking={skeletonShrinking}
              isReconnecting={isReconnecting}
              messagesEndRef={messagesEndRef}
              conversationId={activeConversation?.id}
            />

            {/* Input */}
            <ChatInput
              value={input}
              disabled={isLoading}
              messagesEndRef={messagesEndRef}
              onChange={setInput}
              onSend={sendMessage}
            />
          </div>

          {/* Delete Confirmation Modal */}
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
