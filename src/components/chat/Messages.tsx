import { MessageSquare, Loader2 } from 'lucide-react';
import { type Message } from '@/lib/storage/conversation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { LoadingStateContainer } from '../ui/LoadingStates';
import { MessageDetailsModal } from './MessageDetailsModal'; // Updated import
import { StreamingThinkingBubble } from './StreamingThinkingBubble';

import { ConversationMessage, ConversationThought, conversationState } from '@/lib/conversation/conversation-state';

interface MessagesProps {
  messages: ConversationMessage[];
  streamingMessage: { id: string; content: string } | null;
  thoughts: Record<string, ConversationThought>; // messageId -> thought data
  currentStatus: { action: string; description?: string; reasoning?: string; confidence?: number } | null;
  isLoading: boolean;
  isStreaming: boolean;
  isThinkingDisplayComplete: boolean;
  streamingMessageId: string | null;
  skeletonShrinking: boolean;
  isReconnecting: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationId?: string;
  modalState: { isOpen: boolean; messageId: string | null };
  onOpenModal: (messageId: string) => void;
  onCloseModal: () => void;
  onViewGraph?: (graphRun: unknown) => void; // Callback to view graph run
  pagination: { hasMore: boolean; isLoadingMore: boolean; totalMessages?: number } | null;
  onLoadMore: () => Promise<void>;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  preventScrollRestorationRef?: React.RefObject<boolean>;
}

export function Messages({
  messages,
  streamingMessage,
  thoughts,
  currentStatus,
  isLoading,
  isStreaming,
  isThinkingDisplayComplete,
  streamingMessageId,
  skeletonShrinking,
  isReconnecting,
  messagesEndRef,
  conversationId,
  modalState,
  onOpenModal,
  onCloseModal,
  onViewGraph,
  pagination,
  onLoadMore,
  scrollContainerRef: externalScrollRef,
  preventScrollRestorationRef: externalPreventScrollRef
}: MessagesProps) {
  // Force re-render when conversation state changes (for tool executions)
  const [, forceUpdate] = useState({});
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalScrollRef || internalScrollRef;
  const isLoadingRef = useRef(false);
  const internalPreventScrollRef = useRef(false);
  const preventScrollRestorationRef = externalPreventScrollRef || internalPreventScrollRef;
  
  // Subscribe to conversation state changes to update modal when tool executions change
  useEffect(() => {
    const unsubscribe = conversationState.subscribe(() => {
      forceUpdate({}); // Trigger re-render
    });
    return unsubscribe;
  }, []);
  
  // Scroll detection for pagination
  // With flex-col-reverse, scrollTop is 0 at bottom, negative when scrolling up
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !pagination || isLoadingRef.current) return;
    
    const container = scrollContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    
    // Calculate how far we've scrolled from the bottom
    // In flex-col-reverse, scrollTop goes negative as we scroll up
    const scrolledFromBottom = Math.abs(scrollTop);
    const maxScroll = scrollHeight - clientHeight;
    
    // Require scrolling to within 100px of the top (older messages)
    // This creates an overscroll-like effect where you need to intentionally scroll near the top
    const threshold = 100;
    const distanceFromTop = maxScroll - scrolledFromBottom;
    
    // If scrolled very close to top and more messages available, load them
    if (distanceFromTop < threshold && pagination.hasMore && !pagination.isLoadingMore) {
      isLoadingRef.current = true;
      
      // Save scroll position to restore after prepend (unless prevented by manual scroll)
      const oldScrollHeight = scrollHeight;
      const oldScrollTop = scrollTop;
      const shouldRestoreScroll = !preventScrollRestorationRef.current;
      
      // Reset the prevention flag
      preventScrollRestorationRef.current = false;
      
      onLoadMore().then(() => {
        // Restore scroll position after new messages are added (only if not manually scrolling)
        if (shouldRestoreScroll) {
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              const newScrollHeight = scrollContainerRef.current.scrollHeight;
              const heightDiff = newScrollHeight - oldScrollHeight;
              // Adjust scrollTop by the height difference to maintain position
              scrollContainerRef.current.scrollTop = oldScrollTop - heightDiff;
            }
            isLoadingRef.current = false;
          });
        } else {
          isLoadingRef.current = false;
        }
      }).catch((err) => {
        console.error('Failed to load more messages:', err);
        isLoadingRef.current = false;
        preventScrollRestorationRef.current = false;
      });
    }
  }, [pagination, onLoadMore]);
  
  // Attach scroll listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);
  
  // Get thinking content for the streaming message (if any)
  const streamingThinking = streamingMessageId ? thoughts[streamingMessageId]?.content : null;
  
  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pt-14 pb-8 px-4 md:px-6 flex flex-col-reverse space-y-4 space-y-reverse bg-bg-primary">
      {/* messagesEndRef - renders first (visual bottom with flex-col-reverse) */}
      <div ref={messagesEndRef} />
      
      {/* Loading State with Status, Skeleton, and Thinking - renders after messagesEndRef (visual bottom) */}
      {isLoading && streamingMessageId && (
        <LoadingStateContainer
          currentStatus={currentStatus}
          thinking={thoughts[streamingMessageId]?.content || null}
          skeletonShrinking={skeletonShrinking}
          isReconnecting={isReconnecting}
          onOpenModal={() => onOpenModal(streamingMessageId)}
        />
      )}
      
      {/* Streaming message that shows character-by-character - appears at visual bottom */}
      {streamingMessage && (
        <MessageBubble
          key={streamingMessage.id}
          message={{
            id: streamingMessage.id,
            role: 'assistant',
            content: streamingMessage.content,
            timestamp: new Date(),
          }}
          isStreaming={true}
          onOpenModal={() => onOpenModal(streamingMessage.id)}
          isLatest={true}
        />
      )}
      
      {/* Streaming Thinking Bubble - appears at visual bottom */}
      {streamingThinking && streamingMessageId && (
        <StreamingThinkingBubble
          thinking={streamingThinking}
          isStreaming={thoughts[streamingMessageId]?.isStreaming ?? false}
          isThinkingDisplayComplete={isThinkingDisplayComplete}
          onOpenModal={() => onOpenModal(streamingMessageId)}
        />
      )}
      
      {/* Messages rendered in reverse (newest at bottom visually, then going up) */}
      <AnimatePresence initial={true}>
        {messages?.slice().reverse().filter(msg => {
          // Filter out streaming message to prevent duplicate rendering
          return !(streamingMessage && msg.id === streamingMessage.id);
        }).map((message, index, array) => {
          const isLatest = index === array.length - 1;
          // Invert animation index so newest messages (higher index) animate first
          const animationIndex = array.length - 1 - index;
          
          return (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={isStreaming && streamingMessageId === message.id}
              onOpenModal={() => onOpenModal(message.id)}
              isLatest={isLatest}
              animationIndex={animationIndex}
            />
          );
        })}
      </AnimatePresence>
      
      {/* Empty state */}
      {!messages?.length && !isLoading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-text-muted px-6 py-12">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-bg-secondary dark:bg-bg-tertiary flex items-center justify-center">
              <MessageSquare size={32} className="text-text-muted opacity-40" />
            </div>
            <p className="text-lg font-semibold text-text-primary mb-2">Start a conversation</p>
            <p className="text-sm text-text-secondary max-w-xs mx-auto">Send a message to begin chatting with your AI assistant</p>
          </div>
        </div>
      )}
      
      {/* Loading spinner for pagination - appears at visual top (oldest messages) due to flex-col-reverse */}
      {pagination?.isLoadingMore ? (
        <div className="flex items-center justify-center py-6 bg-bg-secondary/60 dark:bg-bg-secondary/50 backdrop-blur-sm rounded-xl border border-border/50 mb-2">
          <Loader2 className="w-5 h-5 animate-spin text-accent mr-3" />
          <span className="text-sm font-medium text-text-secondary">Loading older messages...</span>
        </div>
      ) : (
        /* Spacer - renders last (visual top due to flex-col-reverse) to prevent oldest messages from touching navbar */
        <div className="min-h-4 mb-1" />
      )}
      
      {/* Thoughts Modal - Rendered at Messages level to persist across message re-renders */}
      {modalState.isOpen && modalState.messageId && (() => {
        // Find the message for the modal
        let modalMessage = messages?.find(m => m.id === modalState.messageId);
        
        console.log('[Modal Render]', {
          messageId: modalState.messageId,
          foundInMessages: !!modalMessage,
          streamingMessageId: streamingMessage?.id,
          isLoading,
          streamingMessageIdProp: streamingMessageId,
          thoughtsForMessage: !!thoughts[modalState.messageId]
        });
        
        // Check if it's the streaming message
        if (!modalMessage && streamingMessage?.id === modalState.messageId) {
          console.log('[Modal] Using streamingMessage');
          modalMessage = {
            id: streamingMessage.id,
            role: 'assistant' as const,
            content: streamingMessage.content,
            timestamp: new Date(),
          };
        }
        
        // Check if it's the loading state (isLoading && streamingMessageId matches)
        if (!modalMessage && isLoading && streamingMessageId === modalState.messageId) {
          console.log('[Modal] Using loading state message');
          // Create a temporary message for the loading state
          const getContentByStatus = () => {
            if (!currentStatus) return 'Initializing your request...';
            
            let statusText = '';
            switch (currentStatus.action) {
              case 'thinking':
                statusText = 'AI is analyzing your request and formulating a response...';
                break;
              case 'processing':
              case 'routing':
                statusText = 'Processing your request and determining the best approach...';
                break;
              case 'searching':
              case 'web_search':
                statusText = 'Searching for relevant information to answer your question...';
                break;
              case 'system_command':
              case 'running_command':
              case 'commands':
                statusText = 'Executing system commands to fulfill your request...';
                break;
              default:
                statusText = currentStatus.description || `${currentStatus.action}...`;
            }
            
            // Append reasoning and confidence if available
            if (currentStatus.reasoning) {
              statusText += `\n\n💭 Router reasoning: ${currentStatus.reasoning}`;
            }
            if (currentStatus.confidence !== undefined) {
              const confidencePercent = (currentStatus.confidence * 100).toFixed(0);
              const confidenceLabel = currentStatus.confidence >= 0.9 ? 'Very High' :
                                     currentStatus.confidence >= 0.7 ? 'High' :
                                     currentStatus.confidence >= 0.5 ? 'Moderate' : 'Low';
              statusText += `\n\n📊 Confidence: ${confidencePercent}% (${confidenceLabel})`;
            }
            
            return statusText;
          };
          
          modalMessage = {
            id: modalState.messageId,
            role: 'assistant' as const,
            content: getContentByStatus(),
            timestamp: new Date(),
            metadata: {
              status: currentStatus?.action as 'processing' | 'searching' | 'thinking' | 'streaming' | 'completed' | 'error',
              conversationId,
            }
          };
        }
        
        // Fallback: If still no message found but modal is open, create a placeholder
        // This handles the transition period between states
        if (!modalMessage) {
          console.log('[Modal] No message found - creating placeholder');
          modalMessage = {
            id: modalState.messageId,
            role: 'assistant' as const,
            content: 'Loading message...',
            timestamp: new Date(),
          };
        }
        
        // Get thinking for this message - ALWAYS pass if it exists
        const modalThinking = thoughts[modalState.messageId]?.content || null;
        
        // Get tool executions for this message
        const toolExecutions = conversationState.getToolExecutions(modalState.messageId);
        
        console.log('[Modal] Rendering with thinking:', modalThinking?.length || 0, 'chars, tool executions:', toolExecutions.length);
        
        return (
          <MessageDetailsModal
            isOpen={true}
            onClose={onCloseModal}
            message={modalMessage}
            streamingThoughts={modalThinking || undefined}
            conversationId={conversationId || ''}
            toolExecutions={toolExecutions}
            onViewGraph={onViewGraph}
          />
        );
      })()}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  isStreaming: boolean;
  onOpenModal: () => void;
  isLatest?: boolean;
  animationIndex?: number;
}

function MessageBubble({ message, isStreaming, onOpenModal, isLatest = false, animationIndex = 0 }: MessageBubbleProps) {
  // Check if this message has tools or thinking available
  const toolExecutions = conversationState.getToolExecutions(message.id);
  const hasTools = toolExecutions.length > 0;
  const thoughtData = conversationState.getThought(message.id);
  const hasThinking = thoughtData?.content && thoughtData.content.length > 0;
  const hasDetails = hasTools || hasThinking;
  
  // All messages can show modal, but emphasis on assistant messages
  const handleMessageClick = () => {
    onOpenModal();
  };

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <motion.div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ 
        duration: 0.2, 
        delay: Math.min(animationIndex * 0.02, 0.2),
        ease: [0.25, 0.1, 0.25, 1]
      }}
      layout
    >
      <div
        className={`
          max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 cursor-pointer transition-all duration-200 select-none
          ${isUser
            ? 'bg-bg-secondary dark:bg-bg-tertiary border border-border text-text-primary hover:border-border-hover'
            : `bg-red-500 text-white hover:bg-red-600 ${isStreaming ? 'streaming-pulse' : ''}`
          }
        `}
        style={{
          boxShadow: isUser 
            ? 'var(--shadow-bubble, 0 1px 3px rgba(0,0,0,0.1))' 
            : isStreaming 
              ? undefined 
              : '0 2px 8px rgba(239, 68, 68, 0.2), 0 1px 3px rgba(0, 0, 0, 0.08)'
        }}
        onClick={handleMessageClick}
        title={isAssistant ? 'Click to view AI thoughts and message details' : 'Click to view message details'}
      >
        {/* Main message content with markdown */}
        <div className={`prose max-w-none text-[15px] leading-relaxed
          prose-p:my-1.5 prose-p:leading-relaxed
          prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
          prose-table:my-3 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
          [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto
          ${isAssistant 
            ? 'prose-invert prose-pre:bg-black/20 prose-pre:border prose-pre:border-white/10 prose-pre:my-3 prose-pre:rounded-lg prose-code:bg-black/15 prose-code:text-white prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal prose-a:text-white prose-a:underline prose-a:decoration-white/50 prose-strong:text-white prose-strong:font-semibold prose-em:text-white/90 prose-headings:text-white [&_.katex]:text-white'
            : 'prose-pre:bg-bg-secondary prose-pre:border prose-pre:border-border prose-pre:my-3 prose-pre:rounded-lg prose-code:bg-bg-secondary prose-code:text-text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal prose-a:text-accent-text prose-a:underline prose-a:decoration-accent-text/50 prose-strong:text-text-primary prose-strong:font-semibold prose-em:text-text-secondary prose-headings:text-text-primary prose-p:text-text-primary [&_.katex]:text-text-primary'
          }`}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              code: ({inline, className, children, ...props}: {
                node?: unknown;
                inline?: boolean;
                className?: string;
                children?: React.ReactNode;
              }) => {
                return inline ? (
                  <code className={className} {...props}>
                    {children}
                  </code>
                ) : (
                  <pre className="overflow-x-auto">
                    <code className={className} {...props}>
                      {children}
                    </code>
                  </pre>
                );
              },
              p: ({children, ...props}) => <p {...props}>{children}</p>
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
        
        {/* Subtle status indicators at bottom */}
        {isAssistant && hasDetails && (
          <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-white/25">
            {hasThinking && (
              <div className="flex items-center gap-1.5 text-xs text-white/80" title="AI reasoning available">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-300"></div>
                {isLatest && <span className="font-medium">Thinking</span>}
              </div>
            )}
            {hasTools && (
              <div className="flex items-center gap-1.5 text-xs text-white/80" title={`${toolExecutions.length} tool${toolExecutions.length > 1 ? 's' : ''} used`}>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                {isLatest && <span className="font-medium">{toolExecutions.length} tool{toolExecutions.length > 1 ? 's' : ''}</span>}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
