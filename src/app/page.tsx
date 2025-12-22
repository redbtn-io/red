'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Workflow, 
  Zap,
  Clock,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Plus,
  Bot,
  TrendingUp,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { LoginModal } from '@/components/auth/LoginModal';
import { CompleteProfileModal } from '@/components/auth/CompleteProfileModal';
import { useAuth } from '@/contexts/AuthContext';
import { 
  pageVariants, 
  fadeUpVariants,
} from '@/lib/animations';

interface DashboardData {
  stats: {
    conversations: number;
    graphs: number;
    automations: number;
    activeAutomations: number;
    totalRuns: number;
    successRate: number;
  };
  recentConversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
    messageCount: number;
  }>;
  availableAgents: Array<{
    graphId: string;
    name: string;
    description?: string;
    isSystem: boolean;
    isDefault: boolean;
  }>;
  automationSummary: Array<{
    id: string;
    name: string;
    isEnabled: boolean;
    runCount: number;
    successCount: number;
    lastRunAt?: string;
  }>;
  recentRuns: Array<{
    id: string;
    automationId: string;
    status: string;
    durationMs?: number;
    startedAt: string;
  }>;
  user: {
    name: string;
    email: string;
    tier: number;
  };
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const runStatusIcons: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  running: <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />,
  pending: <Clock className="w-4 h-4 text-yellow-500" />,
};

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.profileComplete) {
      fetchDashboard();
    }
  }, [user]);

  async function fetchDashboard() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/v1/dashboard', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to load dashboard');
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  const handleLoginSuccess = async () => {
    await refreshUser();
  };

  const handleProfileComplete = () => {
    // Profile complete, data will reload
  };

  // Start new chat with optional graph
  const startNewChat = (graphId?: string) => {
    if (graphId) {
      router.push(`/chat?graph=${graphId}`);
    } else {
      router.push('/chat');
    }
  };

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
        <Loader2 className="w-8 h-8 text-white animate-spin" />
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
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <StudioHeader
          title="Dashboard"
          subtitle={`Welcome back${dashboardData?.user?.name ? `, ${dashboardData.user.name}` : ''}`}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto">
          <motion.div 
            className="max-w-6xl mx-auto px-4 py-8 pb-24"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-20">
                <p className="text-red-400 mb-4">{error}</p>
                <button 
                  onClick={fetchDashboard}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white hover:bg-[#2a2a2a]"
                >
                  Retry
                </button>
              </div>
            ) : dashboardData ? (
              <>
                {/* Stats Overview */}
                <motion.div 
                  className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
                  variants={fadeUpVariants}
                >
                  <Link href="/chat" className="group">
                    <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                          <MessageSquare className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-white">
                            {dashboardData.stats.conversations}
                          </div>
                          <div className="text-sm text-gray-400">Conversations</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <Link href="/studio" className="group">
                    <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                          <Workflow className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-white">
                            {dashboardData.stats.graphs}
                          </div>
                          <div className="text-sm text-gray-400">Graphs</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <Link href="/automations" className="group">
                    <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-yellow-500/20">
                          <Zap className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-white">
                            {dashboardData.stats.activeAutomations}/{dashboardData.stats.automations}
                          </div>
                          <div className="text-sm text-gray-400">Automations</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-white">
                          {dashboardData.stats.successRate}%
                        </div>
                        <div className="text-sm text-gray-400">Success</div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Quick Actions - Chat with Agents */}
                <motion.div className="mb-8" variants={fadeUpVariants}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-white">Start a Chat</h2>
                    <Link 
                      href="/chat" 
                      className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* New Chat button */}
                    <button
                      onClick={() => startNewChat()}
                      className="p-4 rounded-xl border border-dashed border-[#3a3a3a] bg-[#0f0f0f] hover:border-[#ef4444] hover:bg-[#1a1a1a] transition-all group text-left"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#ef4444]/20 group-hover:bg-[#ef4444]/30 transition-colors">
                          <Plus className="w-5 h-5 text-[#ef4444]" />
                        </div>
                        <div className="font-medium text-white">New Chat</div>
                      </div>
                      <p className="text-sm text-gray-500">Start a new conversation with the default agent</p>
                    </button>

                    {/* Agent Cards */}
                    {dashboardData.availableAgents.slice(0, 5).map((agent) => (
                      <button
                        key={agent.graphId}
                        onClick={() => startNewChat(agent.graphId)}
                        className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] hover:bg-[#252525] transition-all group text-left"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                            <Bot className="w-5 h-5 text-purple-500" />
                          </div>
                          <div>
                            <div className="font-medium text-white flex items-center gap-2">
                              {agent.name}
                              {agent.isDefault && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444]">Default</span>
                              )}
                            </div>
                            {agent.isSystem && (
                              <span className="text-xs text-gray-500">System</span>
                            )}
                          </div>
                        </div>
                        {agent.description && (
                          <p className="text-sm text-gray-500 line-clamp-2">{agent.description}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>

                {/* Two Column Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Recent Conversations */}
                  <motion.div variants={fadeUpVariants}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-white">Recent Conversations</h2>
                      <Link 
                        href="/chat" 
                        className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                      >
                        View all <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
                      {dashboardData.recentConversations.length === 0 ? (
                        <div className="p-8 text-center">
                          <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500">No conversations yet</p>
                          <button
                            onClick={() => startNewChat()}
                            className="mt-4 px-4 py-2 bg-[#ef4444] text-white rounded-lg text-sm hover:bg-[#dc2626] transition-colors"
                          >
                            Start your first chat
                          </button>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#2a2a2a]">
                          {dashboardData.recentConversations.map((conv) => (
                            <Link
                              key={conv.id}
                              href={`/chat?conversation=${conv.id}`}
                              className="flex items-center justify-between p-4 hover:bg-[#252525] transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-white truncate">{conv.title}</div>
                                <div className="text-sm text-gray-500">
                                  {conv.messageCount} messages
                                </div>
                              </div>
                              <div className="text-xs text-gray-500 ml-4">
                                {formatRelativeTime(conv.updatedAt)}
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Automations Overview */}
                  <motion.div variants={fadeUpVariants}>
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold text-white">Automations</h2>
                      <Link 
                        href="/automations" 
                        className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                      >
                        View all <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
                      {dashboardData.automationSummary.length === 0 ? (
                        <div className="p-8 text-center">
                          <Zap className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-500">No automations yet</p>
                          <Link
                            href="/automations/new"
                            className="inline-block mt-4 px-4 py-2 bg-[#ef4444] text-white rounded-lg text-sm hover:bg-[#dc2626] transition-colors"
                          >
                            Create your first automation
                          </Link>
                        </div>
                      ) : (
                        <div className="divide-y divide-[#2a2a2a]">
                          {dashboardData.automationSummary.map((auto) => (
                            <Link
                              key={auto.id}
                              href={`/automations/${auto.id}`}
                              className="flex items-center justify-between p-4 hover:bg-[#252525] transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${auto.isEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                                <div>
                                  <div className="font-medium text-white">{auto.name}</div>
                                  <div className="text-sm text-gray-500">
                                    {auto.runCount} runs • {auto.successCount} successful
                                  </div>
                                </div>
                              </div>
                              {auto.lastRunAt && (
                                <div className="text-xs text-gray-500">
                                  {formatRelativeTime(auto.lastRunAt)}
                                </div>
                              )}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Recent Runs */}
                {dashboardData.recentRuns.length > 0 && (
                  <motion.div className="mt-8" variants={fadeUpVariants}>
                    <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
                    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
                      <div className="divide-y divide-[#2a2a2a]">
                        {dashboardData.recentRuns.slice(0, 5).map((run) => (
                          <div
                            key={run.id}
                            className="flex items-center justify-between p-4"
                          >
                            <div className="flex items-center gap-3">
                              {runStatusIcons[run.status] || runStatusIcons.pending}
                              <div>
                                <div className="text-sm text-white">
                                  Automation run {run.status}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {run.durationMs ? `${(run.durationMs / 1000).toFixed(2)}s` : 'In progress'}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatRelativeTime(run.startedAt)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            ) : null}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
