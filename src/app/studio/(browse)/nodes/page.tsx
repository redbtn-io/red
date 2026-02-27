'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { ConfirmModal } from '@/components/ui/Modal';
import { 
  Search, 
  Box, 
  Loader2, 
  AlertCircle,
  ChevronDown,
  ChevronRight,
  GitBranch,
  MessageSquare,
  Database,
  ListTodo,
  Play,
  Globe,
  FileText,
  Tags as TagsIcon,
  Blocks,
  Wrench,
  Shuffle,
  Zap,
  Code,
  Bot,
  Brain,
  Repeat,
  Plus,
  LucideProps,
  GitFork,
  Pencil,
  Lock,
  User,
  Shield,
  Star,
  Bookmark,
  Clock,
  Filter,
  SortAsc,
  SortDesc,
  X,
  Settings,
  Archive,
  Trash2,
} from 'lucide-react';
import { pageVariants, staggerContainerVariants, staggerItemVariants, scaleVariants } from '@/lib/animations';

interface StepConfig {
  type: 'neuron' | 'tool' | 'transform' | 'conditional' | 'loop';
  config: Record<string, unknown>;
}

interface NodeTypeInfo {
  nodeId: string;
  name: string;
  description?: string;
  tags: string[];
  isSystem: boolean;
  isImmutable?: boolean;
  isPublic?: boolean;
  isOwned?: boolean;
  isSaved?: boolean;
  isFavorited?: boolean;
  isArchived?: boolean;
  isAbandoned?: boolean;
  status?: 'active' | 'abandoned' | 'deleted';
  creatorId?: string;
  parentNodeId?: string;
  ownerName?: string;
  tier: number;
  icon?: string;
  color?: string;
  inputs: string[];
  outputs: string[];
  steps?: StepConfig[];
  stats?: {
    usageCount: number;
    forkCount: number;
    lastUsedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  GitBranch,
  MessageSquare,
  Database,
  ListTodo,
  Play,
  Search: Search,
  Globe,
  FileText,
  Tags: TagsIcon,
  Blocks,
  Wrench,
  Shuffle,
  Zap,
  Code,
  Bot,
  Brain,
  Box,
  Repeat,
  Settings,
};

// Generate a consistent color from a string (tag or nodeId)
// Returns a hex color that's deterministic based on input
const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#f43f5e', // rose
];

function getNodeColor(node: NodeTypeInfo): string {
  // If node has an explicit color, use it
  if (node.color) return node.color;
  
  // Generate color from first tag, or nodeId if no tags
  const seed = node.tags?.[0] || node.nodeId || 'default';
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// Step type styling
const STEP_TYPE_INFO: Record<string, { icon: React.ComponentType<LucideProps>; color: string; bgColor: string; label: string }> = {
  neuron: { icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30', label: 'Neuron' },
  tool: { icon: Wrench, color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30', label: 'Tool' },
  transform: { icon: Shuffle, color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30', label: 'Transform' },
  conditional: { icon: GitBranch, color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30', label: 'Conditional' },
  loop: { icon: Repeat, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20 border-cyan-500/30', label: 'Loop' },
};

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  1: { label: 'Ultimate', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  2: { label: 'Advanced', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  3: { label: 'Basic', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  4: { label: 'Free', color: 'bg-gray-500/20 text-text-secondary border-gray-500/30' },
};

// View tabs
type ViewTab = 'explore' | 'saved' | 'favorited' | 'recent' | 'mine' | 'archived';

// Sort options
const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'createdAt', label: 'Date Created' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'usageCount', label: 'Most Used' },
  { value: 'forkCount', label: 'Most Forked' },
] as const;

type SortField = typeof SORT_OPTIONS[number]['value'];

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<NodeTypeInfo | null>(null);
  const [loadingNodeDetails, setLoadingNodeDetails] = useState(false);
  const [sheetExpandTrigger, setSheetExpandTrigger] = useState(0);
  
  // Filters
  const [activeTab, setActiveTab] = useState<ViewTab>('explore');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [includeSystem, setIncludeSystem] = useState(true);
  const [includePublic, setIncludePublic] = useState(true);

  // Build query params for API
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    
    if (searchQuery) params.set('q', searchQuery);
    if (selectedTags.length > 0) params.set('tags', selectedTags.join(','));
    if (activeTab === 'mine') params.set('owner', 'me');
    if (activeTab === 'saved') params.set('view', 'saved');
    if (activeTab === 'favorited') params.set('view', 'favorited');
    if (activeTab === 'recent') params.set('view', 'recent');
    if (activeTab === 'archived') params.set('view', 'archived');
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);
    params.set('includeSystem', String(includeSystem));
    params.set('includePublic', String(includePublic));
    
    return params.toString();
  }, [searchQuery, selectedTags, activeTab, sortBy, sortOrder, includeSystem, includePublic]);

  // Fetch nodes
  const fetchNodes = useCallback(async () => {
    setLoading(true);
    try {
      const queryString = buildQueryParams();
      const response = await fetch(`/api/v1/nodes?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch nodes');
      const data = await response.json();
      setNodes(data.nodes || []);
      if (data.availableTags) {
        setAvailableTags(data.availableTags);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nodes');
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  // Fetch full node details when selected
  const handleSelectNode = async (node: NodeTypeInfo) => {
    setSelectedNode(node);
    setSheetExpandTrigger(t => t + 1);
    setLoadingNodeDetails(true);
    try {
      const response = await fetch(`/api/v1/nodes/${node.nodeId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedNode({
          ...node,
          steps: data.fullConfig || [],
        });
      }
    } catch (err) {
      console.error('Error fetching node details:', err);
    } finally {
      setLoadingNodeDetails(false);
    }
  };

  // Toggle tag filter
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedTags([]);
    setSearchQuery('');
    setSortBy('name');
    setSortOrder('asc');
    setIncludeSystem(true);
    setIncludePublic(true);
  };

  const hasActiveFilters = selectedTags.length > 0 || sortBy !== 'name' || sortOrder !== 'asc' || !includeSystem || !includePublic;

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
      className="flex flex-col gap-6"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* View Tabs */}
      <motion.div 
        className="flex flex-wrap gap-2 border-b border-border pb-4"
        variants={staggerItemVariants}
      >
        {[
          { id: 'explore' as ViewTab, label: 'Explore', icon: Search },
          { id: 'saved' as ViewTab, label: 'Saved', icon: Bookmark },
          { id: 'favorited' as ViewTab, label: 'Favorites', icon: Star },
          { id: 'recent' as ViewTab, label: 'Recent', icon: Clock },
          { id: 'mine' as ViewTab, label: 'My Nodes', icon: User },
          { id: 'archived' as ViewTab, label: 'Archived', icon: Archive },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white'
                : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </motion.div>

      {/* Search & Filters Row */}
      <motion.div 
        className="flex flex-col md:flex-row gap-3"
        variants={staggerItemVariants}
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortField)}
            className="bg-bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="p-2.5 bg-bg-secondary border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </button>
        </div>

        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
            showFilters || hasActiveFilters
              ? 'bg-accent/10 border-accent text-accent-text'
              : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full">
              {selectedTags.length + (sortBy !== 'name' ? 1 : 0) + (!includeSystem ? 1 : 0) + (!includePublic ? 1 : 0)}
            </span>
          )}
        </button>
      </motion.div>

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-bg-secondary border border-border rounded-xl p-4 overflow-hidden"
          >
            <div className="flex flex-col gap-4">
              {/* Tags */}
              <div>
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-accent text-white'
                          : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                  {availableTags.length === 0 && (
                    <p className="text-text-muted text-sm">No tags available</p>
                  )}
                </div>
              </div>

              {/* Visibility Options */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSystem}
                    onChange={(e) => setIncludeSystem(e.target.checked)}
                    className="rounded border-gray-600 bg-transparent text-accent-text focus:ring-accent"
                  />
                  Show System Nodes
                </label>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePublic}
                    onChange={(e) => setIncludePublic(e.target.checked)}
                    className="rounded border-gray-600 bg-transparent text-accent-text focus:ring-accent"
                  />
                  Show Public Nodes
                </label>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 text-sm text-accent-text hover:text-accent-hover transition-colors w-fit"
                >
                  <X className="w-4 h-4" />
                  Clear All Filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <motion.div 
          className="flex flex-wrap items-center gap-2"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-xs text-text-muted">Filtering by:</span>
          {selectedTags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1 px-2 py-1 bg-accent/10 text-accent-text text-xs rounded-full"
            >
              {tag}
              <button onClick={() => toggleTag(tag)} className="hover:text-text-primary">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Node Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-text-secondary animate-spin" />
            </div>
          ) : nodes.length === 0 ? (
            <motion.div 
              className="flex flex-col items-center justify-center py-16 text-center bg-bg-secondary border border-border rounded-xl"
              variants={scaleVariants}
            >
              <Box className="w-16 h-16 text-text-disabled mb-4" />
              <h3 className="text-lg font-medium text-text-secondary mb-2">
                {activeTab === 'saved' ? 'No saved nodes' :
                 activeTab === 'favorited' ? 'No favorite nodes' :
                 activeTab === 'recent' ? 'No recent nodes' :
                 activeTab === 'mine' ? 'No nodes created yet' :
                 activeTab === 'archived' ? 'No archived nodes' :
                 'No nodes found'}
              </h3>
              <p className="text-text-muted text-sm">
                {activeTab === 'explore' ? 'Try adjusting your search or filters' :
                 activeTab === 'mine' ? 'Create your first custom node' :
                 activeTab === 'archived' ? 'Nodes you archive will appear here' :
                 'Explore nodes and save them for quick access'}
              </p>
            </motion.div>
          ) : (
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              {nodes.map(node => (
                <NodeCard 
                  key={node.nodeId}
                  node={node}
                  isSelected={selectedNode?.nodeId === node.nodeId}
                  onSelect={() => handleSelectNode(node)}
                  onRefresh={fetchNodes}
                />
              ))}
            </motion.div>
          )}
        </div>

        {/* Node Detail Panel - Desktop */}
        <AnimatePresence mode="wait">
          {selectedNode && (
            <motion.div 
              key={selectedNode.nodeId}
              className="hidden lg:block lg:w-96"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <NodeDetail 
                node={selectedNode} 
                onClose={() => setSelectedNode(null)}
                loading={loadingNodeDetails}
                onRefresh={fetchNodes}
                onSelectForked={async (nodeId) => {
                  // Fetch the forked node directly to avoid stale closure issues
                  try {
                    const response = await fetch(`/api/v1/nodes/${nodeId}`);
                    if (response.ok) {
                      const data = await response.json();
                      setSelectedNode({
                        nodeId: data.nodeId,
                        name: data.name,
                        description: data.description,
                        tags: data.tags || [],
                        icon: data.icon,
                        color: data.color,
                        isSystem: false, // Forked nodes are never system nodes
                        isOwned: true, // Forked nodes always belong to the user
                        isImmutable: false, // Forked nodes are editable
                        isPublic: data.isPublic,
                        isSaved: data.isSaved,
                        isFavorited: data.isFavorited,
                        tier: data.tier || 0,
                        inputs: data.inputs || [],
                        outputs: data.outputs || [],
                        steps: data.fullConfig || [],
                        stats: data.stats,
                      });
                      setSheetExpandTrigger(t => t + 1);
                    }
                  } catch (err) {
                    console.error('Error selecting forked node:', err);
                  }
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        hasContent={!!selectedNode}
        expandTrigger={sheetExpandTrigger}
        onDismiss={() => setSelectedNode(null)}
        peekContent={
          selectedNode ? (
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${selectedNode.color || '#3b82f6'}20` }}
              >
                {(() => {
                  const IconComp = ICON_MAP[selectedNode.icon || 'Box'] || Box;
                  return <IconComp className="w-4 h-4" style={{ color: selectedNode.color || '#3b82f6' }} />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{selectedNode.name}</p>
                <p className="text-xs text-text-muted">Tap to see details</p>
              </div>
            </div>
          ) : (
            <Link 
              href="/studio/create-node"
              className="flex items-center gap-3 text-text-secondary hover:text-text-primary transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-sm">Create a new node</span>
            </Link>
          )
        }
      >
        {selectedNode && (
          <NodeDetail 
            node={selectedNode} 
            onClose={() => setSelectedNode(null)}
            loading={loadingNodeDetails}
            onRefresh={fetchNodes}
            onSelectForked={async (nodeId) => {
              // Fetch the forked node directly to avoid stale closure issues
              try {
                const response = await fetch(`/api/v1/nodes/${nodeId}`);
                if (response.ok) {
                  const data = await response.json();
                  setSelectedNode({
                    nodeId: data.nodeId,
                    name: data.name,
                    description: data.description,
                    tags: data.tags || [],
                    icon: data.icon,
                    color: data.color,
                    isSystem: false, // Forked nodes are never system nodes
                    isOwned: true, // Forked nodes always belong to the user
                    isImmutable: false, // Forked nodes are editable
                    isPublic: data.isPublic,
                    isSaved: data.isSaved,
                    isFavorited: data.isFavorited,
                    tier: data.tier || 0,
                    inputs: data.inputs || [],
                    outputs: data.outputs || [],
                    steps: data.fullConfig || [],
                    stats: data.stats,
                  });
                  setSheetExpandTrigger(t => t + 1);
                }
              } catch (err) {
                console.error('Error selecting forked node:', err);
              }
            }}
            compact
          />
        )}
      </BottomSheet>
    </motion.div>
  );
}

function NodeCard({ 
  node, 
  isSelected,
  onSelect,
  onRefresh
}: { 
  node: NodeTypeInfo;
  isSelected: boolean;
  onSelect: () => void;
  onRefresh: () => void;
}) {
  const IconComponent = ICON_MAP[node.icon || 'Box'] || Box;
  const tierInfo = TIER_LABELS[node.tier] || TIER_LABELS[4];
  const [actionLoading, setActionLoading] = useState<'save' | 'favorite' | null>(null);
  const nodeColor = getNodeColor(node);
  
  // Determine ownership status
  const ownershipLabel = node.isSystem 
    ? { text: 'System', icon: Shield, color: 'text-blue-400' }
    : node.isOwned 
      ? { text: 'Yours', icon: User, color: 'text-green-400' }
      : { text: node.ownerName || 'Shared', icon: Lock, color: 'text-yellow-400' };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading('save');
    try {
      await fetch('/api/v1/nodes/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: node.isSaved ? 'unsave' : 'save',
          nodeId: node.nodeId 
        })
      });
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoading('favorite');
    try {
      await fetch('/api/v1/nodes/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: node.isFavorited ? 'unfavorite' : 'favorite',
          nodeId: node.nodeId 
        })
      });
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <motion.div
      variants={staggerItemVariants}
      onClick={onSelect}
      className={`bg-bg-secondary border rounded-xl p-4 cursor-pointer transition-all hover:border-gray-600 ${
        isSelected ? 'border-accent ring-1 ring-accent' : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${nodeColor}20` }}
        >
          <IconComponent className="w-6 h-6" color={nodeColor} />
        </div>
        <div className="flex items-center gap-1">
          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={actionLoading === 'save'}
            className={`p-1.5 rounded-lg transition-colors ${
              node.isSaved 
                ? 'text-accent-text hover:bg-accent/10' 
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
            }`}
            title={node.isSaved ? 'Remove from saved' : 'Save node'}
          >
            {actionLoading === 'save' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bookmark className={`w-4 h-4 ${node.isSaved ? 'fill-current' : ''}`} />
            )}
          </button>
          {/* Favorite Button */}
          <button
            onClick={handleFavorite}
            disabled={actionLoading === 'favorite'}
            className={`p-1.5 rounded-lg transition-colors ${
              node.isFavorited 
                ? 'text-yellow-400 hover:bg-yellow-400/10' 
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
            }`}
            title={node.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            {actionLoading === 'favorite' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Star className={`w-4 h-4 ${node.isFavorited ? 'fill-current' : ''}`} />
            )}
          </button>
        </div>
      </div>

      {/* Name & Description */}
      <h3 className="font-semibold text-text-primary truncate">{node.name}</h3>
      <p className="text-xs text-text-muted mt-1 line-clamp-2">{node.description}</p>

      {/* Tags */}
      {node.tags && node.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {node.tags.slice(0, 3).map(tag => (
            <span 
              key={tag}
              className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary"
            >
              {tag}
            </span>
          ))}
          {node.tags.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted">
              +{node.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1 ${ownershipLabel.color}`}>
            <ownershipLabel.icon className="w-3 h-3" />
            {ownershipLabel.text}
          </span>
          {node.parentNodeId && (
            <span className="text-[10px] text-purple-400 flex items-center gap-0.5">
              <GitFork className="w-3 h-3" />
              Fork
            </span>
          )}
        </div>
        {node.stats && (
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            {node.stats.usageCount > 0 && (
              <span className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                {node.stats.usageCount}
              </span>
            )}
            {node.stats.forkCount > 0 && (
              <span className="flex items-center gap-1">
                <GitFork className="w-3 h-3" />
                {node.stats.forkCount}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function NodeDetail({ node, onClose, loading, onRefresh, onSelectForked, compact }: { node: NodeTypeInfo; onClose: () => void; loading?: boolean; onRefresh?: () => void; onSelectForked?: (nodeId: string) => void; compact?: boolean }) {
  const IconComponent = ICON_MAP[node.icon || 'Box'] || Box;
  const tierInfo = TIER_LABELS[node.tier] || TIER_LABELS[4];
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [actionLoading, setActionLoading] = useState<'fork' | 'archive' | 'delete' | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const nodeColor = getNodeColor(node);

  // Determine if user can edit directly or needs to fork
  const isEditable = node.isOwned && !node.isImmutable && !node.isSystem;
  const canFork = !node.isOwned || node.isSystem || node.isImmutable;

  // Ownership label
  const ownershipLabel = node.isSystem 
    ? { text: 'System Node', icon: Shield, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', description: 'Protected system node - fork to customize' }
    : node.isOwned 
      ? node.isImmutable 
        ? { text: 'Your Node (Locked)', icon: Lock, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', description: 'Your node but marked immutable - fork to modify' }
        : { text: 'Your Node', icon: User, color: 'text-green-400 bg-green-500/10 border-green-500/30', description: 'You own this node and can edit it directly' }
      : { text: 'Shared Node', icon: Lock, color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', description: 'Owned by another user - fork to customize' };

  const handleFork = async () => {
    setActionLoading('fork');
    setActionMessage(null);
    try {
      const response = await fetch(`/api/v1/nodes/${node.nodeId}/fork`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newNodeId: crypto.randomUUID() })
      });
      const data = await response.json();
      if (response.ok) {
        setActionMessage({ type: 'success', text: `Forked as "${data.nodeId}"` });
        if (onRefresh) {
          onRefresh();
        }
        // Select the newly forked node after a brief delay for the list to refresh
        if (onSelectForked && data.nodeId) {
          setTimeout(() => onSelectForked(data.nodeId), 300);
        }
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to fork' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleArchive = async () => {
    setActionLoading('archive');
    setActionMessage(null);
    try {
      const isArchived = (node as any).isArchived;
      const method = isArchived ? 'DELETE' : 'POST';
      const url = isArchived 
        ? `/api/v1/user/preferences/archive?type=node&id=${node.nodeId}`
        : '/api/v1/user/preferences/archive';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ type: 'node', id: node.nodeId }) } : {})
      });
      
      if (response.ok) {
        setActionMessage({ type: 'success', text: isArchived ? 'Removed from archive' : 'Added to archive' });
        if (onRefresh) {
          onRefresh();
        }
        // Close detail panel after archiving since node will disappear from current view
        if (!isArchived) {
          setTimeout(() => onClose(), 500);
        }
      } else {
        const data = await response.json();
        setActionMessage({ type: 'error', text: data.error || 'Failed to archive' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading('delete');
    setActionMessage(null);
    try {
      const response = await fetch(`/api/v1/nodes/${node.nodeId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setActionMessage({ type: 'success', text: 'Node deleted' });
        if (onRefresh) {
          onRefresh();
        }
        setTimeout(() => onClose(), 500);
      } else {
        const data = await response.json();
        setActionMessage({ type: 'error', text: data.error || 'Failed to delete' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error' });
    } finally {
      setActionLoading(null);
      setShowDeleteConfirm(false);
    }
  };

  const toggleStep = (index: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  return (
    <div className={`bg-bg-secondary border border-border rounded-xl overflow-hidden ${compact ? '' : 'sticky top-20'}`}>
      {/* Header */}
      <div 
        className={`${compact ? 'p-4' : 'p-6'} border-b border-border relative`}
        style={{ backgroundColor: `${nodeColor}10` }}
      >
        {!compact && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-start gap-4">
          <div 
            className={`${compact ? 'w-10 h-10 rounded-lg' : 'w-14 h-14 rounded-xl'} flex items-center justify-center flex-shrink-0`}
            style={{ backgroundColor: `${nodeColor}20` }}
          >
            <IconComponent className="w-7 h-7" color={nodeColor} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-bold text-text-primary truncate">{node.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 ${ownershipLabel.color}`}>
                <ownershipLabel.icon className="w-3 h-3" />
                {ownershipLabel.text}
              </span>
            </div>
          </div>
        </div>
        {node.parentNodeId && (
          <p className="text-xs text-purple-400 mt-3 flex items-center gap-1">
            <GitFork className="w-3 h-3" />
            Forked from: <code className="bg-purple-500/10 px-1 rounded">{node.parentNodeId}</code>
          </p>
        )}
      </div>

      {/* Content - Scrollable only on desktop */}
      <div className={`p-6 space-y-6 ${compact ? '' : 'max-h-[calc(100vh-350px)] overflow-y-auto'}`}>
        {/* Ownership Info */}
        <div className={`p-3 rounded-lg border ${ownershipLabel.color.replace('text-', 'border-').replace('bg-', '')}`}>
          <p className="text-xs text-text-secondary">{ownershipLabel.description}</p>
        </div>

        {/* Action Message */}
        {actionMessage && (
          <div className={`p-3 rounded-lg text-sm ${
            actionMessage.type === 'success' 
              ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}>
            {actionMessage.text}
          </div>
        )}

        {/* Description */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Description
          </h4>
          <p className="text-sm text-text-secondary">{node.description || 'No description available'}</p>
        </div>

        {/* Tags */}
        {node.tags && node.tags.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Tags
            </h4>
            <div className="flex flex-wrap gap-2">
              {node.tags.map(tag => (
                <span 
                  key={tag}
                  className="text-xs px-2 py-1 rounded-full bg-bg-tertiary text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        {node.stats && (
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Statistics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-bg-tertiary rounded-lg p-3">
                <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                  <Play className="w-3 h-3" />
                  Times Used
                </div>
                <p className="text-lg font-semibold text-text-primary">{node.stats.usageCount}</p>
              </div>
              <div className="bg-bg-tertiary rounded-lg p-3">
                <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                  <GitFork className="w-3 h-3" />
                  Forks
                </div>
                <p className="text-lg font-semibold text-text-primary">{node.stats.forkCount}</p>
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
          </div>
        ) : node.steps && node.steps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
              Steps ({node.steps.length})
            </h4>
            <div className="space-y-2">
              {node.steps.map((step, index) => {
                const stepInfo = STEP_TYPE_INFO[step.type] || STEP_TYPE_INFO.transform;
                const StepIcon = stepInfo.icon;
                const isExpanded = expandedSteps.has(index);
                
                return (
                  <div key={index} className={`border rounded-lg overflow-hidden ${stepInfo.bgColor}`}>
                    <button
                      onClick={() => toggleStep(index)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-xs text-text-muted font-mono w-4">{index + 1}</span>
                      <StepIcon className={`w-4 h-4 ${stepInfo.color}`} />
                      <span className="text-xs font-medium text-text-secondary flex-1 text-left">
                        {stepInfo.label}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
                      )}
                    </button>
                    {isExpanded && step.config && (
                      <div className="px-3 pb-3 pt-1 border-t border-white/10">
                        <StepConfigDisplay type={step.type} config={step.config} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inputs */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Inputs
          </h4>
          <div className="flex flex-wrap gap-2">
            {node.inputs.map((input, i) => (
              <span 
                key={i}
                className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-1 rounded"
              >
                {input}
              </span>
            ))}
          </div>
        </div>

        {/* Outputs */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Outputs
          </h4>
          <div className="flex flex-wrap gap-2">
            {node.outputs.map((output, i) => (
              <span 
                key={i}
                className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-2 py-1 rounded"
              >
                {output}
              </span>
            ))}
          </div>
        </div>

        {/* Node ID */}
        <div>
          <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
            Node ID
          </h4>
          <code className="text-xs bg-bg-tertiary text-text-secondary px-2 py-1 rounded font-mono">
            {node.nodeId}
          </code>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2">
          {/* Fork button - always available for non-owned or immutable nodes */}
          {canFork && (
            <button
              onClick={handleFork}
              disabled={actionLoading === 'fork'}
              className="flex items-center justify-center gap-2 w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-text-primary py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              {actionLoading === 'fork' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GitFork className="w-4 h-4" />
              )}
              Fork to Customize
            </button>
          )}

          {/* Edit button - only for owned, non-immutable nodes */}
          {isEditable && (
            <Link
              href={`/studio/edit-node/${node.nodeId}`}
              className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-text-primary py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit Node
            </Link>
          )}

          {/* Use in Studio button */}
          <Link
            href={`/studio?addNode=${node.nodeId}`}
            className="flex items-center justify-center gap-2 w-full bg-accent hover:bg-accent-hover text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Use in Studio
          </Link>

          {/* Archive button - available for all non-system nodes */}
          {!node.isSystem && (
            <button
              onClick={handleArchive}
              disabled={actionLoading === 'archive'}
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${
                (node as any).isArchived
                  ? 'bg-amber-600 hover:bg-amber-700 text-text-primary'
                  : 'bg-bg-tertiary hover:bg-bg-active text-text-secondary border border-border-hover'
              }`}
            >
              {actionLoading === 'archive' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Archive className="w-4 h-4" />
              )}
              {(node as any).isArchived ? 'Unarchive' : 'Archive'}
            </button>
          )}

          {/* Delete button - only for owned, non-system nodes */}
          {isEditable && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={actionLoading === 'delete'}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium transition-colors bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30"
            >
              {actionLoading === 'delete' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete Node
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Node"
        message={`Are you sure you want to delete "${node.name}"? This cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

// Configurable fields per step type (fields that can be edited at runtime)
const CONFIGURABLE_FIELDS: Record<string, string[]> = {
  neuron: ['neuronId', 'systemPrompt', 'userPrompt', 'temperature', 'maxTokens', 'stream'],
  tool: ['toolName', 'parameters'],
  transform: ['operation', 'inputField', 'outputField', 'value', 'template'],
  conditional: ['condition', 'setField', 'trueValue', 'falseValue'],
  loop: ['iteratorField', 'maxIterations', 'outputField'],
};

// Display step config in a readable format
function StepConfigDisplay({ type, config }: { type: string; config: Record<string, unknown> }) {
  const configurableFields = CONFIGURABLE_FIELDS[type] || [];
  
  const renderField = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    
    const isConfigurable = configurableFields.includes(key);
    
    // Format the value based on type
    let displayValue: React.ReactNode = String(value);
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (typeof value === 'object') {
      displayValue = (
        <pre className="text-[10px] text-text-muted whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    } else if (typeof value === 'string' && value.length > 50) {
      displayValue = (
        <span className="text-[10px] text-text-secondary break-words">{value}</span>
      );
    }

    return (
      <div key={key} className="mb-2">
        <span className="text-[10px] text-text-muted uppercase tracking-wider flex items-center gap-1">
          {formatLabel(key)}
          {isConfigurable && (
            <span title="Editable parameter"><Pencil className="w-2.5 h-2.5 text-text-secondary" /></span>
          )}
        </span>
        <div className={`text-xs mt-0.5 ${isConfigurable ? 'text-text-primary' : 'text-text-secondary'}`}>{displayValue}</div>
      </div>
    );
  };

  // Prioritize certain fields based on step type
  const priorityFields: Record<string, string[]> = {
    neuron: ['systemPrompt', 'userPrompt', 'temperature', 'maxTokens', 'outputField'],
    tool: ['toolName', 'name', 'inputMapping', 'outputField'],
    transform: ['operation', 'inputField', 'outputField', 'value'],
    conditional: ['condition', 'setField', 'trueValue', 'falseValue'],
    loop: ['iteratorField', 'maxIterations', 'outputField'],
  };

  const fields = priorityFields[type] || Object.keys(config);
  const displayedKeys = new Set<string>();

  return (
    <div className="space-y-1">
      {fields.map((key) => {
        if (config[key] !== undefined) {
          displayedKeys.add(key);
          return renderField(key, config[key]);
        }
        return null;
      })}
      {/* Show remaining fields */}
      {Object.entries(config).map(([key, value]) => {
        if (!displayedKeys.has(key)) {
          return renderField(key, value);
        }
        return null;
      })}
    </div>
  );
}

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}
