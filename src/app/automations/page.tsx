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
  GitBranch,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { ConfirmModal } from '@/components/ui/Modal';
import { GraphRunDrawer, GraphRunViewer, type GraphDefinition, type GraphRunState } from '@/components/graph';
import { 
  pageVariants, 
  staggerContainerVariants, 
  staggerItemVariants,
  fadeUpVariants,
} from '@/lib/animations';
import type { AutomationSummary, AutomationRun, TriggerType, AutomationStatus } from '@/types/automation';

const triggerIcons: Record<TriggerType, typeof Webhook> = {
  webhook: Webhook,
  schedule: Calendar,
  event: Radio,
  manual: MousePointer,
};

const triggerLabels: Record<TriggerType, string> = {
  webhook: 'Webhook',
  schedule: 'Scheduled',
  event: 'Event',
  manual: 'Manual',
};

const statusColors: Record<AutomationStatus, string> = {
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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Graph viewer state
  const [showGraphDrawer, setShowGraphDrawer] = useState(false);
  const [selectedGraphDef, setSelectedGraphDef] = useState<GraphDefinition | null>(null);

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
      // Use v2 trigger API
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
    setDeleteConfirmId(null);
  }

  async function handleViewGraph(graphId: string, e?: React.MouseEvent) {
    // Prevent click from bubbling to parent row
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const res = await fetch(`/api/v1/graphs/${graphId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const graph = data.graph || data; // API returns { graph: {...} }
        // Transform API response to GraphDefinition format
        const graphDef: GraphDefinition = {
          id: graph.graphId,
          name: graph.name,
          nodes: (graph.nodes || []).map((n: any) => ({
            id: n.id || n.nodeId,
            type: n.type || 'universal',
            name: n.name || n.id,
            config: n.config,
          })),
          edges: (graph.edges || []).map((e: any) => ({
            from: e.from || e.source,
            to: e.to || e.target,
            condition: e.condition,
            targets: e.targets,
            fallback: e.fallback,
          })),
          entryNodeId: graph.entryNodeId || graph.nodes?.[0]?.id,
        };
        setSelectedGraphDef(graphDef);
        setShowGraphDrawer(true);
      } else {
        console.error('Failed to fetch graph:', res.status);
      }
    } catch (err) {
      console.error('Error fetching graph:', err);
    }
  }

  const totalRuns = automations.reduce((sum, a) => sum + a.stats.runCount, 0);
  const totalSuccess = automations.reduce((sum, a) => sum + a.stats.successCount, 0);
  const totalFailures = automations.reduce((sum, a) => sum + a.stats.failureCount, 0);
  const activeCount = automations.filter(a => a.isEnabled).length;

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20">
                    <Zap className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : automations.length}
                    </div>
                    <div className="text-sm text-text-secondary">Total</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/20">
                    <Play className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">{activeCount}</div>
                    <div className="text-sm text-text-secondary">Active</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/20">
                    <BarChart3 className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">{totalRuns}</div>
                    <div className="text-sm text-text-secondary">Total Runs</div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-text-primary">
                      {totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0}%
                    </div>
                    <div className="text-sm text-text-secondary">Success</div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div className="mb-8" variants={fadeUpVariants}>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/automations/new"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  New Automation
                </Link>
                <Link
                  href="/studio/graphs"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary text-text-primary rounded-lg hover:bg-bg-tertiary border border-border transition-colors"
                >
                  Browse Graphs
                </Link>
              </div>
            </motion.div>

            {/* Automations List */}
            <motion.div variants={fadeUpVariants}>
              <h2 className="text-lg font-semibold text-text-primary mb-4">Your Automations</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
                </div>
              ) : automations.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-bg-secondary/50">
                  <Zap className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-text-secondary mb-2">No automations yet</h3>
                  <p className="text-text-muted mb-6 max-w-md mx-auto">
                    Create your first automation to run graphs automatically with webhooks, 
                    schedules, or manual triggers.
                  </p>
                  <Link
                    href="/automations/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Create Automation
                  </Link>
                </div>
              ) : (
                <motion.div
                  className="grid gap-4 w-full overflow-hidden"
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
                        className="relative p-3 sm:p-4 rounded-xl border border-border bg-bg-secondary hover:border-border-hover transition-all group cursor-pointer"
                        onClick={() => router.push(`/automations/${automation.automationId}`)}
                      >
                        {/* Main content row */}
                        <div className="flex items-start gap-2 sm:gap-3 min-w-0">
                          {/* Status Indicator */}
                          <div
                            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                            style={{ backgroundColor: statusColors[automation.status] }}
                          />
                          
                          {/* Info - takes full width */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-text-primary mb-1 line-clamp-2">
                              {automation.name}
                            </h3>
                            <span className="inline-flex px-2 py-0.5 text-xs rounded bg-bg-tertiary text-text-secondary items-center gap-1 mb-2">
                              <TriggerIcon className="w-3 h-3" />
                              {triggerLabels[automation.trigger.type]}
                            </span>
                            
                            {automation.description && (
                              <p className="text-sm text-text-muted mb-2 line-clamp-2">
                                {automation.description}
                              </p>
                            )}
                            
                            {/* Stats row */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3 text-xs text-text-muted flex-wrap">
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
                                    {successRate}%
                                  </span>
                                )}
                                {automation.lastRunAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(automation.lastRunAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              
                              {/* Actions - inline with stats */}
                              <div className="flex items-center gap-0.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Run Button */}
                            <button
                              onClick={() => handleTrigger(automation.automationId)}
                              disabled={triggeringId === automation.automationId || !automation.isEnabled}
                              className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Run Now"
                            >
                              {triggeringId === automation.automationId ? (
                                <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
                              ) : (
                                <Play className="w-4 h-4 text-green-500" />
                              )}
                            </button>
                            
                            {/* View Runs */}
                            <Link
                              href={`/automations/${automation.automationId}/runs`}
                              className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                              title="View Runs"
                            >
                              <BarChart3 className="w-4 h-4 text-text-secondary" />
                            </Link>
                            
                            {/* View Graph */}
                            <button
                              onClick={(e) => handleViewGraph(automation.graphId, e)}
                              className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                              title="View Graph"
                            >
                              <GitBranch className="w-4 h-4 text-text-secondary" />
                            </button>
                            
                            {/* More Actions */}
                            <div className="relative">
                              <button
                                onClick={() => setActionMenuId(
                                  actionMenuId === automation.automationId ? null : automation.automationId
                                )}
                                className="p-1.5 rounded-lg hover:bg-bg-tertiary transition-colors"
                              >
                                <MoreVertical className="w-4 h-4 text-text-secondary" />
                              </button>
                              
                              {actionMenuId === automation.automationId && (
                                <div className="absolute right-0 top-full mt-1 w-48 py-1 rounded-lg border border-border bg-bg-secondary shadow-xl z-50">
                                  <button
                                    onClick={() => handleToggle(automation.automationId, automation.isEnabled)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
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
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary"
                                    onClick={() => setActionMenuId(null)}
                                  >
                                    <Settings className="w-4 h-4" />
                                    Settings
                                  </Link>
                                  <button
                                    onClick={() => {
                                      setActionMenuId(null);
                                      setDeleteConfirmId(automation.automationId);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-bg-tertiary"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
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
              className="mt-8 p-4 rounded-xl border border-dashed border-border bg-bg-secondary/50"
              variants={fadeUpVariants}
            >
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-text-muted mt-0.5" />
                <div>
                  <h3 className="font-medium text-text-secondary mb-1">Scheduled Automations</h3>
                  <p className="text-sm text-text-muted">
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title="Delete Automation"
        message="Are you sure you want to delete this automation? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Graph Viewer Drawer */}
      <GraphRunDrawer
        isOpen={showGraphDrawer}
        onClose={() => setShowGraphDrawer(false)}
        graph={selectedGraphDef}
      />
    </div>
  );
}
