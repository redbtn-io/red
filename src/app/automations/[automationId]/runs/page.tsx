'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    RefreshCw,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { pageVariants, fadeUpVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations';
import type { AutomationRun, RunStatus } from '@/types/automation';

const statusConfig: Record<RunStatus, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: '#6b7280', icon: Clock, label: 'Pending' },
  running: { color: '#3b82f6', icon: RefreshCw, label: 'Running' },
  completed: { color: '#22c55e', icon: CheckCircle2, label: 'Completed' },
  failed: { color: '#ef4444', icon: XCircle, label: 'Failed' },
  cancelled: { color: '#f59e0b', icon: AlertCircle, label: 'Cancelled' },
  timeout: { color: '#f59e0b', icon: Clock, label: 'Timeout' },
};

export default function AutomationRunsPage() {
  const params = useParams();
  const automationId = params?.automationId as string;
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (automationId) {
      fetchRuns();
    }
  }, [automationId, statusFilter, offset]);

  async function fetchRuns() {
    try {
      let url = `/api/v1/automations/${automationId}/runs?limit=20&offset=${offset}`;
      if (statusFilter) url += `&status=${statusFilter}`;
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
        setHasMore(data.pagination?.hasMore || false);
        setTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Error fetching runs:', err);
    } finally {
      setLoading(false);
    }
  }

  const statuses = ['', 'completed', 'failed', 'running', 'pending'];

  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title="Automation Runs"
          subtitle={`Run history for ${automationId}`}
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
                href={`/automations/${automationId}`}
                className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Automation
              </Link>
            </motion.div>

            {/* Filters */}
            <motion.div 
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
              variants={fadeUpVariants}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-text-secondary text-sm">Filter:</span>
                {statuses.map(status => (
                  <button
                    key={status || 'all'}
                    onClick={() => {
                      setStatusFilter(status);
                      setOffset(0);
                    }}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      statusFilter === status
                        ? 'bg-accent text-white'
                        : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {status || 'All'}
                  </button>
                ))}
              </div>
              
              <span className="text-sm text-text-muted flex-shrink-0">{total} total runs</span>
            </motion.div>

            {/* Runs List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
              </div>
            ) : runs.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-bg-secondary/50">
                <Clock className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-secondary mb-2">No runs found</h3>
                <p className="text-text-muted">
                  {statusFilter ? `No ${statusFilter} runs yet.` : 'Trigger this automation to see run history.'}
                </p>
              </div>
            ) : (
              <motion.div
                className="space-y-3"
                variants={staggerContainerVariants}
                initial="initial"
                animate="animate"
              >
                {runs.map(run => {
                  const config = statusConfig[run.status];
                  const Icon = config.icon;
                  
                  return (
                    <motion.div
                      key={run.runId}
                      variants={staggerItemVariants}
                      className="p-4 rounded-xl border border-border bg-bg-secondary hover:border-border-hover transition-all overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <Icon 
                            className={`w-5 h-5 flex-shrink-0 ${run.status === 'running' ? 'animate-spin' : ''}`}
                            style={{ color: config.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <code className="text-sm font-mono text-text-primary block truncate">{run.runId}</code>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span 
                                className="text-xs px-2 py-0.5 rounded flex-shrink-0"
                                style={{ 
                                  backgroundColor: `${config.color}20`,
                                  color: config.color
                                }}
                              >
                                {config.label}
                              </span>
                              <span className="text-xs text-text-muted">
                                via {run.triggeredBy}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-left sm:text-right text-sm flex-shrink-0">
                          {run.durationMs !== undefined && (
                            <div className="text-text-primary">{run.durationMs}ms</div>
                          )}
                          <div className="text-text-muted text-xs">
                            {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </div>
                      </div>
                      
                      {/* Input/Output Preview */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {run.input && Object.keys(run.input).length > 0 && (
                          <div className="overflow-hidden">
                            <div className="text-xs text-text-muted mb-1">Input</div>
                            <pre className="text-xs text-text-secondary bg-bg-primary p-2 rounded overflow-x-auto max-h-20">
                              {JSON.stringify(run.input, null, 2)}
                            </pre>
                          </div>
                        )}
                        
                        {run.output && (
                          <div className="overflow-hidden">
                            <div className="text-xs text-text-muted mb-1">Output</div>
                            <pre className="text-xs text-green-400 bg-bg-primary p-2 rounded overflow-x-auto max-h-20">
                              {typeof run.output === 'string' 
                                ? run.output.substring(0, 200)
                                : JSON.stringify(run.output, null, 2).substring(0, 200)}
                            </pre>
                          </div>
                        )}
                      </div>
                      
                      {run.error && (
                        <div className="mt-3 text-sm text-red-400 bg-red-500/10 p-2 rounded break-words overflow-hidden">
                          <p className="line-clamp-4">{run.error}</p>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Pagination */}
            {(offset > 0 || hasMore) && (
              <motion.div 
                className="flex items-center justify-center gap-2 mt-6"
                variants={fadeUpVariants}
              >
                <button
                  onClick={() => setOffset(Math.max(0, offset - 20))}
                  disabled={offset === 0}
                  className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary"
                >
                  Previous
                </button>
                <button
                  onClick={() => setOffset(offset + 20)}
                  disabled={!hasMore}
                  className="px-4 py-2 rounded-lg bg-bg-secondary text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-bg-tertiary"
                >
                  Next
                </button>
              </motion.div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
