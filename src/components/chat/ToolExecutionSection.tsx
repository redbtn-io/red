/**
 * ToolExecutionSection Component
 * 
 * Displays a single tool execution with auto-expand/collapse logic,
 * progress indicators, streaming content, and completion states.
 */

import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { ToolExecution } from '../../lib/tools/tool-types';
import { getToolDisplay, formatDuration } from '../../lib/tools/tool-types';

interface ToolExecutionSectionProps {
  execution: ToolExecution;
  isLatest?: boolean; // Is this the most recent/active tool?
  autoExpand?: boolean; // Override auto-expand logic
}

export function ToolExecutionSection({ 
  execution, 
  isLatest = false,
  autoExpand 
}: ToolExecutionSectionProps) {
  // Auto-expand if running or if explicitly set
  const shouldAutoExpand = autoExpand !== undefined 
    ? autoExpand 
    : execution.status === 'running' || isLatest;
    
  const [isExpanded, setIsExpanded] = useState(shouldAutoExpand);

  // Update expansion when status changes
  useEffect(() => {
    if (execution.status === 'running') {
      setIsExpanded(true);
    } else if (execution.status === 'completed' || execution.status === 'error') {
      // Auto-collapse when tool completes or fails
      setIsExpanded(false);
    }
  }, [execution.status]);

  const toolDisplay = getToolDisplay(execution.toolType);
  
  // Get status icon and color
  const getStatusDisplay = () => {
    switch (execution.status) {
      case 'running':
        return {
          icon: <Loader2 className="w-4 h-4 animate-spin" />,
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          label: 'Running'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-4 h-4" />,
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          label: 'Completed'
        };
      case 'error':
        return {
          icon: <XCircle className="w-4 h-4" />,
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          label: 'Failed'
        };
      default:
        return {
          icon: <Loader2 className="w-4 h-4" />,
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          label: 'Unknown'
        };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="border-l-2 border-white/10 pl-4 pb-4 last:pb-0">
      {/* Tool Header - Clickable to expand/collapse */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-3 p-3 -ml-4 hover:bg-white/5 rounded-lg transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1">
          {/* Tool Icon */}
          <div className={`p-2 rounded-lg ${toolDisplay.bgColor}`}>
            <span className="text-lg">{toolDisplay.icon}</span>
          </div>

          {/* Tool Name and Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className={`font-medium ${toolDisplay.color}`}>
                {execution.toolName}
              </h4>
              {execution.duration !== undefined && execution.status !== 'running' && (
                <span className="text-xs text-gray-500">
                  ({formatDuration(execution.duration)})
                </span>
              )}
            </div>
            
            {/* Current Step or Status */}
            {execution.currentStep && execution.status === 'running' ? (
              <p className="text-sm text-gray-400 truncate">
                {execution.currentStep}
              </p>
            ) : execution.status === 'error' && execution.error ? (
              <p className="text-sm text-red-400 truncate">
                {execution.error}
              </p>
            ) : execution.steps.length > 0 && execution.status === 'completed' ? (
              <p className="text-sm text-gray-400 truncate">
                {execution.steps[execution.steps.length - 1]?.step}
              </p>
            ) : null}
          </div>

          {/* Status Badge */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${statusDisplay.bgColor}`}>
            {statusDisplay.icon}
            <span className={`text-xs font-medium ${statusDisplay.color}`}>
              {statusDisplay.label}
            </span>
          </div>
        </div>

        {/* Expand/Collapse Icon */}
        <div className="text-gray-400">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
      </button>

      {/* Tool Content - Expanded State */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Progress Bar */}
          {execution.progress !== undefined && execution.status === 'running' && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Progress</span>
                <span>{Math.round(execution.progress)}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300 ease-out"
                  style={{ width: `${execution.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Steps Timeline */}
          {execution.steps.length > 0 ? (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Execution Steps
              </h5>
              <div className="space-y-2">
                {execution.steps.map((step, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 text-sm"
                  >
                    <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-300">{step.step}</p>
                      {step.data && typeof step.data === 'object' ? (
                        <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                    {step.progress !== undefined ? (
                      <span className="text-xs text-gray-500">
                        {Math.round(step.progress)}%
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Streaming Content (for thinking, code output, etc.) */}
          {execution.streamingContent && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {execution.toolType === 'thinking' ? 'Reasoning' : 'Output'}
              </h5>
              <div className="prose prose-invert max-w-none prose-sm
                prose-p:my-2 prose-p:leading-relaxed prose-p:text-gray-300
                prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10
                prose-code:text-blue-400 prose-code:bg-black/30 prose-code:px-2 prose-code:py-1 prose-code:rounded
                prose-a:text-blue-400 prose-a:underline
                prose-strong:text-white prose-strong:font-semibold
                prose-headings:text-white prose-headings:font-bold
                prose-ul:my-2 prose-ol:my-2 prose-li:my-1
                prose-blockquote:border-l-4 prose-blockquote:border-blue-500/50 prose-blockquote:pl-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {execution.streamingContent}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Result Data */}
          {execution.result && execution.status === 'completed' && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Result
              </h5>
              <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                <pre className="text-xs text-gray-300 overflow-x-auto">
                  {typeof execution.result === 'string' 
                    ? execution.result 
                    : JSON.stringify(execution.result, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Metadata */}
          {execution.metadata && Object.keys(execution.metadata).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Metadata
              </h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(execution.metadata).map(([key, value]) => (
                  <div 
                    key={key}
                    className="px-2 py-1 bg-white/5 rounded text-xs"
                  >
                    <span className="text-gray-400">{key}:</span>{' '}
                    <span className="text-gray-300">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {execution.error && execution.status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-red-400 mb-1">
                    Execution Failed
                  </h5>
                  <p className="text-sm text-red-300">
                    {execution.error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
