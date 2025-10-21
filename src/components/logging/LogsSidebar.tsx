/**
 * Logs Sidebar - Shows conversations with logs
 * Only displays conversations that have logs in the database
 */
'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface LogConversation {
  conversationId: string;
  title?: string;
  lastLogTime: Date;
  logCount: number;
  generationCount: number;
}

interface LogsSidebarProps {
  isOpen: boolean;
  activeConversationId: string | null;
  onClose: () => void;
  onSwitchConversation: (id: string) => void;
  onRefresh?: () => void;
}

export function LogsSidebar({
  isOpen,
  activeConversationId,
  onClose,
  onSwitchConversation,
  onRefresh,
}: LogsSidebarProps) {
  const [conversations, setConversations] = useState<LogConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch conversations with logs
  useEffect(() => {
    fetchConversationsWithLogs();
  }, []);

  const fetchConversationsWithLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/logs/conversations');
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error('Failed to fetch conversations with logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchConversationsWithLogs();
    onRefresh?.();
  };

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
              onClick={handleRefresh}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Loading...' : 'Refresh Logs'}</span>
            </button>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-3">
            {error && (
              <div className="mb-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <p className="font-semibold mb-1">Error loading conversations</p>
                <p className="opacity-80 text-xs">{error}</p>
              </div>
            )}

            {!loading && !error && conversations.length === 0 && (
              <div className="text-center text-gray-500 py-8 px-4">
                <p className="mb-2">No logged conversations yet</p>
                <p className="text-xs">
                  Create a chat and run some queries to see logs here
                </p>
              </div>
            )}

            <div className="space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.conversationId}
                  className={`
                    relative rounded-lg transition-all group
                    ${activeConversationId === conv.conversationId
                      ? 'bg-[#1a1a1a] border border-[#2a2a2a]' 
                      : 'hover:bg-[#1a1a1a] border border-transparent'
                    }
                  `}
                >
                  <button
                    onClick={() => onSwitchConversation(conv.conversationId)}
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare size={16} className="mt-0.5 flex-shrink-0 text-gray-400" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate text-gray-200">
                          {conv.title || conv.conversationId.slice(0, 8)}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <span>{conv.logCount} logs</span>
                          <span>•</span>
                          <span>{conv.generationCount} gens</span>
                          <span>•</span>
                          <span>{formatRelativeTime(new Date(conv.lastLogTime))}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#2a2a2a] space-y-3">
            {/* Chat Link */}
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors group"
            >
              <MessageSquare size={16} className="text-gray-400 group-hover:text-[var(--red-primary)]" />
              <span className="text-sm text-gray-400 group-hover:text-[var(--foreground)]">
                Back to Chat
              </span>
            </Link>
            
            {/* Status */}
            <div className="flex items-center gap-2 text-xs text-gray-500 px-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Showing {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}</span>
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

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}
