import { MessageSquare, Brain } from 'lucide-react';
import { type Message } from '@/lib/storage/conversation';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { LoadingStateContainer } from '../ui/LoadingStates';

interface MessagesProps {
  messages: Message[] | undefined;
  thinking: Record<string, string>; // messageId -> thinking content
  currentStatus: { action: string; description?: string } | null;
  isLoading: boolean;
  isStreaming: boolean;
  streamingMessageId: string | null;
  skeletonShrinking: boolean;
  isReconnecting: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationId?: string;
}

export function Messages({
  messages,
  thinking,
  currentStatus,
  isLoading,
  isStreaming,
  streamingMessageId,
  skeletonShrinking,
  isReconnecting,
  messagesEndRef,
  conversationId
}: MessagesProps) {
  // State for showing thinking during skeleton/loading phase
  const [showLoadingThinking, setShowLoadingThinking] = useState(false);
  
  // Get thinking content for the streaming message (if any)
  const streamingThinking = streamingMessageId ? thinking[streamingMessageId] : null;
  const hasStreamingThinking = streamingThinking && streamingThinking.length > 0;
  
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
      {messages?.map((message) => {
        // Get thinking from prop for this message
        const thinkingContent = message.role === 'assistant' ? thinking[message.id] : null;
        
        return (
          <MessageBubble
            key={message.id}
            message={message}
            thinking={thinkingContent || null}
            isStreaming={isStreaming && streamingMessageId === message.id}
          />
        );
      })}
      
      {/* Loading State with Status, Skeleton, and Thinking */}
      {isLoading && streamingMessageId && (
        <LoadingStateContainer
          currentStatus={currentStatus}
          thinking={thinking[streamingMessageId] || null}
          messageId={streamingMessageId}
          skeletonShrinking={skeletonShrinking}
          isReconnecting={isReconnecting}
        />
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  thinking: string | null;
  isStreaming: boolean;
}

function MessageBubble({ message, thinking, isStreaming }: MessageBubbleProps) {
  // Thinking starts HIDDEN by default, user must click to show
  const [showThinking, setShowThinking] = useState(false);
  const hasThinking = thinking && thinking.length > 0;
  
  // Show the toggle button if: thinking exists OR currently streaming
  const showToggle = hasThinking || isStreaming;

  
  return (
    <div
      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[80%] rounded-xl px-5 py-3.5 shadow-lg ${
          message.role === 'user'
            ? 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-100'
            : `bg-red-500 text-white ${isStreaming ? 'streaming-pulse' : ''}`
        }`}
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
              code: ({node, inline, className, children, ...props}: any) => {
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
        
        {/* Thinking toggle - shows when streaming starts or thinking exists */}
        {showToggle && message.role === 'assistant' && (
          <div className="mt-3 pt-3 border-t border-white/20">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition-opacity w-full text-left"
            >
              <Brain size={16} />
              <span>{showThinking ? 'Hide' : 'Show'} thinking</span>
              {isStreaming && (
                <span className="ml-auto text-xs opacity-60 animate-pulse">
                  {hasThinking ? 'streaming...' : 'waiting...'}
                </span>
              )}
              {!isStreaming && hasThinking && (
                <span className="ml-auto text-xs opacity-40">
                  {thinking?.length || 0} chars
                </span>
              )}
            </button>
            
            {showThinking && hasThinking && (
              <div className="mt-3 p-3 bg-black/20 rounded-lg text-sm">
                <div className="font-semibold mb-2 opacity-70 flex items-center justify-between">
                  <span>Reasoning:</span>
                  {isStreaming && (
                    <span className="text-xs opacity-60 animate-pulse">updating live...</span>
                  )}
                </div>
                <div className="prose prose-invert prose-sm max-w-none opacity-90 
                  prose-p:my-1 prose-p:leading-relaxed
                  prose-pre:bg-black/30 prose-pre:my-2
                  prose-code:text-white prose-code:bg-black/20 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
                  [&_.katex]:text-white [&_.katex]:text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {thinking}
                  </ReactMarkdown>
                </div>
              </div>
            )}
            
            {showThinking && !hasThinking && isStreaming && (
              <div className="mt-3 p-3 bg-black/20 rounded-lg text-sm">
                <div className="text-xs opacity-60 italic">Waiting for thinking to start...</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
