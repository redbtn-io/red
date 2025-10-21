import { Brain, Search, Terminal, GitBranch, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useState } from 'react';

interface LoadingStateContainerProps {
  currentStatus: {
    action: string;
    description?: string;
  } | null;
  thinking: string | null;
  skeletonShrinking: boolean;
  isReconnecting: boolean;
  onOpenModal?: () => void;
}

export function LoadingStateContainer({
  currentStatus,
  thinking,
  skeletonShrinking,
  isReconnecting,
  onOpenModal
}: LoadingStateContainerProps) {
  const [showThinking, setShowThinking] = useState(false);

  const getIcon = () => {
    if (!currentStatus) return <Loader2 size={16} className="text-red-400 animate-spin" />;
    
    switch (currentStatus.action) {
      case 'thinking':
        return <Brain size={16} className="text-red-400" />;
      case 'processing':
      case 'routing':
        return <GitBranch size={16} className="text-red-400" />;
      case 'searching':
      case 'web_search':
        return <Search size={16} className="text-red-400" />;
      case 'system_command':
      case 'running_command':
      case 'commands':
        return <Terminal size={16} className="text-red-400" />;
      default:
        return <Loader2 size={16} className="text-red-400 animate-spin" />;
    }
  };

  const getStatusText = () => {
    if (!currentStatus) return isReconnecting ? 'Loading...' : 'Sending...';
    
    switch (currentStatus.action) {
      case 'thinking':
        return 'Reasoning';
      case 'processing':
      case 'routing':
        return 'Processing';
      case 'searching':
      case 'web_search':
        return 'Searching';
      case 'system_command':
      case 'running_command':
      case 'commands':
        return 'Running System Command';
      default:
        return currentStatus.description || currentStatus.action;
    }
  };

  const hasThinking = thinking && thinking.length > 0;

  return (
    <>
      <div className="flex justify-start mb-6">
        <div className="max-w-[85%]">
          {/* Single loading box with dynamic status */}
          <div
            className={`bg-[#1a1a1a] border border-red-500/50 rounded-xl px-4 py-3 shadow-lg space-y-2 animate-pulse overflow-hidden origin-left cursor-pointer hover:bg-[#1f1f1f] transition-colors ${
              skeletonShrinking 
                ? 'transition-all duration-[800ms] ease-out opacity-0 scale-x-0 -translate-x-4' 
                : 'transition-all duration-[800ms] ease-out opacity-100 scale-x-100 translate-x-0'
            }`}
            title="Click to view details"
            onClick={onOpenModal}
          >
          {/* Line 1: Current status with icon */}
          <div className="flex items-center gap-2 text-sm text-red-400">
            {getIcon()}
            <span>{getStatusText()}</span>
          </div>

          {/* Line 2: Show thinking button (only if thinking exists) */}
          {hasThinking && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent modal from opening when clicking thinking button
                setShowThinking(!showThinking);
              }}
              className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors w-full text-left"
            >
              <span>{showThinking ? 'Hide' : 'Show'} thinking</span>
              <span className="ml-auto text-xs opacity-60">
                {thinking.length} chars
              </span>
            </button>
          )}
        </div>

        {/* Expanded thinking content (separate box below) */}
        {showThinking && hasThinking && (
          <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-xl px-4 py-3 shadow-lg mt-3">
            <div className="font-semibold mb-2 text-purple-300 flex items-center justify-between">
              <span>Reasoning:</span>
              <span className="text-xs opacity-60 animate-pulse">streaming...</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none 
              prose-p:my-1 prose-p:leading-relaxed prose-p:text-gray-300
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
      </div>
    </div>
  </>
  );
}
