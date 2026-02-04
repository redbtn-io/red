'use client';

import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { type Conversation } from '@/lib/storage/conversation';

// ConversationSummary is compatible with Conversation (just subset of fields)
type ConversationItem = Conversation | {
  id: string;
  title: string;
  lastMessageAt?: Date | number;
  messageCount?: number;
  isArchived?: boolean;
  createdAt?: Date | number;
  updatedAt?: Date | number;
};

interface SidebarProps {
  isOpen: boolean;
  conversations: ConversationItem[];
  activeConversationId: string | null;
  editingTitleId: string | null;
  editingTitleValue: string;
  onClose: () => void;
  onNewChat: () => void;
  onSwitchConversation: (id: string) => void;
  onDeleteClick: (id: string, event: React.MouseEvent) => void;
  onStartEditingTitle: (conv: ConversationItem, event: React.MouseEvent) => void;
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
    <AppSidebar
      isOpen={isOpen}
      onClose={onClose}
      headerAction={
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors font-medium shadow-sm"
          style={{ boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)' }}
        >
          <Plus size={18} />
          <span>New Chat</span>
        </button>
      }
    >
      {/* Conversations List */}
      <div className="p-3">
        <div className="space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`
                relative rounded-xl transition-all group
                ${conv.id === activeConversationId 
                  ? 'bg-red-500/10 dark:bg-red-500/15 border border-red-500/30 shadow-sm' 
                  : 'hover:bg-bg-hover border border-transparent hover:border-border/50'
                }
              `}
            >
              <button
                onClick={() => onSwitchConversation(conv.id)}
                className="w-full text-left px-3 py-2.5"
                disabled={editingTitleId === conv.id}
              >
                <div className="flex items-start gap-2.5 pr-16">
                  <MessageSquare 
                    size={16} 
                    className={`mt-0.5 flex-shrink-0 ${
                      conv.id === activeConversationId 
                        ? 'text-red-500' 
                        : 'text-text-muted'
                    }`} 
                  />
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
                          className="flex-1 text-base font-medium bg-bg-elevated border border-border rounded-lg px-2 py-1 text-text-primary focus:outline-none focus:border-red-500"
                          autoFocus
                        />
                        <button
                          onClick={() => onSaveEditedTitle(conv.id)}
                          className="p-1.5 hover:bg-bg-tertiary rounded-lg text-green-500 hover:text-green-600"
                          title="Save"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={onCancelEditingTitle}
                          className="p-1.5 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-text-secondary"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className={`text-sm font-medium truncate ${
                        conv.id === activeConversationId 
                          ? 'text-red-600 dark:text-red-400 font-semibold' 
                          : 'text-text-primary'
                      }`}>
                        {conv.title}
                      </div>
                    )}
                    <div className="text-xs text-text-muted mt-0.5">
                      {('messageCount' in conv ? conv.messageCount : 'messages' in conv ? conv.messages?.length : 0) || 0} messages
                    </div>
                  </div>
                </div>
              </button>
              
              {/* Action Buttons */}
              {editingTitleId !== conv.id && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => onStartEditingTitle(conv, e)}
                    className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-info"
                    title="Edit title"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={(e) => onDeleteClick(conv.id, e)}
                    className="p-2 hover:bg-bg-tertiary rounded-lg text-text-muted hover:text-error"
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
    </AppSidebar>
  );
}
