/**
 * Terminal Page - Combined Logs and Interactive Terminal
 * Tab-based interface for viewing logs and running commands
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ScrollText, RefreshCw, MessageSquare } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { LogViewer } from '@/components/logging/LogViewer';
import { LogFilters } from '@/components/logging/LogFilters';
import { LogStats } from '@/components/logging/LogStats';
import { MockTerminal } from '@/components/terminal/MockTerminal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { pageVariants, fadeUpVariants } from '@/lib/animations';

type TabType = 'terminal' | 'logs';

interface LogConversation {
  conversationId: string;
  title?: string;
  lastLogTime: Date;
  logCount: number;
  generationCount: number;
}

function TerminalPageContent() {
  const searchParams = useSearchParams();
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
  const [logConversations, setLogConversations] = useState<LogConversation[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Set conversation from URL parameter on mount
  useEffect(() => {
    if (conversationParam && conversationParam !== 'undefined') {
      setConversationId(conversationParam);
      setActiveTab('logs');
    }
  }, [conversationParam]);

  // Fetch conversations with logs when on logs tab
  useEffect(() => {
    if (activeTab === 'logs') {
      fetchConversationsWithLogs();
    }
  }, [activeTab]);

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

  const switchConversation = (id: string) => {
    setConversationId(id);
    setGenerationId('');
    setIsSidebarOpen(false);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    if (activeTab === 'logs') {
      fetchConversationsWithLogs();
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
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-400">Conversations</span>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      
      {logsLoading ? (
        <div className="py-4 text-center">
          <LoadingSpinner size={20} />
        </div>
      ) : logConversations.length === 0 ? (
        <div className="py-4 text-center text-gray-500 text-sm">
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
                  ? 'bg-[#ef4444]/10 border border-[#ef4444]/30'
                  : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">
                  {conv.title || (conv.conversationId ? conv.conversationId.slice(0, 12) + '...' : 'Unknown')}
                </div>
                <div className="text-xs text-gray-500">
                  {conv.logCount} logs • {conv.generationCount} generations
                </div>
              </div>
            </button>
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
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
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
    <div className="flex h-screen bg-[#0a0a0a]">
      <AppSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      >
        {activeTab === 'logs' && logsSidebarContent}
      </AppSidebar>

      <div className="flex-1 flex flex-col overflow-hidden">
        <StudioHeader
          title="Terminal"
          subtitle={activeTab === 'terminal' ? 'Interactive command line' : 'View system logs'}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Tab Bar */}
        <div className="border-b border-[#2a2a2a] px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'terminal'
                  ? 'text-[#ef4444] border-[#ef4444]'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'text-[#ef4444] border-[#ef4444]'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              <ScrollText className="w-4 h-4" />
              Logs
              {isStreaming && activeTab === 'logs' && (
                <span className="w-2 h-2 bg-[#ef4444] rounded-full animate-pulse" />
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
                <MockTerminal />
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
                {/* Status Bar */}
                <motion.div className="mb-6 flex items-center justify-between" variants={fadeUpVariants}>
                  <p className="text-gray-400 text-sm">
                    Real-time logs from redbtn generations
                  </p>
                  {isStreaming && (
                    <motion.div 
                      className="flex items-center gap-2 px-4 py-2 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      <div className="w-2 h-2 bg-[#ef4444] rounded-full animate-pulse" />
                      <span className="text-[#ef4444] text-sm font-medium">LIVE</span>
                    </motion.div>
                  )}
                </motion.div>

                {/* Logs Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Filters & Stats */}
                  <motion.div className="lg:col-span-1 space-y-6" variants={fadeUpVariants}>
                    <LogFilters
                      conversationId={conversationId}
                      setConversationId={setConversationId}
                      generationId={generationId}
                      setGenerationId={setGenerationId}
                      filterLevel={filterLevel}
                      setFilterLevel={setFilterLevel}
                      filterCategory={filterCategory}
                      setFilterCategory={setFilterCategory}
                      showThoughts={showThoughts}
                      setShowThoughts={setShowThoughts}
                    />
                    <LogStats conversationId={conversationId} />
                  </motion.div>

                  {/* Log Viewer */}
                  <motion.div className="lg:col-span-3" variants={fadeUpVariants}>
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
                </div>
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
