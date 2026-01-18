'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Zap, 
  ArrowLeft,
  Save,
  Loader2,
  Webhook,
  Calendar,
  MousePointer,
  Radio,
  GitBranch,
  ChevronDown,
  Plus,
  Trash2,
} from 'lucide-react';
import { StudioSidebar } from '@/components/layout/StudioSidebar';
import { StudioHeader } from '@/components/layout/StudioHeader';
import { pageVariants, fadeUpVariants } from '@/lib/animations';
import Link from 'next/link';
import type { TriggerType } from '@/types/automation';

interface GraphOption {
  graphId: string;
  name: string;
  description?: string;
  graphType?: 'agent' | 'workflow';
}

const triggerOptions: { type: TriggerType; label: string; icon: typeof Webhook; description: string; available: boolean }[] = [
  { 
    type: 'manual', 
    label: 'Manual', 
    icon: MousePointer, 
    description: 'Trigger manually from the dashboard or API',
    available: true 
  },
  { 
    type: 'webhook', 
    label: 'Webhook', 
    icon: Webhook, 
    description: 'Trigger via HTTP POST to a unique URL',
    available: true 
  },
  { 
    type: 'schedule', 
    label: 'Schedule', 
    icon: Calendar, 
    description: 'Run on a cron schedule (e.g., every hour)',
    available: false 
  },
  { 
    type: 'event', 
    label: 'Event', 
    icon: Radio, 
    description: 'Trigger from internal events',
    available: false 
  },
];

export default function NewAutomationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGraphId = searchParams.get('graphId');
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [graphs, setGraphs] = useState<GraphOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGraphId, setSelectedGraphId] = useState(preselectedGraphId || '');
  const [triggerType, setTriggerType] = useState<TriggerType>('manual');
  const [inputMapping, setInputMapping] = useState<Record<string, string>>({});
  const [showGraphDropdown, setShowGraphDropdown] = useState(false);

  useEffect(() => {
    fetchGraphs();
  }, []);

  // Update selectedGraphId when preselectedGraphId changes or graphs load
  useEffect(() => {
    if (preselectedGraphId && graphs.length > 0 && !selectedGraphId) {
      const matchingGraph = graphs.find(g => g.graphId === preselectedGraphId);
      if (matchingGraph) {
        setSelectedGraphId(preselectedGraphId);
        // Auto-fill name from graph name
        if (!name) {
          setName(`${matchingGraph.name} Automation`);
        }
      }
    }
  }, [preselectedGraphId, graphs]);

  async function fetchGraphs() {
    try {
      // Only fetch workflow graphs for automations
      const res = await fetch('/api/v1/graphs?graphType=workflow');
      if (res.ok) {
        const data = await res.json();
        setGraphs(data.graphs || []);
      }
    } catch (err) {
      console.error('Error fetching graphs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!selectedGraphId) {
      setError('Please select a graph');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/v1/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          graphId: selectedGraphId,
          trigger: {
            type: triggerType,
            config: {}
          },
          inputMapping
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create automation');
      }

      const data = await res.json();
      router.push(`/automations/${data.automation.automationId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const selectedGraph = graphs.find(g => g.graphId === selectedGraphId);

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      <StudioSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <StudioHeader
          title="New Automation"
          subtitle="Configure automatic graph execution"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />

        <main className="flex-1 overflow-y-auto">
          <motion.div 
            className="max-w-2xl mx-auto px-4 py-8 pb-24"
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

            <form onSubmit={handleSubmit}>
              {/* Basic Info */}
              <motion.div 
                className="p-6 rounded-xl border border-border bg-bg-secondary mb-6"
                variants={fadeUpVariants}
              >
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-accent-text" />
                  Basic Information
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="My Automation"
                      className="w-full px-4 py-2 rounded-lg border border-border bg-bg-primary text-text-primary placeholder-text-disabled focus:border-accent focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Description
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What does this automation do?"
                      rows={2}
                      className="w-full px-4 py-2 rounded-lg border border-border bg-bg-primary text-text-primary placeholder-text-disabled focus:border-accent focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Graph Selection */}
              <motion.div 
                className="p-6 rounded-xl border border-border bg-bg-secondary mb-6"
                variants={fadeUpVariants}
              >
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-blue-500" />
                  Select Graph *
                </h2>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
                  </div>
                ) : (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowGraphDropdown(!showGraphDropdown)}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-bg-primary text-left flex items-center justify-between hover:border-border-hover transition-colors"
                    >
                      {selectedGraph ? (
                        <div>
                          <div className="font-medium text-text-primary">{selectedGraph.name}</div>
                          {selectedGraph.description && (
                            <div className="text-sm text-text-muted truncate">{selectedGraph.description}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted">Choose a graph to run...</span>
                      )}
                      <ChevronDown className={`w-5 h-5 text-text-secondary transition-transform ${showGraphDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showGraphDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-bg-secondary shadow-xl z-10">
                        {graphs.length === 0 ? (
                          <div className="p-4 text-center text-text-muted">
                            No graphs available. Create one in the Studio first.
                          </div>
                        ) : (
                          graphs.map(graph => (
                            <button
                              key={graph.graphId}
                              type="button"
                              onClick={() => {
                                setSelectedGraphId(graph.graphId);
                                setShowGraphDropdown(false);
                              }}
                              className={`w-full px-4 py-3 text-left hover:bg-bg-tertiary transition-colors border-b border-border last:border-0 ${
                                selectedGraphId === graph.graphId ? 'bg-bg-tertiary' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-text-primary">{graph.name}</div>
                                {graph.graphType && (
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    graph.graphType === 'workflow' 
                                      ? 'bg-purple-500/20 text-purple-400'
                                      : 'bg-green-500/20 text-green-400'
                                  }`}>
                                    {graph.graphType}
                                  </span>
                                )}
                              </div>
                              {graph.description && (
                                <div className="text-sm text-text-muted truncate mt-1">{graph.description}</div>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                </>
                )}
              </motion.div>

              {/* Trigger Selection */}
              <motion.div 
                className="p-6 rounded-xl border border-border bg-bg-secondary mb-6"
                variants={fadeUpVariants}
              >
                <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Trigger Type
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  {triggerOptions.map(option => {
                    const Icon = option.icon;
                    const isSelected = triggerType === option.type;
                    return (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => option.available && setTriggerType(option.type)}
                        disabled={!option.available}
                        className={`p-4 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'border-accent bg-accent/10' 
                            : option.available
                              ? 'border-border hover:border-border-hover'
                              : 'border-border opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-accent-text' : 'text-text-secondary'}`} />
                          <span className={`font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                            {option.label}
                          </span>
                          {!option.available && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">Soon</span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Input Mapping (simplified for now) */}
              <motion.div 
                className="p-6 rounded-xl border border-border bg-bg-secondary mb-6"
                variants={fadeUpVariants}
              >
                <h2 className="text-lg font-semibold text-text-primary mb-2">Default Input</h2>
                <p className="text-sm text-text-muted mb-4">
                  Set default values that will be passed to the graph when triggered.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Message (default input)
                    </label>
                    <input
                      type="text"
                      value={inputMapping.message || ''}
                      onChange={(e) => setInputMapping({ ...inputMapping, message: e.target.value })}
                      placeholder="Optional default message..."
                      className="w-full px-4 py-2 rounded-lg border border-border bg-bg-primary text-text-primary placeholder-text-disabled focus:border-accent focus:outline-none"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Error Message */}
              {error && (
                <motion.div 
                  className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.div>
              )}

              {/* Submit */}
              <motion.div 
                className="flex items-center justify-end gap-3"
                variants={fadeUpVariants}
              >
                <Link
                  href="/automations"
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create Automation
                    </>
                  )}
                </button>
              </motion.div>
            </form>
          </motion.div>
        </main>
      </div>

      {/* Click outside to close dropdown */}
      {showGraphDropdown && (
        <div 
          className="fixed inset-0 z-0" 
          onClick={() => setShowGraphDropdown(false)}
        />
      )}
    </div>
  );
}
