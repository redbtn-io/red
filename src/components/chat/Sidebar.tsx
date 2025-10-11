import { Plus, MessageSquare, Trash2, Edit2, Check, X, Terminal } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { type Conversation } from '@/lib/storage/conversation';

interface SidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  editingTitleId: string | null;
  editingTitleValue: string;
  onClose: () => void;
  onNewChat: () => void;
  onSwitchConversation: (id: string) => void;
  onDeleteClick: (id: string, event: React.MouseEvent) => void;
  onStartEditingTitle: (conv: Conversation, event: React.MouseEvent) => void;
  onSaveEditedTitle: (conversationId: string) => void;
  onCancelEditingTitle: () => void;
  onEditingTitleChange: (value: string) => void;
}

export function Sidebar({
  isOpen,
  conversations,
  activeConversationId,
  editingTitleId,
  editingTitleValue,
  onClose,
  onNewChat,
  onSwitchConversation,
  onDeleteClick,
  onStartEditingTitle,
  onSaveEditedTitle,
  onCancelEditingTitle,
  onEditingTitleChange
}: SidebarProps) {
  return (
    <>
      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#0f0f0f] border-r border-[#2a2a2a] text-white transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="p-4 border-b border-[#2a2a2a]">
            <Link href="/" className="flex items-center gap-2 mb-4 no-underline hover:opacity-90">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                <Image 
                  src="/logo.png" 
                  alt="Red" 
                  width={32} 
                  height={32}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-lg font-semibold">redbtn</span>
            </Link>
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg transition-colors font-medium"
            >
              <Plus size={18} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-1">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`
                    relative rounded-lg transition-all group
                    ${conv.id === activeConversationId 
                      ? 'bg-[#1a1a1a] border border-[#2a2a2a]' 
                      : 'hover:bg-[#1a1a1a] border border-transparent'
                    }
                  `}
                >
                  <button
                    onClick={() => onSwitchConversation(conv.id)}
                    className="w-full text-left px-3 py-2.5"
                    disabled={editingTitleId === conv.id}
                  >
                    <div className="flex items-start gap-2 pr-16">
                      <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        {editingTitleId === conv.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingTitleValue}
                              onChange={(e) => onEditingTitleChange(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') onSaveEditedTitle(conv.id);
                                if (e.key === 'Escape') onCancelEditingTitle();
                              }}
                              className="flex-1 text-base font-medium bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-red-500"
                              autoFocus
                            />
                            <button
                              onClick={() => onSaveEditedTitle(conv.id)}
                              className="p-1 hover:bg-[#2a2a2a] rounded text-green-400 hover:text-green-300"
                              title="Save"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={onCancelEditingTitle}
                              className="p-1 hover:bg-[#2a2a2a] rounded text-gray-400 hover:text-gray-300"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="text-sm font-medium truncate text-gray-200">{conv.title}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-0.5">
                          {conv.messages.length} {conv.messages.length === 1 ? 'message' : 'messages'}
                        </div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Action Buttons */}
                  {editingTitleId !== conv.id && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => onStartEditingTitle(conv, e)}
                        className="p-2 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-blue-400"
                        title="Edit title"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={(e) => onDeleteClick(conv.id, e)}
                        className="p-2 hover:bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-red-400"
                        title="Delete conversation"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#2a2a2a] space-y-3">
            {/* Logs Link */}
            <Link
              href="/logs"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors group"
            >
              <Terminal size={16} className="text-gray-400 group-hover:text-[var(--red-primary)]" />
              <span className="text-sm text-gray-400 group-hover:text-[var(--foreground)]">
                Virtual Terminal
              </span>
            </Link>
            
            {/* Status */}
            <div className="flex items-center gap-2 text-xs text-gray-500 px-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Red Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}
