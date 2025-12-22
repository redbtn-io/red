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
  Zap
} from 'lucide-react';
import { 
  pageVariants, 
  staggerContainerVariants, 
  staggerItemVariants,
  fadeUpVariants,
} from '@/lib/animations';
import { ErrorModal } from '@/components/ui/Modal';

interface GraphInfo {
  graphId: string;
  name: string;
  description?: string;
  tier: number;
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

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  1: { label: 'Ultimate', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  2: { label: 'Advanced', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  3: { label: 'Basic', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  4: { label: 'Free', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

export default function GraphsPage() {
  const [graphs, setGraphs] = useState<GraphInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'mine' | 'system'>('all');
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
    // Filter
    if (filter === 'mine' && g.isSystem) return false;
    if (filter === 'system' && !g.isSystem) return false;
    
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
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
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
      <motion.div className="flex flex-col sm:flex-row gap-3" variants={fadeUpVariants}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search graphs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ef4444]"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'mine', 'system'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30'
                  : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a]'
              }`}
            >
              {f}
            </button>
          ))}
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
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
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
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
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
          <Workflow className="w-16 h-16 text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No graphs found</h3>
          <p className="text-gray-500 text-sm max-w-sm">
            {searchQuery 
              ? 'Try a different search term'
              : 'Create your first graph to get started'}
          </p>
          {!searchQuery && (
            <Link
              href="/studio"
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors font-medium text-sm"
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
  const isMenuOpen = openMenuId === graph.graphId;
  const [forking, setForking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
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
    if (!confirm(`Are you sure you want to delete "${graph.name}"? This cannot be undone.`)) {
      return;
    }
    
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
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#3a3a3a] transition-colors group relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            graph.isSystem ? 'bg-[#ef4444]/10' : 'bg-blue-500/10'
          }`}>
            <Workflow className={`w-5 h-5 ${graph.isSystem ? 'text-[#ef4444]' : 'text-blue-400'}`} />
          </div>
          <div>
            <h4 className="font-semibold text-white group-hover:text-[#ef4444] transition-colors">
              {graph.name}
            </h4>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
            className="p-1.5 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => onMenuToggle(null)} 
              />
              <div className="absolute right-0 top-full mt-1 w-44 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
                <Link
                  href={`/studio/${graph.graphId}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white"
                  onClick={() => onMenuToggle(null)}
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Studio
                </Link>
                <Link
                  href={`/automations/new?graphId=${graph.graphId}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[#ef4444] hover:bg-[#ef4444]/10"
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
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white">
                      <Pencil className="w-4 h-4" />
                      Rename
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white">
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                    <hr className="my-1 border-[#2a2a2a]" />
                    <button 
                      onClick={handleDelete}
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
      <p className="text-sm text-gray-400 line-clamp-2 mb-4">
        {graph.description || 'No description'}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
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
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#2a2a2a]">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(graph.updatedAt).toLocaleDateString()}
        </span>
        <Link
          href={`/studio/${graph.graphId}`}
          className="text-xs text-[#ef4444] hover:text-[#f87171] font-medium"
        >
          Open →
        </Link>
      </div>

      <ErrorModal
        isOpen={!!deleteError}
        onClose={() => setDeleteError(null)}
        message={deleteError || ''}
      />
    </div>
  );
}
