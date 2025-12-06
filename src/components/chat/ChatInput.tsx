import { Send } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatInputProps {
  value: string;
  disabled: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  onSend: () => void;
  onScrollToBottom?: () => void;
}

export function ChatInput({ value, disabled, messagesEndRef, onChange, onSend, onScrollToBottom }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <motion.div 
      className="sticky bottom-0 z-40 bg-[#0f0f0f] border-t border-[#2a2a2a] py-3 px-4"
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
            className={`w-full resize-none bg-[#1a1a1a] border border-[#2a2a2a] text-gray-100 placeholder-gray-500 rounded-xl px-4 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all leading-tight block ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            rows={1}
            disabled={disabled}
          />
          {/* Helper hint visible on medium+ screens (absolute so it doesn't affect layout). Hidden when input has content */}
          <div className={`hidden md:block pointer-events-none absolute right-3 bottom-3 text-xs text-gray-500 px-2 py-0.5 rounded-md ${value ? 'opacity-0' : 'opacity-100'} transition-opacity bg-[#0f0f0f]`}>
            (Shift+Enter for new line)
          </div>
        </div>
        <motion.button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Send size={20} />
        </motion.button>
      </div>
    </motion.div>
  );
}
