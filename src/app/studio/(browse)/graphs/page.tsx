'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Plus, 
  Workflow, 
  Loader2, 
  AlertCircle,
  Clock,
  GitFork,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  Lock,
  User,
  Shield,
  Zap,
  MessageSquare,
  Bot
} from 'lucide-react';
import { 
  pageVariants, 
  staggerContainerVariants, 
  staggerItemVariants,
  fadeUpVariants,
} from '@/lib/animations';
import { ErrorModal, ConfirmModal } from '@/components/ui/Modal';

interface GraphInfo {
  graphId: string;
  name: string;
  description?: string;
  tier: number;
  graphType?: 'agent' | 'workflow';
  isDefault: boolean;
  isSystem: boolean;
  isImmutable?: boolean;
  isOwned?: boolean;
  parentGraphId?: string;
  nodeCount: number;
  edgeCount: number;
  version: string;
  createdAt: string;
  updatedAt: string;
  isPublic?: boolean;
  forkCount?: number;
  tags?: string[];
}

const GRAPH_TYPE_LABELS: Record<string, { label: string; color: string; icon: typeof Workflow }> = {
  agent: { label: 'Agent', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', icon: MessageSquare },
  workflow: { label: 'Workflow', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: Workflow },
};

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  1: { label: 'Ultimate', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  2: { label: 'Advanced', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  3: { label: 'Basic', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  4: { label: 'Free', color: 'bg-gray-500/20 text-text-secondary border-gray-500/30' },
};

export default function GraphsPage() {
  const [graphs, setGraphs] = useState<GraphInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'system'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'agent' | 'workflow'>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchGraphs = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/graphs');
      if (!response.ok) throw new Error('Failed to fetch graphs');
      const data = await response.json();
      setGraphs(data.graphs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load graphs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraphs();
  }, [fetchGraphs]);

  // Filter and search
  const filteredGraphs = graphs.filter((g) => {
    // Ownership filter
    if (filter === 'mine' && g.isSystem) return false;
    if (filter === 'system' && !g.isSystem) return false;
    
    // Type filter
    if (typeFilter !== 'all') {
      const gType = g.graphType || 'agent'; // Default to agent
      if (gType !== typeFilter) return false;
    }
    
    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(query) ||
        g.description?.toLowerCase().includes(query) ||
        g.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const systemGraphs = filteredGraphs.filter(g => g.isSystem);
  const userGraphs = filteredGraphs.filter(g => !g.isSystem);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-text-secondary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-12 h-12 text-red-400" />
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <motion.div 
      className="space-y-6"
      variants={pageVariants}
      initial="initial"
      animate="animate"
    >
      {/* Search & Filter */}
      <motion.div className="flex flex-col gap-3" variants={fadeUpVariants}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search graphs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'mine', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  filter === f
                    ? 'bg-accent/10 text-accent-text border border-accent/30'
                    : 'bg-bg-secondary text-text-secondary border border-border hover:text-text-primary hover:border-border-hover'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        
        {/* Type Filter */}
        <div className="flex gap-2">
          {(['all', 'agent', 'workflow'] as const).map((t) => {
            const typeInfo = t === 'all' ? null : GRAPH_TYPE_LABELS[t];
            const Icon = typeInfo?.icon || Bot;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                  typeFilter === t
                    ? t === 'all' 
                      ? 'bg-accent/10 text-accent-text border border-accent/30'
                      : `${typeInfo?.color}`
                    : 'bg-bg-secondary text-text-secondary border border-border hover:text-text-primary hover:border-border-hover'
                }`}
              >
                {t !== 'all' && <Icon className="w-3 h-3" />}
                {t === 'all' ? 'All Types' : typeInfo?.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* System Graphs */}
      <AnimatePresence mode="wait">
      {systemGraphs.length > 0 && (filter === 'all' || filter === 'system') && (
        <motion.section
          key="system-graphs"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
        >
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            System Graphs
          </h3>
          <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {systemGraphs.map((graph) => (
              <motion.div key={graph.graphId} variants={staggerItemVariants}>
                <GraphCard 
                  graph={graph} 
                  openMenuId={openMenuId}
                  onMenuToggle={setOpenMenuId}
                  onFork={fetchGraphs}
                  onDelete={fetchGraphs}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}

      {/* User Graphs */}
      {userGraphs.length > 0 && (filter === 'all' || filter === 'mine') && (
        <motion.section
          key="user-graphs"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Your Graphs
          </h3>
          <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {userGraphs.map((graph) => (
              <motion.div key={graph.graphId} variants={staggerItemVariants}>
                <GraphCard 
                  graph={graph}
                  openMenuId={openMenuId}
                  onMenuToggle={setOpenMenuId}
                  onFork={fetchGraphs}
                  onDelete={fetchGraphs}
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.section>
      )}
      </AnimatePresence>

      {/* Empty State */}
      {filteredGraphs.length === 0 && (
        <motion.div 
          className="flex flex-col items-center justify-center py-16 text-center"
          variants={fadeUpVariants}
          initial="initial"
          animate="animate"
        >
          <Workflow className="w-16 h-16 text-text-disabled mb-4" />
          <h3 className="text-lg font-medium text-text-secondary mb-2">No graphs found</h3>
          <p className="text-text-muted text-sm max-w-sm">
            {searchQuery 
              ? 'Try a different search term'
              : 'Create your first graph to get started'}
          </p>
          {!searchQuery && (
            <Link
              href="/studio"
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Create Graph
            </Link>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function GraphCard({ 
  graph, 
  openMenuId, 
  onMenuToggle,
  onFork,
  onDelete
}: { 
  graph: GraphInfo;
  openMenuId: string | null;
  onMenuToggle: (id: string | null) => void;
  onFork?: () => void;
  onDelete?: () => void;
}) {
  const tierInfo = TIER_LABELS[graph.tier] || TIER_LABELS[4];
  const graphTypeInfo = GRAPH_TYPE_LABELS[graph.graphType || 'agent'];
  const TypeIcon = graphTypeInfo.icon;
  const isMenuOpen = openMenuId === graph.graphId;
  const [forking, setForking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Determine ownership status
  const isEditable = graph.isOwned && !graph.isImmutable && !graph.isSystem;
  const ownershipLabel = graph.isSystem 
    ? { text: 'System', icon: Shield, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' }
    : graph.isOwned 
      ? { text: 'Yours', icon: User, color: 'text-green-400 bg-green-500/10 border-green-500/30' }
      : { text: 'Shared', icon: Lock, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' };

  const handleFork = async () => {
    setForking(true);
    try {
      const response = await fetch(`/api/v1/graphs/${graph.graphId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newGraphId: crypto.randomUUID() })
      });
      if (response.ok) {
        onMenuToggle(null);
        if (onFork) onFork();
      }
    } catch (err) {
      console.error('Failed to fork graph:', err);
    } finally {
      setForking(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/v1/graphs/${graph.graphId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onMenuToggle(null);
        if (onDelete) onDelete();
      } else {
        const data = await response.json();
        setDeleteError(data.error || 'Failed to delete graph');
      }
    } catch (err) {
      console.error('Failed to delete graph:', err);
      setDeleteError('Failed to delete graph');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="bg-bg-secondary border border-border rounded-xl p-5 hover:border-border-hover transition-colors group relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            graph.isSystem ? 'bg-accent/10' : 'bg-blue-500/10'
          }`}>
            <Workflow className={`w-5 h-5 ${graph.isSystem ? 'text-accent-text' : 'text-blue-400'}`} />
          </div>
          <div>
            <h4 className="font-semibold text-text-primary group-hover:text-accent-text transition-colors">
              {graph.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 ${graphTypeInfo.color}`}>
                <TypeIcon className="w-3 h-3" />
                {graphTypeInfo.label}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierInfo.color}`}>
                {tierInfo.label}
              </span>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex items-center gap-1 ${ownershipLabel.color}`}>
                <ownershipLabel.icon className="w-3 h-3" />
                {ownershipLabel.text}
              </span>
              {graph.isDefault && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Default
                </span>
              )}
              {graph.parentGraphId && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                  <GitFork className="w-3 h-3" />
                  Fork
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.preventDefault();
              onMenuToggle(isMenuOpen ? null : graph.graphId);
            }}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => onMenuToggle(null)} 
              />
              <div className="absolute right-0 top-full mt-1 w-44 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 py-1">
                <Link
                  href={`/studio/${graph.graphId}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
                  onClick={() => onMenuToggle(null)}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Studio
                </Link>
                <Link
                  href={`/automations/new?graphId=${graph.graphId}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-accent-text hover:bg-accent/10"
                  onClick={() => onMenuToggle(null)}
                >
                  <Zap className="w-4 h-4" />
                  Create Automation
                </Link>
                
                {/* Fork option - for system graphs or graphs user doesn't own */}
                {(!graph.isOwned || graph.isSystem || graph.isImmutable) && (
                  <button 
                    onClick={handleFork}
                    disabled={forking}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-400 hover:bg-purple-500/10 disabled:opacity-50"
                  >
                    {forking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <GitFork className="w-4 h-4" />
                    )}
                    Fork to Customize
                  </button>
                )}
                
                {/* Edit options - only for owned, non-system, non-immutable graphs */}
                {isEditable && (
                  <>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary">
                      <Pencil className="w-4 h-4" />
                      Rename
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary hover:text-text-primary">
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <hr className="my-1 border-border" />
                    <button 
                      onClick={() => { onMenuToggle(null); setShowDeleteConfirm(true); }}
                      disabled={deleting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {deleting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-text-secondary line-clamp-2 mb-4">
        {graph.description || 'No description'}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          {graph.nodeCount} nodes
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          {graph.edgeCount} edges
        </span>
        {graph.forkCount !== undefined && graph.forkCount > 0 && (
          <span className="flex items-center gap-1">
            <GitFork className="w-3 h-3" />
            {graph.forkCount}
          </span>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <span className="text-xs text-text-muted flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(graph.updatedAt).toLocaleDateString()}
        </span>
        <Link
          href={`/studio/${graph.graphId}`}
          className="text-xs text-accent-text hover:text-accent-hover font-medium"
        >
          Open →
        </Link>
      </div>

      <ErrorModal
        isOpen={!!deleteError}
        onClose={() => setDeleteError(null)}
        message={deleteError || ''}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Graph"
        message={`Are you sure you want to delete "${graph.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
