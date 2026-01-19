'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
    ArrowLeft,
    Play,
    Pause,
    Loader2,
    Webhook,
    Calendar,
    MousePointer,
    Radio,
    Settings,
    Clock,
    BarChart3,
    Copy,
    Check,
    ExternalLink,
    GitBranch,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { GraphRunViewer, type GraphDefinition } from '@/components/graph';
import { useGraphRunState, type GraphEvent } from '@/hooks/useGraphRunState';
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
  const [graphDef, setGraphDef] = useState<GraphDefinition | null>(null);
  const [showGraph, setShowGraph] = useState(true);
  
  // Graph run state for live flow visualization
  const {
    runState: graphRunState,
    processGraphEvent,
    resetRunState,
    initializeFromState,
    startRun,
  } = useGraphRunState({ graphDefinition: graphDef });
  
  // SSE event source ref for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (automationId) {
      fetchAutomation();
      fetchRuns();
    }
  }, [automationId]);

  // Fetch graph when automation is loaded
  useEffect(() => {
    if (automation?.graphId) {
      fetchGraph(automation.graphId);
    }
  }, [automation?.graphId]);

  async function fetchGraph(graphId: string) {
    try {
      const res = await fetch(`/api/v1/graphs/${graphId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const graph = data.graph || data;
        const def: GraphDefinition = {
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
        setGraphDef(def);
      }
    } catch (err) {
      console.error('Error fetching graph:', err);
    }
  }

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
  
  // Subscribe to SSE for live graph events (v2: uses run stream)
  // Returns a promise that resolves when the connection is opened
  const subscribeToSSE = useCallback((streamUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Close any existing connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      
      console.log(`[Automation] ${new Date().toISOString()} Subscribing to SSE: ${streamUrl}`);
      // Note: EventSource uses GET with credentials by default when same-origin
      const eventSource = new EventSource(streamUrl, { withCredentials: true });
      eventSourceRef.current = eventSource;
      let messageCount = 0;
      let openResolved = false;
      
      // Timeout if connection doesn't open within 15 seconds
      const openTimeout = setTimeout(() => {
        if (!openResolved) {
          console.error('[Automation] SSE connection timeout');
          eventSource.close();
          eventSourceRef.current = null;
          reject(new Error('SSE connection timeout'));
        }
      }, 15000);
      
      eventSource.onopen = () => {
        console.log(`[Automation] ${new Date().toISOString()} SSE connection opened`);
        if (!openResolved) {
          openResolved = true;
          clearTimeout(openTimeout);
          resolve();
        }
      };
      
      eventSource.onmessage = (event) => {
        messageCount++;
        console.log(`[Automation] ${new Date().toISOString()} SSE message #${messageCount}:`, event.data.substring(0, 100));
      
      if (event.data === '[DONE]') {
        console.log('[Automation] SSE stream complete');
        eventSource.close();
        eventSourceRef.current = null;
        // Refresh runs after completion
        fetchRuns();
        fetchAutomation();
        return;
      }
      
      try {
        const data = JSON.parse(event.data);
        console.log('[Automation] SSE event:', data.type, data);
        
        // Handle init event - initialize from existing state
        if (data.type === 'init' && data.state?.graph) {
          console.log('[Automation] Processing init event');
          const graphState = data.state.graph;
          const eventsToReplay = initializeFromState({
            runId: data.state.runId,
            graphId: data.state.graphId,
            executionPath: graphState.executionPath || [],
            nodeProgress: graphState.nodeProgress || {},
            startTime: data.state.startedAt,
            endTime: data.state.completedAt,
            status: data.state.status,
            stateTimestamp: data.timestamp,
          });
          // Replay any buffered events
          if (eventsToReplay && eventsToReplay.length > 0) {
            console.log(`[Automation] Replaying ${eventsToReplay.length} buffered events`);
            for (const bufferedEvent of eventsToReplay) {
              flushSync(() => {
                processGraphEvent(bufferedEvent as GraphEvent);
              });
            }
          }
          return;
        }
        
        // v2 format: flat events (no tool_event wrapper)
        if (data.type.startsWith('graph_') || data.type.startsWith('node_')) {
          console.log('[Automation] Processing graph event:', data.type);
          // Use flushSync to force immediate render for visual feedback
          flushSync(() => {
            processGraphEvent(data as GraphEvent);
          });
        } else if (data.type === 'run_complete') {
          console.log('[Automation] Run complete');
          flushSync(() => {
            processGraphEvent(data as GraphEvent);
          });
          eventSource.close();
          eventSourceRef.current = null;
          fetchRuns();
          fetchAutomation();
        } else if (data.type === 'run_error') {
          console.error('[Automation] Run error:', data.error);
          flushSync(() => {
            processGraphEvent(data as GraphEvent);
          });
          eventSource.close();
          eventSourceRef.current = null;
          fetchRuns();
          fetchAutomation();
        }
        
        // Legacy format compatibility: tool_event wrapper
        if (data.type === 'tool_event' && data.event) {
          const toolEvent = data.event;
          // Handle graph/node events for visual viewer
          if (toolEvent.type.startsWith('graph_') || toolEvent.type.startsWith('node_')) {
            console.log('[Automation] Processing graph event:', toolEvent.type);
            // Use flushSync to force immediate render for visual feedback
            flushSync(() => {
              processGraphEvent(toolEvent as GraphEvent);
            });
          }
        } else if (data.type === 'complete') {
          console.log('[Automation] Run complete (legacy)');
          eventSource.close();
          eventSourceRef.current = null;
          fetchRuns();
          fetchAutomation();
        } else if (data.type === 'error') {
          console.error('[Automation] Run error (legacy):', data.error);
          eventSource.close();
          eventSourceRef.current = null;
          fetchRuns();
          fetchAutomation();
        }
      } catch (e) {
        // Ignore parse errors (comments, keepalives)
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('[Automation] SSE error:', error);
      eventSource.close();
      eventSourceRef.current = null;
      if (!openResolved) {
        openResolved = true;
        clearTimeout(openTimeout);
        reject(new Error('SSE connection error'));
      }
    };
    });
  }, [processGraphEvent, initializeFromState, fetchRuns, fetchAutomation]);
  
  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  async function handleTrigger() {
    setTriggering(true);
    // Use flushSync to ensure UI shows reset before starting new run
    flushSync(() => {
      resetRunState(); // Clear previous run state
      startRun(automation?.graphId); // Show initial "starting" state
    });
    
    try {
      // Generate runId upfront
      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const streamUrl = `/api/v1/runs/${runId}/stream`;
      
      // Fire off both SSE subscription and trigger in parallel
      // SSE will poll for run, replay missed events, then stream live
      // No need to wait for SSE before triggering - events are stored in Redis
      console.log(`[Automation] ${new Date().toISOString()} Starting trigger for runId=${runId}`);
      
      // Start SSE connection (don't await - it will catch up via event replay)
      subscribeToSSE(streamUrl).catch(err => {
        console.error('[Automation] SSE connection error:', err);
      });
      
      // Trigger the automation
      const res = await fetch(`/api/v1/automations/${automationId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      console.log(`[Automation] ${new Date().toISOString()} Trigger response: ${res.status}`);
      
      if (!res.ok) {
        console.error('[Automation] Trigger failed:', await res.text());
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
      
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
      <div className="flex h-app bg-bg-primary items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="flex h-app bg-bg-primary items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Automation not found</h2>
          <Link href="/automations" className="text-accent-text hover:underline">
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
    <div className="flex h-app bg-bg-primary overflow-hidden">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
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
                className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
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
                <span className="text-text-secondary">
                  {automation.isEnabled ? 'Active' : 'Disabled'}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTrigger}
                  disabled={triggering || !automation.isEnabled}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-600 text-text-primary rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
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
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-text-primary'
                      : 'bg-green-600 hover:bg-green-700 text-text-primary'
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
                  className="inline-flex items-center justify-center p-1.5 bg-bg-secondary text-text-primary rounded-lg hover:bg-bg-tertiary border border-border transition-colors"
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
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="text-2xl font-bold text-text-primary">{automation.stats.runCount}</div>
                <div className="text-sm text-text-secondary">Total Runs</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="text-2xl font-bold text-green-500">{automation.stats.successCount}</div>
                <div className="text-sm text-text-secondary">Successful</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="text-2xl font-bold text-red-500">{automation.stats.failureCount}</div>
                <div className="text-sm text-text-secondary">Failed</div>
              </div>
              <div className="p-4 rounded-xl border border-border bg-bg-secondary">
                <div className="text-2xl font-bold text-text-primary">
                  {successRate !== null ? `${successRate}%` : '-'}
                </div>
                <div className="text-sm text-text-secondary">Success</div>
              </div>
            </motion.div>

            {/* Configuration */}
            <motion.div 
              className="p-6 rounded-xl border border-border bg-bg-secondary mb-8"
              variants={fadeUpVariants}
            >
              <h2 className="text-lg font-semibold text-text-primary mb-4">Configuration</h2>
              
              <div className="grid gap-4">
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Graph</span>
                  <Link 
                    href={`/studio/graphs/${automation.graphId}`}
                    className="text-text-primary hover:text-accent-text flex items-center gap-1"
                  >
                    {automation.graphId}
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
                
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-text-secondary">Trigger Type</span>
                  <span className="text-text-primary flex items-center gap-2">
                    <TriggerIcon className="w-4 h-4" />
                    {automation.trigger.type.charAt(0).toUpperCase() + automation.trigger.type.slice(1)}
                  </span>
                </div>
                
                {automation.trigger.type === 'webhook' && (
                  <div className="py-2 border-b border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-text-secondary">Webhook URL</span>
                      <button
                        onClick={copyWebhookUrl}
                        className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <code className="block text-sm text-green-400 bg-bg-primary p-2 rounded font-mono break-all">
                      POST /api/v1/automations/{automationId}/trigger
                    </code>
                  </div>
                )}
                
                <div className="flex items-center justify-between py-2">
                  <span className="text-text-secondary">Created</span>
                  <span className="text-text-primary">
                    {new Date(automation.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Graph Visualization */}
            {graphDef && (
              <motion.div 
                className="p-6 rounded-xl border border-border bg-bg-secondary mb-8"
                variants={fadeUpVariants}
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <GitBranch className="w-5 h-5 text-text-muted" />
                    Graph
                  </h2>
                  <button
                    onClick={() => setShowGraph(!showGraph)}
                    className="text-sm text-text-muted hover:text-text-primary transition-colors"
                  >
                    {showGraph ? 'Hide' : 'Show'}
                  </button>
                </div>
                
                {showGraph && (
                  <div className="bg-bg-primary rounded-lg p-4">
                    <GraphRunViewer 
                      graph={graphDef}
                      runState={graphRunState}
                      compact={false}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {/* Recent Runs */}
            <motion.div variants={fadeUpVariants}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-text-primary">Recent Runs</h2>
                <Link
                  href={`/automations/${automationId}/runs`}
                  className="text-sm text-text-secondary hover:text-text-primary flex items-center gap-1"
                >
                  View All
                  <BarChart3 className="w-4 h-4" />
                </Link>
              </div>

              {runs.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-xl border border-dashed border-border bg-bg-secondary/50">
                  <Clock className="w-8 h-8 text-text-disabled mx-auto mb-2" />
                  <p className="text-text-muted">No runs yet. Trigger this automation to see results.</p>
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
                      className="p-4 rounded-xl border border-border bg-bg-secondary hover:border-border-hover transition-all overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: statusColors[run.status] }}
                          />
                          <span className="font-mono text-sm text-text-secondary truncate">{run.runId}</span>
                          <span className={`text-sm px-2 py-0.5 rounded flex-shrink-0 ${
                            run.status === 'completed' 
                              ? 'bg-green-500/20 text-green-400'
                              : run.status === 'failed'
                                ? 'bg-red-500/20 text-red-400'
                                : run.status === 'running'
                                  ? 'bg-blue-500/20 text-blue-400'
                                  : 'bg-gray-500/20 text-text-secondary'
                          }`}>
                            {run.status}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm text-text-muted flex-shrink-0">
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
