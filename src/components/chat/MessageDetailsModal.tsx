/**
 * MessageDetailsModal Component
 * 
 * Displays comprehensive message details including content, metadata,
 * and a timeline of all tool executions (thinking, web search, etc.).
 * 
 * Replaces the previous ThoughtsModal with a unified tool execution view.
 */

import React, { useEffect, useState } from 'react';
import { X, MessageSquare, Clock, User, Bot, ExternalLink, Wrench, ChevronDown, ChevronRight, Brain, GitBranch } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { thoughtManager, type ThoughtData } from '../../lib/thoughts/thought-manager';
import { ToolExecutionSection } from './ToolExecutionSection';
import type { ToolExecution } from '../../lib/tools/tool-types';

// Graph run data type (matches IGraphRun from database)
interface GraphRunData {
  graphId: string;
  graphName?: string;
  runId?: string;
  status: 'running' | 'completed' | 'error';
  executionPath: string[];
  nodeProgress: Record<string, {
    nodeId: string;
    status: 'pending' | 'running' | 'completed' | 'error';
    stepName?: string;
    currentStep?: number;
    totalSteps?: number;
    startTime?: number;
    endTime?: number;
    error?: string;
  }>;
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

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
  graphRun?: GraphRunData;
}

interface MessageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  streamingThoughts?: string; // Legacy support during migration
  conversationId: string;
  toolExecutions?: ToolExecution[]; // Tool executions from conversation state
  onViewGraph?: (graphRun: GraphRunData) => void; // Callback to view graph run
}

export function MessageDetailsModal({ 
  isOpen, 
  onClose, 
  message, 
  streamingThoughts = '', 
  conversationId,
  toolExecutions = [],
  onViewGraph
}: MessageDetailsModalProps) {
  const [thoughtData, setThoughtData] = useState<ThoughtData | null>(null);
  const [isReasoningExpanded, setIsReasoningExpanded] = useState(false); // Default to collapsed
  const [isToolsExpanded, setIsToolsExpanded] = useState(false); // Tools section default to collapsed
  const [isGraphExpanded, setIsGraphExpanded] = useState(false); // Graph run section
  const [graphRun, setGraphRun] = useState<GraphRunData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  
  // Load graph run data when modal opens
  useEffect(() => {
    if (!isOpen || !message || message.role !== 'assistant') {
      setGraphRun(null);
      return;
    }
    
    // Check if message already has graph run data
    if (message.graphRun) {
      setGraphRun(message.graphRun);
      return;
    }
    
    // Try to fetch from API
    const fetchGraphRun = async () => {
      const convId = message.metadata?.conversationId || conversationId;
      if (!convId) return;
      
      setGraphLoading(true);
      try {
        const response = await fetch(
          `/api/v1/conversations/${convId}/messages/${message.id}/graph-run`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.graphRun) {
            setGraphRun(data.graphRun);
          }
        }
      } catch (err) {
        console.warn('Failed to load graph run:', err);
      } finally {
        setGraphLoading(false);
      }
    };
    
    fetchGraphRun();
  }, [isOpen, message, conversationId]);

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
          className="bg-bg-secondary border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col pointer-events-auto animate-in zoom-in-95 duration-200 overflow-hidden select-text [&_*]:select-text"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Sticky on mobile */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border sticky top-0 bg-bg-secondary z-10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg flex-shrink-0">
                {message.role === 'assistant' ? (
                  <Bot className="w-5 h-5 text-red-500" />
                ) : (
                  <User className="w-5 h-5 text-red-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg md:text-xl font-semibold text-text-primary truncate">Message Details</h2>
                <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm text-text-secondary mt-1 flex-wrap">
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
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-text-secondary hover:text-text-primary"
              aria-label="Close message details"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {/* Message Content */}
            <div className="p-4 md:p-6 border-b border-border">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-text-secondary" />
                <h3 className="text-lg font-medium text-text-primary">Message Content</h3>
              </div>
              <div className="prose prose-invert max-w-none
                prose-p:my-2 prose-p:leading-relaxed prose-p:text-text-secondary
                prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:my-3 prose-pre:overflow-x-auto
                prose-code:text-red-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:break-words
                prose-a:text-red-400 prose-a:underline prose-a:decoration-red-400/30 hover:prose-a:decoration-red-400 prose-a:break-words
                prose-strong:text-text-primary prose-strong:font-semibold
                prose-em:text-text-secondary prose-em:italic
                prose-headings:text-text-primary prose-headings:font-bold prose-headings:mt-4 prose-headings:mb-2 prose-headings:break-words
                prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-text-secondary
                prose-table:my-3 prose-th:px-3 prose-th:py-2 prose-th:bg-white/5 prose-td:px-3 prose-td:py-2 prose-td:border-white/10
                prose-blockquote:border-l-4 prose-blockquote:border-red-500/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-text-secondary
                [&_.katex]:text-text-primary [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto break-words">
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
              <div className="p-4 md:p-6 border-b border-border">
                <div 
                  className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setIsReasoningExpanded(!isReasoningExpanded)}
                >
                  <Brain className="w-4 h-4 text-purple-500" />
                  <h3 className="text-lg font-medium text-text-primary">AI Reasoning</h3>
                  {isReasoningExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-secondary ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-secondary ml-auto" />
                  )}
                </div>
                
                {isReasoningExpanded && (
                  <>
                    {thoughtData?.isLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-text-secondary">AI is reasoning...</p>
                      </div>
                    ) : thoughtData?.error ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-red-400 mb-2">Failed to load reasoning</p>
                        <p className="text-sm text-text-muted">{thoughtData.error}</p>
                      </div>
                    ) : (streamingThoughts || thoughtData?.content) ? (
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
                        <div className="prose prose-invert max-w-none prose-sm
                          prose-p:my-2 prose-p:leading-relaxed prose-p:text-text-secondary
                          prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:overflow-x-auto
                          prose-code:text-purple-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:break-words
                          break-words">
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
              <div className="p-4 md:p-6 border-b border-border">
                <div 
                  className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setIsToolsExpanded(!isToolsExpanded)}
                >
                  <div className="p-2 bg-red-500/10 rounded-lg">
                    <Wrench className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-text-primary">Tool Executions</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-text-muted">
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
                  <div className="text-text-secondary">
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

            {/* Graph Run Section */}
            {(graphRun || graphLoading) && (
              <div className="p-4 md:p-6 border-b border-border">
                <div 
                  className="flex items-center gap-2 mb-4 cursor-pointer hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setIsGraphExpanded(!isGraphExpanded)}
                >
                  <div className="p-2 bg-accent/10 rounded-lg">
                    <GitBranch className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-text-primary">Graph Execution</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {graphLoading ? (
                        <span className="text-sm text-text-muted">Loading...</span>
                      ) : graphRun ? (
                        <>
                          <span className="text-sm text-text-muted">
                            {graphRun.graphName || graphRun.graphId}
                          </span>
                          <span className={`text-xs font-medium ${
                            graphRun.status === 'completed' ? 'text-green-400' :
                            graphRun.status === 'error' ? 'text-red-400' :
                            'text-blue-400'
                          }`}>
                            • {graphRun.status.charAt(0).toUpperCase() + graphRun.status.slice(1)}
                          </span>
                          <span className="text-sm text-text-muted">
                            • {graphRun.executionPath.length} nodes
                          </span>
                          {graphRun.duration && (
                            <span className="text-sm text-text-muted">
                              • {(graphRun.duration / 1000).toFixed(2)}s
                            </span>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>
                  
                  {/* Expand/Collapse Icon */}
                  <div className="text-text-secondary">
                    {isGraphExpanded ? (
                      <ChevronDown className="w-5 h-5" />
                    ) : (
                      <ChevronRight className="w-5 h-5" />
                    )}
                  </div>
                </div>
                
                {isGraphExpanded && graphRun && (
                  <div className="space-y-4">
                    {/* Execution Path */}
                    <div className="bg-accent/5 border border-accent/20 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-text-secondary mb-3">Execution Path</h4>
                      <div className="flex flex-wrap gap-2">
                        {graphRun.executionPath.map((nodeId, index) => {
                          const progress = graphRun.nodeProgress[nodeId];
                          const statusColor = 
                            progress?.status === 'completed' ? 'bg-green-500/20 border-green-500/40 text-green-400' :
                            progress?.status === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-400' :
                            progress?.status === 'running' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' :
                            'bg-gray-500/20 border-gray-500/40 text-gray-400';
                          
                          return (
                            <React.Fragment key={`${nodeId}-${index}`}>
                              <div className={`px-3 py-1.5 rounded-lg border ${statusColor} text-sm font-medium`}>
                                {nodeId}
                              </div>
                              {index < graphRun.executionPath.length - 1 && (
                                <div className="flex items-center text-text-muted">→</div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* View Full Graph Button */}
                    {onViewGraph && (
                      <button
                        onClick={() => onViewGraph(graphRun)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded-lg text-accent font-medium transition-colors"
                      >
                        <GitBranch className="w-4 h-4" />
                        View Full Graph
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border flex justify-between items-center">
            <div className="text-sm text-text-muted">
              Message ID: <code className="text-text-secondary">{message.id}</code>
              {message.metadata?.conversationId && (
                <> • Conversation: <code className="text-text-secondary">{message.metadata.conversationId}</code></>
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
