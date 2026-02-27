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
      className="sticky bottom-4 pwa-bottom-adjust z-40 py-3 px-4 pb-safe"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
    >
      <div className="max-w-4xl mx-auto">
        <div 
          className="flex gap-3 items-end p-2 bg-bg-elevated rounded-2xl border border-border shadow-lg"
          style={{ boxShadow: 'var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1))' }}
        >
          <div className="flex-1 relative">
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
              className={`w-full resize-none bg-transparent text-text-primary placeholder-text-muted rounded-xl px-3 pr-12 py-2.5 focus:outline-none transition-all leading-relaxed text-[15px] ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              rows={1}
              disabled={disabled}
            />
            {/* Helper hint visible on medium+ screens */}
            <div className={`hidden md:block pointer-events-none absolute right-2 bottom-2.5 text-xs text-text-muted ${value ? 'opacity-0' : 'opacity-60'} transition-opacity`}>
              Shift+Enter ↵
            </div>
          </div>
        
          {/* Show Graph button when streaming, Send button otherwise */}
          {isStreaming && onViewGraph ? (
            <motion.button
              onClick={onViewGraph}
              className="p-3 bg-accent text-white rounded-xl hover:bg-accent-hover transition-all flex items-center justify-center shadow-md"
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
              className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-bg-tertiary disabled:text-text-disabled disabled:cursor-not-allowed transition-all flex items-center justify-center"
              style={{ 
                boxShadow: (!value.trim() || disabled) ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)' 
              }}
              whileHover={{ scale: (!value.trim() || disabled) ? 1 : 1.02 }}
              whileTap={{ scale: (!value.trim() || disabled) ? 1 : 0.98 }}
            >
              <Send size={20} />
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
