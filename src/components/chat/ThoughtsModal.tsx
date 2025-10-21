import React, { useEffect, useState } from 'react';
import { X, Brain, MessageSquare, Clock, User, Bot, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { thoughtManager, type ThoughtData } from '../../lib/thoughts/thought-manager';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date | number;
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
    status?: 'processing' | 'searching' | 'thinking' | 'streaming' | 'completed' | 'error';
    conversationId?: string;
    generationId?: string;
  };
}

interface ThoughtsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  streamingThoughts?: string;
  conversationId: string;
}

export function ThoughtsModal({ isOpen, onClose, message, streamingThoughts = '', conversationId }: ThoughtsModalProps) {
  const [thoughtData, setThoughtData] = useState<ThoughtData | null>(null);
  const [isThoughtsExpanded, setIsThoughtsExpanded] = useState(true);

  // Effect to manage thought loading and streaming
  useEffect(() => {
    if (!isOpen || !message) {
      return;
    }

    console.log('[ThoughtsModal] Effect triggered:', {
      messageId: message.id,
      streamingThoughtsLength: streamingThoughts?.length || 0,
      hasStreamingThoughts: !!streamingThoughts,
      thoughtDataContent: thoughtData?.content?.length || 0
    });

    // If we have streaming thoughts, use them directly and update immediately
    if (streamingThoughts && streamingThoughts.length > 0) {
      console.log('[ThoughtsModal] Setting streaming thoughts');
      setThoughtData({
        content: streamingThoughts,
        isLoading: false,
      });
      
      // Also save to thought manager for caching
      thoughtManager.updateThoughts(conversationId, message.id, streamingThoughts);
      return;
    }

    // For assistant messages without streaming thoughts, get from manager
    if (message.role === 'assistant') {
      const thoughts = thoughtManager.getThoughts(conversationId, message.id);
      setThoughtData(thoughts);

      // Set up polling for loading thoughts
      if (thoughts.isLoading) {
        const pollInterval = setInterval(() => {
          const updatedThoughts = thoughtManager.getThoughts(conversationId, message.id);
          setThoughtData(updatedThoughts);
          
          if (!updatedThoughts.isLoading) {
            clearInterval(pollInterval);
          }
        }, 500);

        return () => clearInterval(pollInterval);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, message, streamingThoughts, conversationId]);

  if (!isOpen || !message) return null;

  console.log('[ThoughtsModal] Render check:', {
    role: message.role,
    streamingThoughtsLength: streamingThoughts?.length || 0,
    thoughtDataContent: thoughtData?.content?.length || 0,
    willShowReasoning: message.role === 'assistant' && (streamingThoughts || thoughtData?.content)
  });

  const formatTimestamp = (timestamp: Date | number) => {
    try {
      const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
      
      // Check if date is valid
      if (!date || isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      // Format as human-readable local time
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      }).format(date);
    } catch (error) {
      console.error('Error formatting timestamp:', error, timestamp);
      return 'Invalid date';
    }
  };

  const getStatusDisplay = () => {
    const status = message.metadata?.status;
    if (!status) return null;

    const statusConfig = {
      processing: { color: 'text-blue-400', icon: Loader2, label: 'Processing', animate: true },
      searching: { color: 'text-yellow-400', icon: Loader2, label: 'Searching', animate: true },
      thinking: { color: 'text-purple-400', icon: Brain, label: 'Thinking', animate: true },
      streaming: { color: 'text-green-400', icon: Loader2, label: 'Streaming', animate: true },
      completed: { color: 'text-green-500', icon: MessageSquare, label: 'Completed', animate: false },
      error: { color: 'text-red-500', icon: AlertCircle, label: 'Error', animate: false },
    };

    const config = statusConfig[status];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <span className={`flex items-center gap-1 text-sm ${config.color}`}>
        <Icon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div 
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[#2a2a2a]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                {message.role === 'assistant' ? (
                  <Bot className="w-5 h-5 text-red-500" />
                ) : (
                  <User className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Message Details</h2>
                <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {message.timestamp ? formatTimestamp(message.timestamp) : 'No timestamp'}
                  </span>
                  {getStatusDisplay()}
                  {message.metadata?.model && (
                    <span>Model: {message.metadata.model}</span>
                  )}
                  {message.metadata?.tokens?.total && (
                    <span>{message.metadata.tokens.total} tokens</span>
                  )}
                  {message.metadata?.generationId && (
                    <a 
                      href={`/logs?generationId=${message.metadata.generationId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Logs
                    </a>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
              aria-label="Close message details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Message Content */}
            <div className="p-6 border-b border-[#2a2a2a]">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                <h3 className="text-lg font-medium text-white">Message Content</h3>
              </div>
              <div className="prose prose-invert max-w-none
                prose-p:my-2 prose-p:leading-relaxed prose-p:text-gray-300
                prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:my-3
                prose-code:text-red-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                prose-a:text-red-400 prose-a:underline prose-a:decoration-red-400/30 hover:prose-a:decoration-red-400
                prose-strong:text-white prose-strong:font-semibold
                prose-em:text-gray-300 prose-em:italic
                prose-headings:text-white prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2
                prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-gray-300
                prose-table:my-3 prose-th:px-3 prose-th:py-2 prose-th:bg-white/5 prose-td:px-3 prose-td:py-2 prose-td:border-white/10
                prose-blockquote:border-l-4 prose-blockquote:border-red-500/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-400
                [&_.katex]:text-white [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>

            {/* Reasoning Section - Show for assistant messages when thoughts exist, are streaming, or status is thinking */}
            {message.role === 'assistant' && (streamingThoughts || thoughtData?.content || message.metadata?.status === 'thinking') && (
              <div className="p-6">
                <div 
                  className="flex items-center justify-between mb-3 cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setIsThoughtsExpanded(!isThoughtsExpanded)}
                >
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-red-500" />
                  <h3 className="text-lg font-medium text-white">
                    {message.role === 'assistant' ? 'Reasoning' : 'Reasoning Details'}
                  </h3>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 ml-3">
                      {thoughtData?.isLoading ? (
                        <span className="flex items-center gap-2 text-sm text-gray-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading...
                        </span>
                      ) : thoughtData?.error ? (
                        <span className="flex items-center gap-2 text-sm text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          Error
                        </span>
                      ) : streamingThoughts ? (
                        <span className="flex items-center gap-2 text-sm text-green-400">
                          <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Streaming
                        </span>
                      ) : thoughtData?.content && (
                        <span className="text-sm text-gray-400">
                          {thoughtData.content.length} chars
                        </span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center text-gray-400">
                  {isThoughtsExpanded ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
              
              {isThoughtsExpanded && (
                <>
                  {/* Show loading ONLY if no streaming thoughts and either loading or waiting for thinking to start */}
                  {!streamingThoughts && (thoughtData?.isLoading || (message.metadata?.status === 'thinking' && !thoughtData?.content)) ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
                      <p className="text-gray-400">
                        {message.metadata?.status === 'thinking' ? 'AI is thinking...' : 'Loading AI thoughts...'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {message.metadata?.status === 'thinking' 
                          ? 'Thoughts will appear here as the AI processes your request'
                          : 'This may take a moment if thoughts need to be fetched'
                        }
                      </p>
                    </div>
                  ) : thoughtData?.error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
                      <p className="text-red-400 mb-2">Failed to load thoughts</p>
                      <p className="text-sm text-gray-500">{thoughtData.error}</p>
                    </div>
                  ) : (streamingThoughts && streamingThoughts.trim().length > 0) || (thoughtData?.content && thoughtData.content.trim().length > 0) ? (
                    <div className="prose prose-invert max-w-none
                      prose-p:my-3 prose-p:leading-relaxed prose-p:text-gray-300
                      prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:my-4
                      prose-code:text-red-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                      prose-a:text-red-400 prose-a:underline prose-a:decoration-red-400/30 hover:prose-a:decoration-red-400
                      prose-strong:text-white prose-strong:font-semibold
                      prose-em:text-gray-300 prose-em:italic
                      prose-headings:text-white prose-headings:font-bold prose-headings:mt-6 prose-headings:mb-3
                      prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                      prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-li:text-gray-300
                      prose-table:my-4 prose-th:px-4 prose-th:py-2 prose-th:bg-white/5 prose-td:px-4 prose-td:py-2 prose-td:border-white/10
                      prose-blockquote:border-l-4 prose-blockquote:border-red-500/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-400
                      prose-hr:border-white/10 prose-hr:my-6
                      [&_.katex]:text-white [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >
                        {streamingThoughts || thoughtData?.content || ''}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Brain className="w-8 h-8 text-gray-600 mb-4" />
                      <p className="text-gray-400">No thoughts available for this message</p>
                      <p className="text-sm text-gray-500 mt-1">
                        The AI may not have recorded internal reasoning for this response
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#2a2a2a] flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Message ID: <code className="text-gray-400">{message.id}</code>
              {message.metadata?.conversationId && (
                <> • Conversation: <code className="text-gray-400">{message.metadata.conversationId}</code></>
              )}
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
