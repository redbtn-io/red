/**
 * Logs Page - Virtual Terminal for redbtn
 * View real-time logs with filtering and statistics
 */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { LogsSidebar } from '@/components/logging/LogsSidebar';
import { LogViewer } from '@/components/logging/LogViewer';
import { LogFilters } from '@/components/logging/LogFilters';
import { LogStats } from '@/components/logging/LogStats';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { pageVariants, staggerItemVariants } from '@/lib/animations';

function LogsPageContent() {
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get('conversation');
  
  const [conversationId, setConversationId] = useState('');
  const [generationId, setGenerationId] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showThoughts, setShowThoughts] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Set conversation from URL parameter on mount
  useEffect(() => {
    if (conversationParam && conversationParam !== 'undefined') {
      setConversationId(conversationParam);
    }
  }, [conversationParam]);

  const switchConversation = (id: string) => {
    setConversationId(id);
    setGenerationId(''); // Clear generation when switching conversations
    setIsSidebarOpen(false);
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="flex bg-[var(--background)]" style={{ height: 'calc(var(--vh, 1vh) * 100)' }}>
      {/* Logs Sidebar */}
      <LogsSidebar
        isOpen={isSidebarOpen}
        activeConversationId={conversationId}
        onClose={() => setIsSidebarOpen(false)}
        onSwitchConversation={switchConversation}
        onRefresh={handleRefresh}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          title="📝 Virtual Terminal"
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          onNewChat={() => {}}
        />

        {/* Logs Content */}
        <motion.div 
          className="flex-1 overflow-y-auto p-6"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
        >
          {/* Status Bar */}
          <motion.div className="mb-6 flex items-center justify-between" variants={staggerItemVariants}>
            <div>
              <p className="text-[var(--foreground)] text-sm opacity-70">
                Real-time logs from redbtn generations
              </p>
            </div>
            {isStreaming && (
              <motion.div 
                className="flex items-center gap-2 px-4 py-2 bg-[var(--red-primary)]/10 border border-[var(--red-primary)]/30 rounded-lg"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <div className="w-2 h-2 bg-[var(--red-primary)] rounded-full animate-pulse"></div>
                <span className="text-[var(--red-primary)] text-sm font-medium">LIVE</span>
              </motion.div>
            )}
          </motion.div>

          {/* Main Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Filters & Stats Sidebar */}
            <motion.div 
              className="lg:col-span-1 space-y-6"
              variants={staggerItemVariants}
            >
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

            {/* Main Log Viewer */}
            <motion.div className="lg:col-span-3" variants={staggerItemVariants}>
              <LogViewer
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
      </div>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={<LoadingSpinner mode="fullscreen" message="Loading logs..." size={32} />}>
      <LogsPageContent />
    </Suspense>
  );
}
