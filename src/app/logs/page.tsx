/**
 * Terminal Page - Combined Logs and Interactive Terminal
 * Tab-based interface for viewing logs and running commands
 */
'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal as TerminalIcon, ScrollText, RefreshCw, MessageSquare, Zap, RotateCcw, Trash2 } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { LogViewer } from '@/components/logging/LogViewer';
import { Terminal } from '@/components/terminal/Terminal';
import type { TerminalHandle, TerminalHistoryItem } from '@/components/terminal/Terminal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { pageVariants, fadeUpVariants } from '@/lib/animations';

type TabType = 'terminal' | 'logs';
type LogSourceType = 'conversations' | 'automations';

interface LogConversation {
  conversationId: string;
  title?: string;
  lastLogTime: Date;
  logCount: number;
  generationCount: number;
}

interface LogAutomation {
  automationId: string;
  name: string;
  graphId: string;
  lastRunAt?: Date;
  runCount: number;
}

interface AutomationRun {
  runId: string;
  automationId: string;
  status: string;
  triggeredBy: string;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
  logs?: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error' | 'debug';
    message: string;
    metadata?: Record<string, any>;
  }>;
}

function TerminalPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const conversationParam = searchParams.get('conversation');
  const tabParam = searchParams.get('tab') as TabType | null;
  
  const { user, loading: authLoading, refreshUser } = useAuth();
  
  const [activeTab, setActiveTab] = useState<TabType>(tabParam || 'terminal');
  const [conversationId, setConversationId] = useState('');
  const [generationId, setGenerationId] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showThoughts, setShowThoughts] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // Logs sidebar state
  const [logSource, setLogSource] = useState<LogSourceType>('conversations');
  const [logConversations, setLogConversations] = useState<LogConversation[]>([]);
  const [logAutomations, setLogAutomations] = useState<LogAutomation[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Automation runs state
  const [selectedAutomation, setSelectedAutomation] = useState<LogAutomation | null>(null);
  const [automationRuns, setAutomationRuns] = useState<AutomationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);

  // Terminal history state
  const terminalRef = useRef<TerminalHandle>(null);
  const [termHistoryItems, setTermHistoryItems] = useState<TerminalHistoryItem[]>([]);
  const [termHistoryLoading, setTermHistoryLoading] = useState(false);
  const [termDeletingId, setTermDeletingId] = useState<string | null>(null);

  // Set conversation from URL parameter on mount
  useEffect(() => {
    if (conversationParam && conversationParam !== 'undefined') {
      setConversationId(conversationParam);
      setActiveTab('logs');
    }
  }, [conversationParam]);

  // Fetch data based on log source when on logs tab
  useEffect(() => {
    if (activeTab === 'logs') {
      if (logSource === 'conversations') {
        fetchConversationsWithLogs();
      } else if (logSource === 'automations') {
        fetchAutomationsWithLogs();
      }
    }
  }, [activeTab, logSource]);

  const fetchConversationsWithLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch('/api/v1/logs/conversations', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLogConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations with logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const fetchAutomationsWithLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch('/api/v1/automations?hasRuns=true', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setLogAutomations((data.automations || []).map((a: any) => ({
          automationId: a.automationId,
          name: a.name,
          graphId: a.graphId,
          lastRunAt: a.lastRunAt,
          runCount: a.stats?.runCount || 0,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch automations with logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Logs page no longer shows graph viewer inline; redirects to automation detail page

  const switchConversation = (id: string) => {
    setConversationId(id);
    setGenerationId('');
    // Clear automation selection when switching to conversation
    setSelectedAutomation(null);
    setSelectedRun(null);
    setAutomationRuns([]);
    setIsSidebarOpen(false);
  };

  const fetchAutomationRuns = async (automationId: string) => {
    setRunsLoading(true);
    try {
      const response = await fetch(`/api/v1/automations/${automationId}/runs?limit=50`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAutomationRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Failed to fetch automation runs:', err);
    } finally {
      setRunsLoading(false);
    }
  };

  const fetchRunDetails = async (automationId: string, runId: string) => {
    try {
      const response = await fetch(`/api/v1/automations/${automationId}/runs/${runId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedRun(data.run);
      }
    } catch (err) {
      console.error('Failed to fetch run details:', err);
    }
  };

  const switchAutomation = async (automation: LogAutomation) => {
    // Clear conversation selection
    setConversationId('');
    setGenerationId('');
    // Set selected automation and fetch its runs
    setSelectedAutomation(automation);
    setSelectedRun(null);
    setIsSidebarOpen(false);
    await fetchAutomationRuns(automation.automationId);
  };

  const selectRun = async (run: AutomationRun) => {
    // Fetch full run details including logs
    await fetchRunDetails(selectedAutomation!.automationId, run.runId);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    if (activeTab === 'logs') {
      if (logSource === 'conversations') {
        fetchConversationsWithLogs();
      } else if (logSource === 'automations') {
        fetchAutomationsWithLogs();
      }
    }
  };

  const handleLoginSuccess = async () => {
    await refreshUser();
  };

  const handleProfileComplete = () => {
    // Profile complete
  };

  // Sidebar content for logs view
  const logsSidebarContent = (
    <div className="p-3 space-y-2">
      {/* Source Toggle */}
      <div className="flex items-center gap-1 p-1 bg-bg-secondary rounded-lg mb-3">
        <button
          onClick={() => setLogSource('conversations')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            logSource === 'conversations' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <MessageSquare className="w-3 h-3" />
          Chats
        </button>
        <button
          onClick={() => setLogSource('automations')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
            logSource === 'automations' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          <Zap className="w-3 h-3" />
          Automations
        </button>
      </div>
      
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-secondary">
          {logSource === 'conversations' ? 'Conversations' : 'Automations'}
        </span>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {logsLoading ? (
        <div className="py-4 text-center">
          <LoadingSpinner size={20} />
        </div>
      ) : logSource === 'conversations' ? (
        logConversations.length === 0 ? (
          <div className="py-4 text-center text-text-muted text-sm">
            No conversations with logs
          </div>
        ) : (
          <div className="space-y-1">
            {logConversations.map((conv) => (
              <button
                key={conv.conversationId}
                onClick={() => switchConversation(conv.conversationId)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  conversationId === conv.conversationId
                    ? 'bg-accent/10 border border-accent/30'
                    : 'hover:bg-bg-secondary'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">
                    {conv.title || (conv.conversationId ? conv.conversationId.slice(0, 12) + '...' : 'Unknown')}
                  </div>
                  <div className="text-xs text-text-muted">
                    {conv.logCount} logs • {conv.generationCount} generations
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      ) : (
        logAutomations.length === 0 ? (
          <div className="py-4 text-center text-text-muted text-sm">
            No automations with runs
          </div>
        ) : (
          <div className="space-y-1">
            {logAutomations.map((automation) => (
              <button
                key={automation.automationId}
                onClick={() => switchAutomation(automation)}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors ${
                  selectedAutomation?.automationId === automation.automationId
                    ? 'bg-accent/10 border border-accent/30'
                    : 'hover:bg-bg-secondary'
                }`}
              >
                <Zap className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary truncate">
                    {automation.name}
                  </div>
                  <div className="text-xs text-text-muted">
                    {automation.runCount} runs
                    {automation.lastRunAt && ` • ${new Date(automation.lastRunAt).toLocaleDateString()}`}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );

  // --- Terminal history sidebar ---

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

  // Fetch terminal history when switching to terminal tab
  useEffect(() => {
    if (activeTab === 'terminal') {
      fetchTerminalHistory();
    }
  }, [activeTab, fetchTerminalHistory]);

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
        onSuccess={handleLoginSuccess}
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
        onSuccess={handleProfileComplete}
      />
    );
  }

  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      >
        {activeTab === 'terminal' && terminalSidebarContent}
        {activeTab === 'logs' && logsSidebarContent}
      </AppSidebar>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title="Terminal"
          subtitle={activeTab === 'terminal' ? 'Interactive command line' : 'View system logs'}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Tab Bar */}
        <div className="border-b border-border px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'terminal'
                  ? 'text-accent-text border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
            >
              <TerminalIcon className="w-4 h-4" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'text-accent-text border-accent'
                  : 'text-text-secondary border-transparent hover:text-text-primary'
              }`}
            >
              <ScrollText className="w-4 h-4" />
              Logs
              {isStreaming && activeTab === 'logs' && (
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'terminal' ? (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full p-6"
              >
                <Terminal ref={terminalRef}
                onTabClose={fetchTerminalHistory} initialGraphId="red-assistant" />
              </motion.div>
            ) : (
              <motion.div
                key="logs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full overflow-y-auto p-6"
                variants={pageVariants}
              >
                {/* Show logs content or selection prompt */}
                {conversationId ? (
                  <>
                    {/* Status Bar when viewing logs */}
                    <motion.div className="mb-6 flex items-center justify-between" variants={fadeUpVariants}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setConversationId('')}
                          className="text-text-muted hover:text-text-primary transition-colors"
                        >
                          ← Back
                        </button>
                        <div>
                          <p className="text-text-primary font-medium">
                            {logConversations.find(c => c.conversationId === conversationId)?.title || conversationId.slice(0, 20) + '...'}
                          </p>
                          <p className="text-text-muted text-xs">
                            Viewing logs for this conversation
                          </p>
                        </div>
                      </div>
                      {isStreaming && (
                        <motion.div 
                          className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/30 rounded-lg"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                        >
                          <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                          <span className="text-accent-text text-sm font-medium">LIVE</span>
                        </motion.div>
                      )}
                    </motion.div>

                    {/* Compact filter bar */}
                    <motion.div className="mb-4 flex items-center gap-4 flex-wrap" variants={fadeUpVariants}>
                      <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="px-3 py-1.5 bg-bg-secondary border border-border rounded text-sm text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="all">All Levels</option>
                        <option value="debug">Debug</option>
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                      </select>
                      <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="px-3 py-1.5 bg-bg-secondary border border-border rounded text-sm text-text-secondary focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        <option value="all">All Categories</option>
                        <option value="graph">Graph</option>
                        <option value="node">Node</option>
                        <option value="llm">LLM</option>
                        <option value="tool">Tool</option>
                        <option value="context">Context</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showThoughts}
                          onChange={(e) => setShowThoughts(e.target.checked)}
                          className="w-4 h-4 rounded border-border bg-bg-secondary"
                        />
                        Show Thoughts
                      </label>
                    </motion.div>

                    {/* Log Viewer - Full Width */}
                    <motion.div variants={fadeUpVariants}>
                      <LogViewer
                        key={refreshKey}
                        conversationId={conversationId}
                        generationId={generationId}
                        filterLevel={filterLevel}
                        filterCategory={filterCategory}
                        showThoughts={showThoughts}
                        onStreamingChange={setIsStreaming}
                      />
                    </motion.div>
                  </>
                ) : selectedAutomation ? (
                  /* Automation runs view */
                  <>
                    {/* Status Bar for automation */}
                    <motion.div className="mb-6 flex items-center justify-between" variants={fadeUpVariants}>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (selectedRun) {
                              setSelectedRun(null);
                            } else {
                              setSelectedAutomation(null);
                              setAutomationRuns([]);
                            }
                          }}
                          className="text-text-muted hover:text-text-primary transition-colors"
                        >
                          ← Back
                        </button>
                        <div>
                          <p className="text-text-primary font-medium">
                            {selectedAutomation.name}
                            {selectedRun && ` › Run ${selectedRun.runId.slice(0, 8)}...`}
                          </p>
                          <p className="text-text-muted text-xs">
                            {selectedRun ? 'Viewing run logs' : `${automationRuns.length} runs`}
                          </p>
                        </div>
                      </div>
                    </motion.div>

                    {selectedRun ? (
                      /* Show run logs */
                      <motion.div variants={fadeUpVariants} className="space-y-4">
                        {/* Run summary */}
                        <div className="bg-bg-secondary rounded-lg p-4 border border-border">
                          <div className="flex items-center justify-between mb-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              selectedRun.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                              selectedRun.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                              selectedRun.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {selectedRun.status.toUpperCase()}
                            </span>
                            {selectedRun.durationMs && (
                              <span className="text-text-muted text-xs">
                                Duration: {(selectedRun.durationMs / 1000).toFixed(2)}s
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-text-muted">Triggered by:</span>
                              <span className="ml-2 text-text-primary">{selectedRun.triggeredBy}</span>
                            </div>
                            <div>
                              <span className="text-text-muted">Started:</span>
                              <span className="ml-2 text-text-primary">
                                {new Date(selectedRun.startedAt).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {selectedRun.error && (
                            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
                              {selectedRun.error}
                            </div>
                          )}
                        </div>

                        {/* Run logs */}
                        <div className="bg-bg-primary rounded-lg border border-border overflow-hidden">
                          <div className="px-4 py-2 bg-bg-secondary border-b border-border flex items-center justify-between">
                            <span className="text-sm font-medium text-text-primary">Run Logs</span>
                            <span className="text-xs text-text-muted">
                              {selectedRun.logs?.length || 0} entries
                            </span>
                          </div>
                          <div className="max-h-[500px] overflow-y-auto p-2 space-y-1 font-mono text-xs">
                            {selectedRun.logs && selectedRun.logs.length > 0 ? (
                              selectedRun.logs.map((log, idx) => (
                                <div
                                  key={idx}
                                  className={`px-2 py-1 rounded ${
                                    log.level === 'error' ? 'bg-red-500/10 text-red-400' :
                                    log.level === 'warn' ? 'bg-yellow-500/10 text-yellow-400' :
                                    log.level === 'debug' ? 'bg-gray-500/10 text-text-muted' :
                                    'text-text-secondary'
                                  }`}
                                >
                                  <span className="text-text-muted">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span className={`mx-2 uppercase text-[10px] ${
                                    log.level === 'error' ? 'text-red-400' :
                                    log.level === 'warn' ? 'text-yellow-400' :
                                    log.level === 'debug' ? 'text-gray-400' :
                                    'text-blue-400'
                                  }`}>
                                    [{log.level}]
                                  </span>
                                  <span>{log.message}</span>
                                </div>
                              ))
                            ) : (
                              <div className="text-center text-text-muted py-4">
                                No logs recorded for this run
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Input/Output */}
                        {(selectedRun.input || selectedRun.output) && (
                          <div className={`grid gap-4 ${
                            selectedRun.input && Object.keys(selectedRun.input).length > 0 && 
                            selectedRun.output && Object.keys(selectedRun.output).length > 0 
                              ? 'grid-cols-1 lg:grid-cols-2' 
                              : 'grid-cols-1'
                          }`}>
                            {selectedRun.input && Object.keys(selectedRun.input).length > 0 && (
                              <div className="bg-bg-secondary rounded-lg border border-border p-4 overflow-hidden">
                                <h4 className="text-sm font-medium text-text-primary mb-2">Input</h4>
                                <pre className="text-xs text-text-secondary overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
                                  {JSON.stringify(selectedRun.input, null, 2)}
                                </pre>
                              </div>
                            )}
                            {selectedRun.output && Object.keys(selectedRun.output).length > 0 && (
                              <div className="bg-bg-secondary rounded-lg border border-border p-4 overflow-hidden">
                                <h4 className="text-sm font-medium text-text-primary mb-2">Output</h4>
                                <pre className="text-xs text-text-secondary overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
                                  {JSON.stringify(selectedRun.output, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      /* Show runs list */
                      <motion.div variants={fadeUpVariants}>
                        {runsLoading ? (
                          <div className="flex justify-center py-8">
                            <LoadingSpinner size={24} />
                          </div>
                        ) : automationRuns.length === 0 ? (
                          <div className="text-center py-8 text-text-muted">
                            No runs found for this automation
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {automationRuns.map((run) => (
                              <button
                                key={run.runId}
                                onClick={() => selectRun(run)}
                                className="w-full flex items-center gap-4 p-4 bg-bg-secondary rounded-lg border border-border hover:border-accent/50 transition-colors text-left"
                              >
                                <div className={`w-3 h-3 rounded-full ${
                                  run.status === 'completed' ? 'bg-green-400' :
                                  run.status === 'failed' ? 'bg-red-400' :
                                  run.status === 'running' ? 'bg-blue-400 animate-pulse' :
                                  'bg-yellow-400'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-text-primary">
                                      {run.runId.slice(0, 12)}...
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                      run.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                      run.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                      run.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {run.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-text-muted mt-0.5">
                                    {new Date(run.startedAt).toLocaleString()}
                                    {run.durationMs && ` • ${(run.durationMs / 1000).toFixed(2)}s`}
                                  </div>
                                </div>
                                <span className="text-text-muted text-xs">
                                  {run.triggeredBy}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </>
                ) : (
                  /* Empty state - prompt to select */
                  <motion.div 
                    className="h-full flex flex-col items-center justify-center text-center"
                    variants={fadeUpVariants}
                  >
                    <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
                      <ScrollText className="w-8 h-8 text-text-muted" />
                    </div>
                    <h3 className="text-lg font-medium text-text-primary mb-2">
                      Select a Conversation or Automation
                    </h3>
                    <p className="text-text-muted text-sm max-w-md mb-6">
                      Choose a conversation or automation from the sidebar to view its logs and execution history.
                    </p>
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors text-sm font-medium"
                    >
                      Open Sidebar
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
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
