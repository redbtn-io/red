/**
 * StreamingThinkingBubble Component
 * 
 * Displays a compact purple bubble that mimics the content bubble styling
 * while AI thinking is streaming. Features a subtle pulse animation and
 * automatically shrinks when thinking completes.
 */

import React, { useState, useEffect } from 'react';
import { Brain } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface StreamingThinkingBubbleProps {
  thinking: string | null;
  isStreaming: boolean;
  isThinkingDisplayComplete: boolean;
  onOpenModal?: () => void;
}

export function StreamingThinkingBubble({ thinking, isStreaming, isThinkingDisplayComplete, onOpenModal }: StreamingThinkingBubbleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isShrinking, setIsShrinking] = useState(false);
  
  const hasThinking = thinking && thinking.length > 0;
  
  useEffect(() => {
    if (hasThinking && isStreaming) {
      // Show bubble when thinking is streaming
      setIsVisible(true);
      setIsShrinking(false);
    } else if (hasThinking && !isStreaming) {
      // Start shrinking when streaming stops
      setIsShrinking(true);
      
      // Hide completely after shrink animation (400ms duration)
      setTimeout(() => {
        setIsVisible(false);
      }, 400);
    } else if (!hasThinking) {
      // Hide immediately if no thinking
      setIsVisible(false);
      setIsShrinking(false);
    }
  }, [hasThinking, isStreaming]);
  
  if (!isVisible) return null;
  
  return (
    <div className="flex justify-start">
      <div 
        onClick={onOpenModal}
        className={`
        max-w-[80%] rounded-xl px-5 py-3.5 shadow-lg cursor-pointer transition-all duration-400 ease-in-out select-none
        bg-purple-600 border border-purple-500/50 text-white hover:bg-purple-700
        ${isStreaming ? 'thinking-pulse' : ''}
        ${isShrinking ? 'transform scale-x-0 scale-y-0 opacity-0 origin-top-left' : 'transform scale-x-100 scale-y-100 opacity-100 origin-top-left'}
      `}>
        {/* Header with brain icon and minimal text */}
        <div className="flex items-center gap-2 mb-2">
          <Brain className="w-4 h-4 text-purple-200" />
          <span className="text-sm font-medium text-purple-100">
            Thinking...
          </span>
          {isStreaming && (
            <div className="flex items-center gap-1 ml-auto">
              <div className="w-1 h-1 bg-purple-200 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1 h-1 bg-purple-200 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1 h-1 bg-purple-200 rounded-full animate-bounce"></div>
            </div>
          )}
        </div>
        
        {/* Compact thinking content */}
        <div className="prose prose-invert max-w-none prose-sm
          prose-p:my-1 prose-p:leading-relaxed prose-p:text-purple-50
          prose-pre:bg-black/30 prose-pre:border prose-pre:border-purple-400/30 prose-pre:my-2
          prose-code:text-purple-100 prose-code:bg-black/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
          prose-a:text-purple-100 prose-a:underline 
          prose-strong:text-purple-50 prose-strong:font-semibold
          prose-em:text-purple-50 prose-em:italic
          prose-headings:text-purple-50 prose-headings:font-bold prose-headings:mt-2 prose-headings:mb-1
          prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-li:text-purple-50">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {thinking || ''}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}