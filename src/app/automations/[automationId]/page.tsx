'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Zap, 
  ArrowLeft,
  Play,
  Pause,
  Loader2,
  Webhook,
  Calendar,
  MousePointer,
  Radio,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Copy,
  Check,
  ExternalLink,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { pageVariants, fadeUpVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations';
import type { Automation, AutomationRun, TriggerType } from '@/types/automation';

const triggerIcons: Record<TriggerType, typeof Webhook> = {
  webhook: Webhook,
  schedule: Calendar,
  event: Radio,
  manual: MousePointer,
};

const statusColors = {
  pending: '#6b7280',
  running: '#3b82f6',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#f59e0b',
  timeout: '#f59e0b',
};

export default function AutomationDetailPage() {
  const params = useParams();
  const automationId = params?.automationId as string;
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [automation, setAutomation] = useState<Automation | null>(null);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (automationId) {
      fetchAutomation();
      fetchRuns();
    }
  }, [automationId]);

  async function fetchAutomation() {
    try {
      const res = await fetch(`/api/v1/automations/${automationId}`);
      if (res.ok) {
        const data = await res.json();
        setAutomation(data.automation);
      }
    } catch (err) {
      console.error('Error fetching automation:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRuns() {
    try {
      const res = await fetch(`/api/v1/automations/${automationId}/runs?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (err) {
      console.error('Error fetching runs:', err);
    }
  }

  async function handleTrigger() {
    setTriggering(true);
    try {
      await fetch(`/api/v1/automations/${automationId}/trigger`, {
        method: 'POST',
      });
      await fetchAutomation();
      await fetchRuns();
    } catch (err) {
      console.error('Error triggering automation:', err);
    } finally {
      setTriggering(false);
    }
  }

  async function handleToggle() {
    if (!automation) return;
    const endpoint = automation.isEnabled ? 'disable' : 'enable';
    try {
      await fetch(`/api/v1/automations/${automationId}/${endpoint}`, {
        method: 'POST',
      });
      await fetchAutomation();
    } catch (err) {
      console.error('Error toggling automation:', err);
    }
  }

  function copyWebhookUrl() {
    const url = `${window.location.origin}/api/v1/automations/${automationId}/trigger`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">Automation not found</h2>
          <Link href="/automations" className="text-[#ef4444] hover:underline">
            Back to Automations
          </Link>
        </div>
      </div>
    );
  }

  const TriggerIcon = triggerIcons[automation.trigger.type] || MousePointer;
  const successRate = automation.stats.runCount > 0 
    ? Math.round((automation.stats.successCount / automation.stats.runCount) * 100)
    : null;

  return (
    <div className="flex h-full">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <StudioHeader
          title={automation.name}
          subtitle={automation.description || 'Automation details'}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto">
          <motion.div 
            className="max-w-4xl mx-auto px-4 py-8 pb-24"
            variants={pageVariants}
            initial="initial"
            animate="animate"
          >
            {/* Back Link */}
            <motion.div className="mb-6" variants={fadeUpVariants}>
              <Link 
                href="/automations"
                className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Automations
              </Link>
            </motion.div>

            {/* Header Actions */}
            <motion.div 
              className="flex flex-wrap items-center justify-between gap-3 mb-8"
              variants={fadeUpVariants}
            >
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  automation.isEnabled ? 'bg-green-500' : 'bg-gray-500'
                }`} />
                <span className="text-gray-400">
                  {automation.isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrigger}
                  disabled={triggering || !automation.isEnabled}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
                >
                  {triggering ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Run
                </button>
                
                <button
                  onClick={handleToggle}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    automation.isEnabled
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
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
                  href={`/automations/${automationId}/edit`}
                  className="inline-flex items-center justify-center p-1.5 bg-[#1a1a1a] text-gray-200 rounded-lg hover:bg-[#2a2a2a] border border-[#2a2a2a] transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>

            {/* Stats Cards */}
            <motion.div 
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
              variants={fadeUpVariants}
            >
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="text-2xl font-bold text-white">{automation.stats.runCount}</div>
                <div className="text-sm text-gray-400">Total Runs</div>
              </div>
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="text-2xl font-bold text-green-500">{automation.stats.successCount}</div>
                <div className="text-sm text-gray-400">Successful</div>
              </div>
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="text-2xl font-bold text-red-500">{automation.stats.failureCount}</div>
                <div className="text-sm text-gray-400">Failed</div>
              </div>
              <div className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a]">
                <div className="text-2xl font-bold text-white">
                  {successRate !== null ? `${successRate}%` : '-'}
                </div>
                <div className="text-sm text-gray-400">Success</div>
              </div>
            </motion.div>

            {/* Configuration */}
            <motion.div 
              className="p-6 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] mb-8"
              variants={fadeUpVariants}
            >
              <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
              
              <div className="grid gap-4">
                <div className="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
                  <span className="text-gray-400">Graph</span>
                  <Link 
                    href={`/studio/graphs/${automation.graphId}`}
                    className="text-white hover:text-[#ef4444] flex items-center gap-1"
                  >
                    {automation.graphId}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-[#2a2a2a]">
                  <span className="text-gray-400">Trigger Type</span>
                  <span className="text-white flex items-center gap-2">
                    <TriggerIcon className="w-4 h-4" />
                    {automation.trigger.type.charAt(0).toUpperCase() + automation.trigger.type.slice(1)}
                  </span>
                </div>
                
                {automation.trigger.type === 'webhook' && (
                  <div className="py-2 border-b border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400">Webhook URL</span>
                      <button
                        onClick={copyWebhookUrl}
                        className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="block text-sm text-green-400 bg-[#0a0a0a] p-2 rounded font-mono break-all">
                      POST /api/v1/automations/{automationId}/trigger
                    </code>
                  </div>
                )}
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-gray-400">Created</span>
                  <span className="text-white">
                    {new Date(automation.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Recent Runs */}
            <motion.div variants={fadeUpVariants}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Recent Runs</h2>
                <Link
                  href={`/automations/${automationId}/runs`}
                  className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                >
                  View All
                  <BarChart3 className="w-4 h-4" />
                </Link>
              </div>

              {runs.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-[#2a2a2a] bg-[#1a1a1a]/50">
                  <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500">No runs yet. Trigger this automation to see results.</p>
                </div>
              ) : (
                <motion.div
                  className="space-y-2"
                  variants={staggerContainerVariants}
                  initial="initial"
                  animate="animate"
                >
                  {runs.map(run => (
                    <motion.div
                      key={run.runId}
                      variants={staggerItemVariants}
                      className="p-4 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#3a3a3a] transition-all overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: statusColors[run.status] }}
                          />
                          <span className="font-mono text-sm text-gray-400 truncate">{run.runId}</span>
                          <span className={`text-sm px-2 py-0.5 rounded flex-shrink-0 ${
                            run.status === 'completed' 
                              ? 'bg-green-500/20 text-green-400'
                              : run.status === 'failed'
                                ? 'bg-red-500/20 text-red-400'
                                : run.status === 'running'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            {run.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-shrink-0">
                          {run.durationMs !== undefined && (
                            <span>{run.durationMs}ms</span>
                          )}
                          <span className="text-xs sm:text-sm">{new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      
                      {run.error && (
                        <div className="mt-2 text-sm text-red-400 bg-red-500/10 p-2 rounded break-words overflow-hidden">
                          <p className="line-clamp-3">{run.error}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
