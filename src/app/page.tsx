'use client';

import { useEffect, useState, useRef } from 'react';
import { generationStorage } from '@/lib/storage/generation-storage';
import { lastConversationStorage } from '@/lib/storage/last-conversation-storage';
import { ConfirmModal } from '@/components/ui/Modal';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatInput } from '@/components/chat/ChatInput';
import { Messages } from '@/components/chat/Messages';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { useConversations, type Message } from '@/contexts/ConversationContext';

export default function ChatPage() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const {
    conversations,
    currentConversation,
    loading: conversationsLoading,
    error: conversationsError,
    fetchConversation,
    createConversation,
    deleteConversation,
    updateConversation,
    addMessage,
    setCurrentConversation,
  } = useConversations();

  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
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
  const [streamingMessage, setStreamingMessage] = useState<{ id: string; content: string } | null>(null);
  const [pendingUserMessage, setPendingUserMessage] = useState<{ role: string; content: string; timestamp: Date } | null>(null);
  const activeStreamRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Show login modal if not authenticated (after auth loading completes)
  useEffect(() => {
    if (!authLoading && !user) {
      setShowLoginModal(true);
      setShowProfileModal(false);
    } else if (user) {
      setShowLoginModal(false);
      if (!user.profileComplete) {
        setShowProfileModal(true);
      } else {
        setShowProfileModal(false);
      }
    }
  }, [authLoading, user]);

  const handleLoginSuccess = async (isNewUser: boolean, profileComplete: boolean) => {
    await refreshUser();
    setShowLoginModal(false);
    if (isNewUser && !profileComplete) {
      setShowProfileModal(true);
    }
  };

  const handleProfileComplete = () => {
    setShowProfileModal(false);
  };

  // Check for active generation and reconnect
  useEffect(() => {
    if (!user || !user.profileComplete || reconnectAttempted || !currentConversation) {
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
        console.log('[Reconnect] Active generation check result:', data);
        
        if (!data.active) {
          console.log('[Reconnect] No active generation found');
          return;
        }
        
        // Found an active generation - reconnect to it
        const { messageId, conversationId } = data;
        console.log('[Reconnect] Found active generation:', { messageId, conversationId });
        
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
  }, [user, currentConversation, reconnectAttempted]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  // Load last conversation on mount
  useEffect(() => {
    if (!user || !user.profileComplete || conversationsLoading) return;
    if (currentConversation) return; // Already have a conversation loaded
    if (conversations.length === 0) return; // No conversations yet

    const lastConvId = lastConversationStorage.get();
    if (lastConvId) {
      // Check if the last conversation still exists
      const exists = conversations.some(c => c.id === lastConvId);
      if (exists) {
        console.log('[Init] Loading last conversation:', lastConvId);
        fetchConversation(lastConvId).catch(err => {
          console.error('[Init] Failed to load last conversation:', err);
          // If fails, just use the first conversation
          if (conversations.length > 0) {
            fetchConversation(conversations[0].id).then(() => {
              lastConversationStorage.set(conversations[0].id);
            }).catch(console.error);
          }
        });
      } else {
        // Last conversation doesn't exist anymore, load first available
        if (conversations.length > 0) {
          fetchConversation(conversations[0].id).then(() => {
            lastConversationStorage.set(conversations[0].id);
          }).catch(console.error);
        }
      }
    } else if (conversations.length > 0) {
      // No last conversation stored, load first available
      fetchConversation(conversations[0].id).then(() => {
        lastConversationStorage.set(conversations[0].id);
      }).catch(console.error);
    }
  }, [user, conversations, currentConversation, conversationsLoading, fetchConversation]);

  const createNewConversation = async () => {
    try {
      const newConv = await createConversation('New Conversation');
      setCurrentConversation(newConv);
      lastConversationStorage.set(newConv.id); // Save as last conversation
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('[Chat] Failed to create conversation:', error);
      alert('Failed to create conversation');
    }
  };

  const switchConversation = async (id: string) => {
    try {
      await fetchConversation(id);
      lastConversationStorage.set(id); // Save as last conversation
      setIsSidebarOpen(false);
      setCurrentThinking({});
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
    console.log('[Stream] Starting for messageId:', messageId);

    if (activeStreamRef.current === messageId) {
      console.log('[Stream] Already streaming:', messageId);
      return;
    }

    activeStreamRef.current = messageId;

    let canStartDisplaying = false;
    let firstCharReceived = false;
    let streamingStarted = false;
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
          
          // Update streaming message state for live display
          setStreamingMessage({ id: messageId, content: displayedContent });
          
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
                  console.log('[Stream] Init event received, existing content:', event.existingContent?.length || 0, 'chars');
                  if (event.existingContent) {
                    firstCharReceived = true;
                    startSkeletonShrink();
                    // Set the streaming message immediately with existing content
                    displayedContent = event.existingContent;
                    setStreamingMessage({ id: messageId, content: displayedContent });
                    // Also add to queue for smooth char-by-char display
                    displayQueue.push(...event.existingContent.split(''));
                    if (!isDisplaying) displayNextChar();
                  }
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

                if (event.type === 'thinking_chunk' && event.content) {
                  setCurrentThinking(prev => ({
                    ...prev,
                    [messageId]: (prev[messageId] || '') + event.content
                  }));
                  continue;
                }

                if (event.type === 'content' && event.content) {
                  if (!firstCharReceived) {
                    firstCharReceived = true;
                    startSkeletonShrink();
                  }
                  displayQueue.push(...event.content.split(''));
                  if (!isDisplaying) displayNextChar();
                  continue;
                }

                if (event.type === 'thinking' && event.content) {
                  setCurrentThinking(prev => ({
                    ...prev,
                    [messageId]: event.content
                  }));
                  if (!streamingStarted) startSkeletonShrink();
                  continue;
                }

                if (event.type === 'complete') {
                  // Clear streaming and pending states
                  setStreamingMessage(null);
                  setPendingUserMessage(null);
                  
                  // Refetch conversation to get the saved messages from red.memory
                  if (convId) {
                    fetchConversation(convId).catch(err => {
                      console.error('[Stream] Failed to refetch conversation:', err);
                      // Don't alert - just log, data is already in database
                    });
                  }
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

        // Wait for display queue to finish
        while (displayQueue.length > 0 || isDisplaying) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error: any) {
      console.error('[Stream] Error:', error);
      setStreamingMessage(null);
      setPendingUserMessage(null); // Clear pending message on error
      throw error;
    } finally {
      console.log('[Stream] Cleaning up - clearing generation storage');
      generationStorage.clear();
      activeStreamRef.current = null;
      setIsLoading(false);
      setSkeletonShrinking(false);
      setIsStreaming(false);
      setStreamingMessageId(null);
      setCurrentStatus(null);
      setIsReconnecting(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let convId = currentConversation?.id;

    // Create new conversation if none exists
    if (!convId) {
      try {
        const newConv = await createConversation('New Conversation');
        convId = newConv.id;
        setCurrentConversation(newConv);
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
    setCurrentThinking({});

    try {
      // Show user message immediately in UI (optimistic update)
      setPendingUserMessage({
        role: 'user',
        content: userMessageContent,
        timestamp: new Date(),
      });

      // Generate messageId
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setStreamingMessageId(messageId);

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
      setPendingUserMessage(null);
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
          canDismiss={false}
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
              title={currentConversation?.title || 'Chat'}
              onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
              onNewChat={createNewConversation}
            />

            {(conversationsLoading || (!currentConversation && conversations.length > 0)) ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-white/60">Loading conversations...</div>
              </div>
            ) : (
              <>
                <Messages
                  messages={currentConversation?.messages}
                  streamingMessage={streamingMessage}
                  pendingUserMessage={pendingUserMessage}
                  thinking={currentThinking}
                  currentStatus={currentStatus}
                  isLoading={isLoading}
                  isStreaming={isStreaming}
                  streamingMessageId={streamingMessageId}
                  skeletonShrinking={skeletonShrinking}
                  isReconnecting={isReconnecting}
                  messagesEndRef={messagesEndRef}
                  conversationId={currentConversation?.id}
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
