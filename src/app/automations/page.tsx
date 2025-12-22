'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Plus, 
  Play, 
  Pause, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ArrowRight,
  Calendar,
  Webhook,
  MousePointer,
  Radio,
  MoreVertical,
  Trash2,
  Settings,
  BarChart3,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { 
  pageVariants, 
  staggerContainerVariants, 
  staggerItemVariants,
  fadeUpVariants,
} from '@/lib/animations';

interface AutomationSummary {
  automationId: string;
  name: string;
  description?: string;
  graphId: string;
  trigger: {
    type: 'webhook' | 'schedule' | 'event' | 'manual';
    config?: Record<string, any>;
  };
  status: 'active' | 'paused' | 'disabled' | 'error';
  isEnabled: boolean;
  stats: {
    runCount: number;
    successCount: number;
    failureCount: number;
  };
  lastRunAt?: string;
  createdAt: string;
}

interface AutomationRun {
  runId: string;
  automationId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  triggeredBy: string;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
}

const triggerIcons = {
  webhook: Webhook,
  schedule: Calendar,
  event: Radio,
  manual: MousePointer,
};

const triggerLabels = {
  webhook: 'Webhook',
  schedule: 'Scheduled',
  event: 'Event',
  manual: 'Manual',
};

const statusColors = {
  active: '#22c55e',
  paused: '#f59e0b',
  disabled: '#6b7280',
  error: '#ef4444',
};

/**
 * Automations Page
 * 
 * Manage automation configurations for running graphs automatically.
 */
export default function AutomationsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [automations, setAutomations] = useState<AutomationSummary[]>([]);
  const [recentRuns, setRecentRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchAutomations();
  }, []);

  async function fetchAutomations() {
    try {
      const res = await fetch('/api/v1/automations');
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.automations || []);
      }
    } catch (err) {
      console.error('Error fetching automations:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTrigger(automationId: string) {
    setTriggeringId(automationId);
    try {
      const res = await fetch(`/api/v1/automations/${automationId}/trigger`, {
        method: 'POST',
      });
      if (res.ok) {
        // Refresh to get updated stats
        await fetchAutomations();
      }
    } catch (err) {
      console.error('Error triggering automation:', err);
    } finally {
      setTriggeringId(null);
    }
  }

  async function handleToggle(automationId: string, currentEnabled: boolean) {
    const endpoint = currentEnabled ? 'disable' : 'enable';
    try {
      const res = await fetch(`/api/v1/automations/${automationId}/${endpoint}`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchAutomations();
      }
    } catch (err) {
      console.error('Error toggling automation:', err);
    }
    setActionMenuId(null);
  }

  async function handleDelete(automationId: string) {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    try {
      const res = await fetch(`/api/v1/automations/${automationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchAutomations();
      }
    } catch (err) {
      console.error('Error deleting automation:', err);
    }
    setActionMenuId(null);
  }

  const totalRuns = automations.reduce((sum, a) => sum + a.stats.runCount, 0);
  const totalSuccess = automations.reduce((sum, a) => sum + a.stats.successCount, 0);
  const totalFailures = automations.reduce((sum, a) => sum + a.stats.failureCount, 0);
  const activeCount = automations.filter(a => a.isEnabled).length;

  return (
    <div className="flex h-full">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <StudioHeader
          title="Automations"
          subtitle="Run graphs automatically with triggers"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          action={{ label: 'New Automation', href: '/automations/new' }}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <motion.div 
            className="max-w-6xl mx-auto px-4 py-8 pb-24"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {/* Stats Overview */}
            <motion.div 
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
              variants={fadeUpVariants}
            >
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : automations.length}
                    </div>
                    <div className="text-sm text-gray-400">Total</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20">
                    <Play className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{activeCount}</div>
                    <div className="text-sm text-gray-400">Active</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{totalRuns}</div>
                    <div className="text-sm text-gray-400">Total Runs</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0}%
                    </div>
                    <div className="text-sm text-gray-400">Success Rate</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div className="mb-8" variants={fadeUpVariants}>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/automations/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Automation
                </Link>
                <Link
                  href="/studio/graphs"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-200 rounded-lg hover:bg-[#2a2a2a] border border-[#2a2a2a] transition-colors"
                >
                  Browse Graphs
                </Link>
              </div>
            </motion.div>

            {/* Automations List */}
            <motion.div variants={fadeUpVariants}>
              <h2 className="text-lg font-semibold text-white mb-4">Your Automations</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                </div>
              ) : automations.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a]/50">
                  <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No automations yet</h3>
                  <p className="text-gray-500 mb-6 max-w-md mx-auto">
                    Create your first automation to run graphs automatically with webhooks, 
                    schedules, or manual triggers.
                  </p>
                  <Link
                    href="/automations/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Create Automation
                  </Link>
                </div>
              ) : (
                <motion.div
                  className="grid gap-4"
                  variants={staggerContainerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {automations.map((automation) => {
                    const TriggerIcon = triggerIcons[automation.trigger.type] || MousePointer;
                    const successRate = automation.stats.runCount > 0 
                      ? Math.round((automation.stats.successCount / automation.stats.runCount) * 100)
                      : null;

                      return (
                      <motion.div
                        key={automation.automationId}
                        variants={staggerItemVariants}
                        className="relative p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] transition-all group cursor-pointer"
                        onClick={() => router.push(`/automations/${automation.automationId}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                            {/* Status Indicator */}
                            <div
                              className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                              style={{ backgroundColor: statusColors[automation.status] }}
                            />
                            
                            {/* Info */}
                            <div className="flex-1 min-w-0 overflow-hidden">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="font-medium text-white truncate max-w-[200px] sm:max-w-none">
                                  {automation.name}
                                </h3>
                                <span className="px-2 py-0.5 text-xs rounded bg-[#2a2a2a] text-gray-400 flex items-center gap-1">
                                  <TriggerIcon className="w-3 h-3" />
                                  {triggerLabels[automation.trigger.type]}
                                </span>
                              </div>
                              
                              {automation.description && (
                                <p className="text-sm text-gray-500 mb-2 line-clamp-1">
                                  {automation.description}
                                </p>
                              )}
                              
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Play className="w-3 h-3" />
                                  {automation.stats.runCount} runs
                                </span>
                                {successRate !== null && (
                                  <span className="flex items-center gap-1">
                                    {successRate >= 90 ? (
                                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                                    ) : successRate >= 70 ? (
                                      <CheckCircle2 className="w-3 h-3 text-yellow-500" />
                                    ) : (
                                      <XCircle className="w-3 h-3 text-red-500" />
                                    )}
                                    {successRate}% success
                                  </span>
                                )}
                                {automation.lastRunAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(automation.lastRunAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Run Button */}
                            <button
                              onClick={() => handleTrigger(automation.automationId)}
                              disabled={triggeringId === automation.automationId || !automation.isEnabled}
                              className="p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Run Now"
                            >
                              {triggeringId === automation.automationId ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              ) : (
                                <Play className="w-4 h-4 text-green-500" />
                              )}
                            </button>
                            
                            {/* View Runs */}
                            <Link
                              href={`/automations/${automation.automationId}/runs`}
                              className="p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                              title="View Runs"
                            >
                              <BarChart3 className="w-4 h-4 text-gray-400" />
                            </Link>
                            
                            {/* More Actions */}
                            <div className="relative">
                              <button
                                onClick={() => setActionMenuId(
                                  actionMenuId === automation.automationId ? null : automation.automationId
                                )}
                                className="p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                              >
                                <MoreVertical className="w-4 h-4 text-gray-400" />
                              </button>
                              
                              {actionMenuId === automation.automationId && (
                                <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] shadow-xl z-10">
                                  <button
                                    onClick={() => handleToggle(automation.automationId, automation.isEnabled)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a]"
                                  >
                                    {automation.isEnabled ? (
                                      <>
                                        <Pause className="w-4 h-4" />
                                        Disable
                                      </>
                                    ) : (
                                      <>
                                        <Play className="w-4 h-4" />
                                        Enable
                                      </>
                                    )}
                                  </button>
                                  <Link
                                    href={`/automations/${automation.automationId}/edit`}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a]"
                                    onClick={() => setActionMenuId(null)}
                                  >
                                    <Settings className="w-4 h-4" />
                                    Settings
                                  </Link>
                                  <button
                                    onClick={() => handleDelete(automation.automationId)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#2a2a2a]"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>

            {/* Scheduling Info */}
            <motion.div 
              className="mt-8 p-4 rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a]/50"
              variants={fadeUpVariants}
            >
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-300 mb-1">Scheduled Automations</h3>
                  <p className="text-sm text-gray-500">
                    Scheduled triggers (cron jobs) are coming soon. Currently, you can use manual triggers 
                    or webhooks to run your automations.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </main>
      </div>

      {/* Click outside to close action menu */}
      {actionMenuId && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setActionMenuId(null)}
        />
      )}
    </div>
  );
}
