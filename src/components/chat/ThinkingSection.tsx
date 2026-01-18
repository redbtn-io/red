/**
 * ThinkingSection Component
 * 
 * Displays AI reasoning/thinking as a separate expandable section.
 * Groups all thinking tool executions and shows them as a unified reasoning process.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ToolExecution } from '../../lib/tools/tool-types';
import { formatDuration } from '../../lib/tools/tool-types';

interface ThinkingSectionProps {
  thinkingExecutions: ToolExecution[];
  isContentStreaming?: boolean; // New prop to track if content is streaming
}

export function ThinkingSection({ thinkingExecutions, isContentStreaming = false }: ThinkingSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded

  // Check if any thinking is currently running
  const hasRunningThinking = thinkingExecutions.some(t => t.status === 'running');
  
  // Auto-expand when thinking starts, auto-collapse when content starts streaming
  useEffect(() => {
    if (hasRunningThinking) {
      setIsExpanded(true);
    } else if (isContentStreaming) {
      // Auto-collapse when content starts streaming and no thinking is running
      setIsExpanded(false);
    }
  }, [hasRunningThinking, isContentStreaming]);

  if (thinkingExecutions.length === 0) {
    return null;
  }

  // Combine all thinking content
  const allThinkingContent = thinkingExecutions
    .map(t => t.streamingContent)
    .filter(Boolean)
    .join('\n\n');

  // Calculate total duration
  const totalDuration = thinkingExecutions.reduce((sum, t) => {
    return sum + (t.duration || 0);
  }, 0);

  // Get overall status
  const getOverallStatus = () => {
    if (hasRunningThinking) {
      return {
        label: 'Thinking...',
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/10',
      };
    }
    
    const hasError = thinkingExecutions.some(t => t.status === 'error');
    if (hasError) {
      return {
        label: 'Error',
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
      };
    }
    
    return {
      label: 'Complete',
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    };
  };

  const status = getOverallStatus();

  return (
    <div className="p-6 border-b border-border">
      {/* Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 p-3 -ml-3 hover:bg-white/5 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            {hasRunningThinking ? (
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            ) : (
              <Brain className="w-5 h-5 text-purple-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-medium text-text-primary flex items-center gap-2">
              AI Reasoning
              {totalDuration > 0 && !hasRunningThinking && (
                <span className="text-sm text-text-muted font-normal">
                  ({formatDuration(totalDuration)})
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${status.color}`}>
                {status.label}
              </span>
              {thinkingExecutions.length > 1 && (
                <span className="text-xs text-text-muted">
                  • {thinkingExecutions.length} steps
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <div className="text-text-secondary">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </div>
      </button>

      {/* Thinking Content */}
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Combined Thinking Content */}
          {allThinkingContent && (
            <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4">
              <div className="prose prose-invert max-w-none prose-sm
                prose-p:my-2 prose-p:leading-relaxed prose-p:text-text-secondary
                prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:my-2
                prose-code:text-purple-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm
                prose-a:text-purple-400 prose-a:underline
                prose-strong:text-text-primary prose-strong:font-semibold
                prose-em:text-text-secondary prose-em:italic
                prose-headings:text-text-primary prose-headings:font-bold prose-headings:mt-3 prose-headings:mb-2
                prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-li:text-text-secondary
                prose-blockquote:border-l-4 prose-blockquote:border-purple-500/50 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-text-secondary">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {allThinkingContent}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Individual Thinking Steps (if multiple) */}
          {thinkingExecutions.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Reasoning Steps
              </h4>
              <div className="space-y-2">
                {thinkingExecutions.map((execution, index) => (
                  <div 
                    key={execution.toolId}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-text-secondary">Step {index + 1}</span>
                        {execution.duration !== undefined && (
                          <span className="text-xs text-text-muted">
                            ({formatDuration(execution.duration)})
                          </span>
                        )}
                      </div>
                      {execution.steps.length > 0 && (
                        <div className="mt-1 space-y-1">
                          {execution.steps.map((step, stepIndex) => {
                            // Defensive check: ensure step is valid
                            if (!step || typeof step !== 'object') {
                              console.warn('[ThinkingSection] Invalid step:', step);
                              return null;
                            }
                            if (!('step' in step)) {
                              console.warn('[ThinkingSection] Step missing "step" property:', step);
                              return null;
                            }
                            return (
                              <p key={stepIndex} className="text-xs text-text-secondary">
                                {String(step.step)}
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      execution.status === 'running' 
                        ? 'bg-purple-500/10 text-purple-400'
                        : execution.status === 'completed'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {execution.status === 'running' ? 'Running' 
                        : execution.status === 'completed' ? 'Complete'
                        : 'Error'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Show loading state if currently thinking */}
          {hasRunningThinking && !allThinkingContent && (
            <div className="flex items-center justify-center py-8 text-center">
              <div className="space-y-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
                <p className="text-sm text-text-secondary">AI is reasoning through the problem...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
