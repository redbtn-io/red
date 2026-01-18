'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Database,
  Cog,
  Zap,
  Code,
  FileText,
  Bot,
  Brain,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { useGraphStore } from '@/lib/stores/graphStore';
import type { StudioNodeData } from '@/lib/stores/graphStore';

interface NodeTypeInfo {
  nodeId: string;
  name: string;
  description: string;
  tags?: string[];
  tier: string;
  inputs: string[];
  outputs: string[];
}

interface CategoryGroup {
  name: string;
  nodes: NodeTypeInfo[];
  expanded: boolean;
}

interface NodePaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeAdded?: () => void;
}

// Category colors matching StudioNode
const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-blue-600',
  processing: 'bg-purple-600',
  flow: 'bg-green-600',
  io: 'bg-amber-600',
  llm: 'bg-indigo-600',
  rag: 'bg-teal-600',
  tool: 'bg-orange-600',
  default: 'bg-gray-600',
};

// Icon mapping by category
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  core: Cog,
  processing: Code,
  flow: GitBranch,
  io: Database,
  llm: Bot,
  rag: Brain,
  tool: Zap,
  default: FileText,
};

/**
 * NodePalette Component
 * 
 * Sidebar displaying available node types grouped by category.
 * Nodes can be dragged onto the canvas (desktop) or tapped to add (mobile).
 */
export default function NodePalette({ isOpen, onClose, onNodeAdded }: NodePaletteProps) {
  const [nodeTypes, setNodeTypes] = useState<NodeTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['core', 'llm', 'flow']));
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const { addNode, selectNode, nodes } = useGraphStore();

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Add node to canvas (for touch devices)
  const handleAddNode = useCallback((node: NodeTypeInfo) => {
    // Find a good position - center of canvas or offset from last node
    const existingNodes = nodes.filter(n => !['__start__', '__end__'].includes(n.id));
    let position = { x: 300, y: 200 };
    
    if (existingNodes.length > 0) {
      const lastNode = existingNodes[existingNodes.length - 1];
      position = {
        x: lastNode.position.x + 50,
        y: lastNode.position.y + 100,
      };
    }

    const nodeId = `${node.nodeId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    
    const newNode = {
      id: nodeId,
      type: 'studioNode',
      position,
      draggable: true,
      selectable: true,
      data: {
        label: node.name,
        nodeType: node.nodeId,
        description: node.description,
        config: {},
      } as StudioNodeData,
    };

    addNode(newNode);
    selectNode(nodeId);
    
    // Close palette on mobile after adding
    if (window.innerWidth < 1024) {
      onClose();
    }
    
    // Notify parent that a node was added (opens config on mobile)
    if (onNodeAdded) {
      onNodeAdded();
    }
  }, [nodes, addNode, selectNode, onClose, onNodeAdded]);

  // Fetch available node types
  useEffect(() => {
    async function fetchNodeTypes() {
      try {
        const response = await fetch('/api/v1/nodes');
        if (!response.ok) {
          throw new Error('Failed to fetch node types');
        }
        const data = await response.json();
        setNodeTypes(data.nodes || []);
      } catch (err) {
        console.error('Error fetching node types:', err);
        setError(err instanceof Error ? err.message : 'Failed to load nodes');
      } finally {
        setLoading(false);
      }
    }

    fetchNodeTypes();
  }, []);

  // Filter nodes by search query
  const filteredNodes = searchQuery
    ? nodeTypes.filter(
        (node) =>
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (node.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : nodeTypes;

  // Group nodes by first tag (or 'default' if no tags)
  const categoryGroups: CategoryGroup[] = filteredNodes.reduce((groups, node) => {
    const category = (node.tags && node.tags[0]) || 'default';
    let group = groups.find((g) => g.name === category);
    if (!group) {
      group = { name: category, nodes: [], expanded: expandedCategories.has(category) };
      groups.push(group);
    }
    group.nodes.push(node);
    return groups;
  }, [] as CategoryGroup[]);

  // Sort categories
  const sortedGroups = categoryGroups.sort((a, b) => {
    const order = ['core', 'llm', 'flow', 'processing', 'io', 'rag', 'tool'];
    const aIndex = order.indexOf(a.name);
    const bIndex = order.indexOf(b.name);
    if (aIndex === -1 && bIndex === -1) return a.name.localeCompare(b.name);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Drag start handler - encode node data for drop
  const handleDragStart = (event: React.DragEvent, node: NodeTypeInfo) => {
    // Set the drag data type
    event.dataTransfer.setData('application/reactflow-type', node.nodeId);
    // Set the node data
    event.dataTransfer.setData(
      'application/reactflow-data',
      JSON.stringify({
        nodeType: node.nodeId,
        label: node.name,
        description: node.description,
        inputs: node.inputs,
        outputs: node.outputs,
      })
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  if (loading) {
    return (
      <AppSidebar isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-6 h-6 text-text-secondary animate-spin" />
        </div>
      </AppSidebar>
    );
  }

  if (error) {
    return (
      <AppSidebar isOpen={isOpen} onClose={onClose}>
        <div className="flex items-center gap-2 text-red-400 p-4">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">{error}</span>
        </div>
      </AppSidebar>
    );
  }

  return (
    <AppSidebar isOpen={isOpen} onClose={onClose}>
      {/* Search & Title */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary">Nodes</h2>
          <Link
            href="/studio/create-node"
            className="flex items-center gap-1 text-xs text-accent-text hover:text-accent-hover transition-colors"
          >
            <Plus className="w-3 h-3" />
            Create
          </Link>
        </div>
        
        {/* Mobile hint */}
        {isTouchDevice && (
          <p className="text-xs text-text-muted mb-3">
            Tap a node to add it to the canvas
          </p>
        )}
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {/* Node List */}
      <div className="p-2 overflow-y-auto">
        {/* Start/End nodes - always visible */}
        <div className="mb-4">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider px-2 mb-2">
            Flow Control
          </div>
          
          <div
            draggable={!isTouchDevice}
            onDragStart={(e) =>
              handleDragStart(e, {
                nodeId: 'start',
                name: 'Start',
                description: 'Entry point',
                tags: ['flow'],
                tier: 'free',
                inputs: [],
                outputs: ['flow'],
              })
            }
            onClick={() => isTouchDevice && handleAddNode({
              nodeId: 'start',
              name: 'Start',
              description: 'Entry point',
              tags: ['flow'],
              tier: 'free',
              inputs: [],
              outputs: ['flow'],
            })}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary active:bg-bg-tertiary cursor-grab active:cursor-grabbing transition-colors mb-1 touch-manipulation"
          >
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">Start</div>
              <div className="text-xs text-text-muted">Entry point</div>
            </div>
            {isTouchDevice && <Plus className="w-4 h-4 text-text-muted" />}
          </div>
          
          <div
            draggable={!isTouchDevice}
            onDragStart={(e) =>
              handleDragStart(e, {
                nodeId: 'end',
                name: 'End',
                description: 'Exit point',
                tags: ['flow'],
                tier: 'free',
                inputs: ['flow'],
                outputs: [],
              })
            }
            onClick={() => isTouchDevice && handleAddNode({
              nodeId: 'end',
              name: 'End',
              description: 'Exit point',
              tags: ['flow'],
              tier: 'free',
              inputs: ['flow'],
              outputs: [],
            })}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary active:bg-bg-tertiary cursor-grab active:cursor-grabbing transition-colors touch-manipulation"
          >
            <div className="w-3 h-3 rounded-sm bg-red-500" />
            <div className="flex-1">
              <div className="text-sm font-medium text-text-primary">End</div>
              <div className="text-xs text-text-muted">Exit point</div>
            </div>
            {isTouchDevice && <Plus className="w-4 h-4 text-text-muted" />}
          </div>
        </div>

        {/* Categorized nodes */}
        {sortedGroups.map((group) => {
          const CategoryIcon = CATEGORY_ICONS[group.name] || CATEGORY_ICONS.default;
          const isExpanded = expandedCategories.has(group.name);

          return (
            <div key={group.name} className="mb-2">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(group.name)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-bg-secondary transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                )}
                <CategoryIcon className="w-4 h-4 text-text-secondary" />
                <span className="text-xs font-medium text-text-secondary uppercase tracking-wider flex-1 text-left">
                  {group.name}
                </span>
                <span className="text-xs text-text-disabled">{group.nodes.length}</span>
              </button>

              {/* Category nodes */}
              {isExpanded && (
                <div className="ml-2 mt-1 space-y-1">
                  {group.nodes.map((node) => {
                    const firstTag = (node.tags && node.tags[0]) || 'default';
                    const colorClass = CATEGORY_COLORS[firstTag] || CATEGORY_COLORS.default;

                    return (
                      <div
                        key={node.nodeId}
                        draggable={!isTouchDevice}
                        onDragStart={(e) => handleDragStart(e, node)}
                        onClick={() => isTouchDevice && handleAddNode(node)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-secondary hover:bg-bg-tertiary active:bg-bg-tertiary cursor-grab active:cursor-grabbing transition-colors group touch-manipulation"
                      >
                        <div className={`w-2 h-6 rounded-full ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-text-primary break-words">
                            {node.name}
                          </div>
                          <div className="text-xs text-text-muted break-words">
                            {node.description}
                          </div>
                        </div>
                        {isTouchDevice && <Plus className="w-4 h-4 text-text-muted flex-shrink-0" />}
                        {node.tier !== 'free' && (
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0 ${
                              node.tier === 'basic'
                                ? 'bg-blue-900/50 text-blue-400'
                                : node.tier === 'pro'
                                ? 'bg-purple-900/50 text-purple-400'
                                : 'bg-amber-900/50 text-amber-400'
                            }`}
                          >
                            {node.tier}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredNodes.length === 0 && searchQuery && (
          <div className="text-center py-8 text-text-muted">
            <p className="text-sm">No nodes found</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </div>
    </AppSidebar>
  );
}
