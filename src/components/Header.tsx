import { Menu, Plus } from 'lucide-react';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNewChat: () => void;
}

export function Header({ title, onMenuClick, onNewChat }: HeaderProps) {
  return (
    <div className="sticky top-0 z-40 bg-[#0f0f0f] border-b border-[#2a2a2a] px-4 py-3 flex items-center gap-3">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300"
      >
        <Menu size={24} />
      </button>
      <h1 className="text-lg font-semibold text-gray-100">
        {title}
      </h1>
      <button
        onClick={onNewChat}
        className="ml-auto p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300"
        title="New Chat"
      >
        <Plus size={20} />
      </button>
    </div>
  );
}
