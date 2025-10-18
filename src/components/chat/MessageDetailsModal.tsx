/**
 * MessageDetailsModal Component
 * 
 * Displays comprehensive message details including content, metadata,
 * and a timeline of all tool executions (thinking, web search, etc.).
 * 
 * Replaces the previous ThoughtsModal with a unified tool execution view.
 */

import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Clock, User, Bot, ExternalLink, Wrench, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { thoughtManager, type ThoughtData } from '../../lib/thoughts/thought-manager';
import { ToolExecutionSection } from './ToolExecutionSection';
import type { ToolExecution } from '../../lib/tools/tool-types';

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
  toolExecutions?: ToolExecution[];
}

interface MessageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  streamingThoughts?: string; // Legacy support during migration
  conversationId: string;
  toolExecutions?: ToolExecution[]; // Tool executions from conversation state
}

export function MessageDetailsModal({ 
  isOpen, 
  onClose, 
  message, 
  streamingThoughts = '', 
  conversationId,
  toolExecutions = []
}: MessageDetailsModalProps) {
  const [thoughtData, setThoughtData] = useState<ThoughtData | null>(null);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false); // Default to collapsed
  const [isToolsExpanded, setIsToolsExpanded] = useState(false); // Tools section default to collapsed

  // Effect to manage legacy thought loading for backward compatibility
  useEffect(() => {
    if (!isOpen || !message) {
      return;
    }

    // If we have streaming thoughts (legacy), use them
    if (streamingThoughts && streamingThoughts.length > 0) {
      setThoughtData({
        content: streamingThoughts,
        isLoading: false,
      });
      thoughtManager.updateThoughts(conversationId, message.id, streamingThoughts);
      return;
    }

    // For assistant messages, try to get from manager (backward compatibility)
    if (message.role === 'assistant') {
      const thoughts = thoughtManager.getThoughts(conversationId, message.id);
      setThoughtData(thoughts);

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
  }, [isOpen, message, streamingThoughts, conversationId]);

  // Auto-collapse tools section when all tools are completed
  useEffect(() => {
    if (!isOpen || !message) {
      return;
    }
    
    const actualToolExecutions = message.toolExecutions || toolExecutions || [];
    const hasToolExecutions = actualToolExecutions.length > 0;
    const hasRunningTools = actualToolExecutions.some(t => t.status === 'running');
    const allToolsCompleted = hasToolExecutions && actualToolExecutions.every(t => 
      t.status === 'completed' || t.status === 'error'
    );
    
    if (hasRunningTools) {
      setIsToolsExpanded(true);
    } else if (allToolsCompleted) {
      setIsToolsExpanded(false);
    }
  }, [isOpen, message, toolExecutions]);

  if (!isOpen || !message) return null;

  const formatTimestamp = (timestamp: Date | number) => {
    try {
      const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
      
      if (!date || isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
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
      processing: { color: 'text-blue-400', label: 'Processing' },
      searching: { color: 'text-yellow-400', label: 'Searching' },
      thinking: { color: 'text-purple-400', label: 'Thinking' },
      streaming: { color: 'text-green-400', label: 'Streaming' },
      completed: { color: 'text-green-500', label: 'Completed' },
      error: { color: 'text-red-500', label: 'Error' },
    };

    const config = statusConfig[status];
    if (!config) return null;

    return (
      <span className={`flex items-center gap-1 text-sm ${config.color}`}>
        {config.label}
      </span>
    );
  };

  // Check if we have any tool executions to show (excluding thinking - it's separate)
  const actualToolExecutions = toolExecutions 
    ? toolExecutions.filter(t => t.toolType !== 'thinking')
    : [];
  const hasToolExecutions = actualToolExecutions.length > 0;
  
  // Auto-collapse tools section when all tools are completed
  const hasRunningTools = actualToolExecutions.some(t => t.status === 'running');
  const allToolsCompleted = hasToolExecutions && actualToolExecutions.every(t => 
    t.status === 'completed' || t.status === 'error'
  );
  
  // Check for thinking data (either streaming or from thought manager)
  const hasThinking = message.role === 'assistant' && 
    (streamingThoughts || thoughtData?.content || message.metadata?.status === 'thinking');

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

            {/* AI Reasoning Section (separate from tools) */}
            {hasThinking && (
              <div className="p-6 border-b border-[#2a2a2a]">
                <div 
                  className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                >
                  <Brain className="w-4 h-4 text-purple-500" />
                  <h3 className="text-lg font-medium text-white">AI Reasoning</h3>
                  {isReasoningExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                  )}
                </div>
                
                {isReasoningExpanded && (
                  <>
                    {thoughtData?.isLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-gray-400">AI is reasoning...</p>
                      </div>
                    ) : thoughtData?.error ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-red-400 mb-2">Failed to load reasoning</p>
                        <p className="text-sm text-gray-500">{thoughtData.error}</p>
                      </div>
                    ) : (streamingThoughts || thoughtData?.content) ? (
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                        <div className="prose prose-invert max-w-none prose-sm
                          prose-p:my-2 prose-p:leading-relaxed prose-p:text-gray-300
                          prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10
                          prose-code:text-purple-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {streamingThoughts || thoughtData?.content || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            )}

            {/* Tool Executions Timeline */}
            {hasToolExecutions && (
              <div className="p-6 border-b border-[#2a2a2a]">
                <div 
                  className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                >
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Wrench className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-white">Tool Executions</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-500">
                        {actualToolExecutions.length} {actualToolExecutions.length === 1 ? 'tool' : 'tools'}
                      </span>
                      {hasRunningTools && (
                        <span className="text-xs text-blue-400 font-medium">
                          • Running
                        </span>
                      )}
                      {allToolsCompleted && (
                        <span className="text-xs text-green-400 font-medium">
                          • Completed
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Expand/Collapse Icon */}
                  <div className="text-gray-400">
                    {isToolsExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                </div>
                
                {isToolsExpanded && (
                  <div className="space-y-4">
                    {actualToolExecutions.map((execution, index) => (
                      <ToolExecutionSection
                        key={execution.toolId}
                        execution={execution}
                        isLatest={index === actualToolExecutions.length - 1}
                      />
                    ))}
                  </div>
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

// Export with legacy name for backward compatibility during migration
export { MessageDetailsModal as ThoughtsModal };
