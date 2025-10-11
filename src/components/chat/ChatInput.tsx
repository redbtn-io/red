import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  disabled: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onChange: (value: string) => void;
  onSend: () => void;
}

export function ChatInput({ value, disabled, messagesEndRef, onChange, onSend }: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="sticky bottom-0 z-40 bg-[#0f0f0f] border-t border-[#2a2a2a] py-3 px-4">
      <div className="max-w-4xl mx-auto flex gap-3 items-center">
        <div className="flex-1 relative inline-block">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              // On mobile, keyboard may resize viewport; scroll after a short delay
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 300);
            }}
            placeholder="Type your message..."
            className="w-full resize-none bg-[#1a1a1a] border border-[#2a2a2a] text-gray-100 placeholder-gray-500 rounded-xl px-4 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all leading-tight block"
            rows={1}
            disabled={disabled}
          />
          {/* Helper hint visible on medium+ screens (absolute so it doesn't affect layout). Hidden when input has content */}
          <div className={`hidden md:block pointer-events-none absolute right-3 bottom-3 text-xs text-gray-500 px-2 py-0.5 rounded-md ${value ? 'opacity-0' : 'opacity-100'} transition-opacity bg-[#0f0f0f]`}>
            (Shift+Enter for new line)
          </div>
        </div>
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="px-6 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium shadow-lg"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
