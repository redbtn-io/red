import { MessageSquare } from 'lucide-react';
import { type Message } from '@/lib/storage/conversation';
import { useState, useEffect } from 'react';
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
  currentStatus: { action: string; description?: string } | null;
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
  onCloseModal
}: MessagesProps) {
  // Force re-render when conversation state changes (for tool executions)
  const [, forceUpdate] = useState({});
  
  // Subscribe to conversation state changes to update modal when tool executions change
  useEffect(() => {
    const unsubscribe = conversationState.subscribe(() => {
      forceUpdate({}); // Trigger re-render
    });
    return unsubscribe;
  }, []);
  
  // Get thinking content for the streaming message (if any)
  const streamingThinking = streamingMessageId ? thoughts[streamingMessageId]?.content : null;
  
  return (
    <div className="flex-1 overflow-y-auto pt-6 pb-6 px-6 space-y-6">
      {!messages?.length && !isLoading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-gray-500">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">Start a conversation</p>
            <p className="text-sm mt-2">Send a message to begin chatting with Red AI</p>
          </div>
        </div>
      )}
      {messages?.filter(msg => {
        // Filter out streaming message to prevent duplicate rendering
        return !(streamingMessage && !isLoading && msg.id === streamingMessage.id);
      }).map((message) => {
        // Get thinking from prop for this message (not currently displayed in bubble)
        
        return (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={isStreaming && streamingMessageId === message.id}
            onOpenModal={() => onOpenModal(message.id)}
          />
        );
      })}
      
      {/* Streaming Thinking Bubble - shown when thinking is streaming */}
      {streamingThinking && streamingMessageId && (
        <StreamingThinkingBubble
          thinking={streamingThinking}
          isStreaming={isStreaming}
          isThinkingDisplayComplete={isThinkingDisplayComplete}
        />
      )}
      
      {/* Streaming message that shows character-by-character */}
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
        />
      )}
      
      {/* Loading State with Status, Skeleton, and Thinking */}
      {isLoading && streamingMessageId && (
        <LoadingStateContainer
          currentStatus={currentStatus}
          thinking={thoughts[streamingMessageId]?.content || null}
          skeletonShrinking={skeletonShrinking}
          isReconnecting={isReconnecting}
        />
      )}
      
      <div ref={messagesEndRef} />
      
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
            
            switch (currentStatus.action) {
              case 'thinking':
                return 'AI is analyzing your request and formulating a response...';
              case 'processing':
              case 'routing':
                return 'Processing your request and determining the best approach...';
              case 'searching':
              case 'web_search':
                return 'Searching for relevant information to answer your question...';
              case 'system_command':
              case 'running_command':
              case 'commands':
                return 'Executing system commands to fulfill your request...';
              default:
                return currentStatus.description || `${currentStatus.action}...`;
            }
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
}

function MessageBubble({ message, isStreaming, onOpenModal }: MessageBubbleProps) {
  // All messages can show modal, but emphasis on assistant messages
  const handleMessageClick = () => {
    onOpenModal();
  };

  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-5 py-3.5 shadow-lg cursor-pointer transition-colors ${
          message.role === 'user'
            ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-100 hover:bg-[#1f1f1f]'
            : `bg-red-500 text-white hover:bg-red-600 ${isStreaming ? 'streaming-pulse' : ''}`
        }`}
        onClick={handleMessageClick}
        title={message.role === 'assistant' ? 'Click to view AI thoughts and message details' : 'Click to view message details'}
      >
        {/* Main message content with markdown */}
        <div className="prose prose-invert max-w-none 
          prose-p:my-2 prose-p:leading-relaxed
          prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/20 prose-pre:my-3
          prose-code:text-white prose-code:bg-black/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
          prose-a:text-white prose-a:underline 
          prose-strong:text-white prose-strong:font-semibold
          prose-em:text-white prose-em:italic
          prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
          prose-ul:my-2 prose-ol:my-2 prose-li:my-1
          prose-table:my-3 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2
          [&_.katex]:text-white [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto">
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
      </div>
    </div>
  );
}
