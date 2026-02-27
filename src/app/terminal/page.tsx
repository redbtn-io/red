/**
 * Terminal Page - Interactive AI Terminal
 */
'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { Terminal as TerminalIcon, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { Terminal } from '@/components/terminal/Terminal';
import type { TerminalHandle, TerminalHistoryItem } from '@/components/terminal/Terminal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';

function TerminalPageContent() {
  const { user, loading: authLoading, refreshUser } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Terminal history state
  const terminalRef = useRef<TerminalHandle>(null);
  const [termHistoryItems, setTermHistoryItems] = useState<TerminalHistoryItem[]>([]);
  const [termHistoryLoading, setTermHistoryLoading] = useState(false);
  const [termDeletingId, setTermDeletingId] = useState<string | null>(null);

  const fetchTerminalHistory = useCallback(async () => {
    setTermHistoryLoading(true);
    try {
      const res = await fetch('/api/v1/conversations?source=terminal&limit=50', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const activeIds = new Set(terminalRef.current?.getActiveConversationIds() || []);
        const items: TerminalHistoryItem[] = (data.conversations || [])
          .filter((c: any) => !activeIds.has(c.id))
          .map((c: any) => ({
            id: c.id,
            conversationId: c.id,
            title: c.title || 'Terminal Session',
            messageCount: c.messageCount || 0,
            updatedAt: c.updatedAt || c.lastMessageAt,
            createdAt: c.createdAt,
          }));
        setTermHistoryItems(items);
      }
    } catch (err) {
      console.error('Failed to fetch terminal history:', err);
    } finally {
      setTermHistoryLoading(false);
    }
  }, []);

  // Fetch terminal history on mount
  useEffect(() => {
    fetchTerminalHistory();
  }, [fetchTerminalHistory]);

  const handleRestoreSession = (item: TerminalHistoryItem) => {
    const ok = terminalRef.current?.restoreSession(item.conversationId, item.title);
    if (ok) {
      setTermHistoryItems(prev => prev.filter(h => h.conversationId !== item.conversationId));
    }
  };

  const handleDeleteSession = async (convId: string) => {
    try {
      await fetch(`/api/v1/conversations/${convId}`, { method: 'DELETE', credentials: 'include' });
      setTermHistoryItems(prev => prev.filter(h => h.conversationId !== convId));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
    setTermDeletingId(null);
  };

  const formatHistoryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const terminalSidebarContent = (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-secondary">Session History</span>
        <button
          onClick={fetchTerminalHistory}
          className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {termHistoryLoading ? (
        <div className="py-4 text-center">
          <LoadingSpinner size={20} />
        </div>
      ) : termHistoryItems.length === 0 ? (
        <div className="py-4 text-center text-text-muted text-sm">
          No closed sessions
        </div>
      ) : (
        <div className="space-y-1">
          {termHistoryItems.map((item) => (
            <div
              key={item.conversationId}
              className="group rounded-lg transition-colors hover:bg-bg-secondary"
            >
              {termDeletingId === item.conversationId ? (
                <div className="p-2.5 space-y-2">
                  <p className="text-xs text-text-secondary">Delete this session?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteSession(item.conversationId)}
                      className="flex-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setTermDeletingId(null)}
                      className="flex-1 px-2 py-1 text-xs bg-bg-tertiary text-text-secondary rounded hover:bg-bg-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="p-2.5 cursor-pointer"
                  onClick={() => handleRestoreSession(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <TerminalIcon className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text-primary truncate">{item.title}</p>
                        <p className="text-xs text-text-muted mt-0.5">
                          {item.messageCount} msgs · {formatHistoryDate(item.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRestoreSession(item); }}
                        className="p-1 text-text-muted hover:text-accent-text rounded hover:bg-bg-tertiary transition-colors"
                        title="Restore session"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTermDeletingId(item.conversationId); }}
                        className="p-1 text-text-muted hover:text-red-400 rounded hover:bg-bg-tertiary transition-colors"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Auth states
  if (!authLoading && !user) {
    return (
      <LoginModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={async () => { await refreshUser(); }}
        canDismiss={false}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="flex h-app items-center justify-center bg-bg-primary">
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (user && !user.profileComplete) {
    return (
      <CompleteProfileModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
      />
    );
  }

  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      >
        {terminalSidebarContent}
      </AppSidebar>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title="Terminal"
          subtitle="Interactive command line"
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <main className="flex-1 overflow-hidden p-6">
          <Terminal
            ref={terminalRef}
            onTabClose={fetchTerminalHistory}
            initialGraphId="red-assistant"
          />
        </main>
      </div>
    </div>
  );
}

export default function TerminalPage() {
  return (
    <Suspense fallback={<LoadingSpinner mode="fullscreen" message="Loading terminal..." size={32} />}>
      <TerminalPageContent />
    </Suspense>
  );
}
