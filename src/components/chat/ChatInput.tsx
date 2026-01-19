import { Send, GitBranch } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  value: string;
  disabled: boolean;
  isStreaming?: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  onSend: () => void;
  onScrollToBottom?: () => void;
  onViewGraph?: () => void;
}

export function ChatInput({ 
  value, 
  disabled, 
  isStreaming = false,
  messagesEndRef, 
  onChange, 
  onSend, 
  onScrollToBottom,
  onViewGraph,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <motion.div 
      className="sticky bottom-4 pwa-bottom-adjust z-40 bg-bg-elevated border-t border-border py-3 px-4 pb-safe"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
    >
      <div className="max-w-4xl mx-auto flex gap-3 items-center">
        <div className="flex-1 relative inline-block">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // On mobile, keyboard may resize viewport; scroll after a short delay
              if (onScrollToBottom) {
                setTimeout(() => {
                  onScrollToBottom();
                }, 300);
              } else {
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                }, 300);
              }
            }}
            placeholder={disabled ? "Generating response..." : "Type your message..."}
            className={`w-full resize-none bg-bg-secondary border border-border text-text-primary placeholder-text-muted rounded-xl px-4 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all leading-tight block ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            rows={1}
            disabled={disabled}
          />
          {/* Helper hint visible on medium+ screens (absolute so it doesn't affect layout). Hidden when input has content */}
          <div className={`hidden md:block pointer-events-none absolute right-3 bottom-3 text-xs text-text-muted px-2 py-0.5 rounded-md ${value ? 'opacity-0' : 'opacity-100'} transition-opacity bg-bg-elevated`}>
            (Shift+Enter for new line)
          </div>
        </div>
        
        {/* Show Graph button when streaming, Send button otherwise */}
        {isStreaming && onViewGraph ? (
          <motion.button
            onClick={onViewGraph}
            className="px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-all flex items-center gap-2 font-medium shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            title="View Graph"
          >
            <GitBranch size={20} className="animate-pulse" />
          </motion.button>
        ) : (
          <motion.button
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-bg-tertiary disabled:text-text-disabled disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Send size={20} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
