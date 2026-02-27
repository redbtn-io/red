'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    Loader2,
    AlertCircle,
    GitBranch,
    X,
    Box,
    MessageSquare,
    Search,
    Wrench,
    Play,
    Shuffle,
    Globe,
    FileText,
    Zap,
    Database,
    Move,
    FileCode,
    Terminal,
    Info,
    Clock,
    ExternalLink,
    ScrollText,
} from 'lucide-react';

// ============================================================================
// Node Icon & Color Configuration
// ============================================================================

const nodeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  router: Shuffle,
  planner: GitBranch,
  executor: Play,
  respond: MessageSquare,
  search: Search,
  command: Wrench,
  context: Database,
  browse: Globe,
  summarizer: FileText,
  optimizer: Zap,
  error_handler: AlertCircle,
  default: Box,
};

// Each node type gets its own visual theme
const nodeThemes: Record<string, { bg: string; border: string; text: string; icon: string; accent: string }> = {
  router:        { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   icon: 'text-amber-400',   accent: '#f59e0b' },
  planner:       { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  icon: 'text-violet-400',  accent: '#8b5cf6' },
  executor:      { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    icon: 'text-blue-400',    accent: '#3b82f6' },
  respond:       { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: 'text-emerald-400', accent: '#10b981' },
  search:        { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    icon: 'text-cyan-400',    accent: '#06b6d4' },
  command:       { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400',    icon: 'text-pink-400',    accent: '#ec4899' },
  context:       { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  icon: 'text-indigo-400',  accent: '#6366f1' },
  browse:        { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-400',    icon: 'text-teal-400',    accent: '#14b8a6' },
  summarizer:    { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  icon: 'text-purple-400',  accent: '#a855f7' },
  optimizer:     { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  text: 'text-yellow-400',  icon: 'text-yellow-400',  accent: '#eab308' },
  error_handler: { bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     icon: 'text-red-400',     accent: '#ef4444' },
  default:       { bg: 'bg-zinc-500/10',    border: 'border-zinc-500/30',    text: 'text-zinc-400',    icon: 'text-zinc-400',    accent: '#71717a' },
};

// ============================================================================
// Types (exported)
// ============================================================================

export interface GraphNode {
  id: string;
  name?: string;
  type?: string;
  config?: {
    nodeId?: string;
    [key: string]: unknown;
  };
}

export interface GraphEdge {
  from: string;
  to?: string;
  condition?: string;
  targets?: Record<string, string>;
  fallback?: string;
}

export interface GraphDefinition {
  id?: string;
  graphId?: string;
  name: string;
  description?: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryNodeId?: string;
}

export interface NodeProgress {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
  output?: unknown;
}

export interface GraphRunState {
  graphId?: string;
  runId?: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentNodeId?: string;
  nodeProgress: Record<string, NodeProgress>;
  executionPath: string[];
  startTime?: number;
  endTime?: number;
  error?: string;
}

type Orientation = 'horizontal' | 'vertical';

interface GraphRunViewerProps {
  graph: GraphDefinition;
  runState?: GraphRunState;
  compact?: boolean;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
  /** Force a specific orientation. Default: auto (horizontal on desktop, vertical on mobile) */
  orientation?: Orientation | 'auto';
  /** When true, the canvas fills its parent container instead of using a computed height. Removes border/rounding. */
  fillContainer?: boolean;
}

// ============================================================================
// Layout Constants
// ============================================================================

const LAYOUT = {
  horizontal: {
    nodeW: 152,
    nodeH: 76,
    hGap: 64,
    vGap: 36,
    pad: 40,
  },
  vertical: {
    nodeW: 148,
    nodeH: 80,
    hGap: 36,
    vGap: 56,
    pad: 40,
  },
} as const;

// ============================================================================
// Layout Computation
// ============================================================================

interface LayoutNode {
  id: string;
  node: GraphNode;
  x: number;
  y: number;
  level: number;
  children: string[];
  parents: string[];
}

interface GraphLayout {
  nodes: Record<string, LayoutNode>;
  edges: EdgeInfo[];
  levels: string[][];
  width: number;
  height: number;
  orientation: Orientation;
}

interface EdgeInfo {
  from: string;
  to: string;
  condition?: string;
  isFallback?: boolean;
  isBackEdge?: boolean;
  isBidirectional?: boolean;
}

function computeGraphLayout(graph: GraphDefinition, orientation: Orientation): GraphLayout {
  const cfg = LAYOUT[orientation];
  const nodes: Record<string, LayoutNode> = {};
  const levels: string[][] = [];
  const allEdges: EdgeInfo[] = [];

  // Initialize all nodes
  graph.nodes.forEach(node => {
    nodes[node.id] = {
      id: node.id,
      node,
      x: 0,
      y: 0,
      level: -1,
      children: [],
      parents: [],
    };
  });

  // Build parent/child relationships from edges
  graph.edges.forEach(edge => {
    if (edge.from === '__start__') {
      if (edge.to && nodes[edge.to]) nodes[edge.to].level = 0;
      return;
    }
    if (edge.from === '__end__' || !nodes[edge.from]) return;

    const parent = nodes[edge.from];

    const addEdge = (toId: string, condition?: string, isFallback = false) => {
      if (toId === '__end__' || !nodes[toId]) return;
      if (!parent.children.includes(toId)) parent.children.push(toId);
      if (!nodes[toId].parents.includes(edge.from)) nodes[toId].parents.push(edge.from);

      allEdges.push({
        from: edge.from,
        to: toId,
        condition,
        isFallback,
        isBackEdge: false,
        isBidirectional: false,
      });
    };

    if (edge.to) addEdge(edge.to, edge.condition);
    if (edge.targets) {
      Object.entries(edge.targets).forEach(([key, targetId]) => addEdge(targetId, key));
    }
    if (edge.fallback) addEdge(edge.fallback, 'else', true);
  });

  // Level assignment (topological sort)
  const entryNodeIds = Object.values(nodes).filter(n => n.level === 0).map(n => n.id);
  if (entryNodeIds.length === 0 && graph.nodes.length > 0) {
    nodes[graph.nodes[0].id].level = 0;
    entryNodeIds.push(graph.nodes[0].id);
  }

  const pendingParents = new Map<string, number>();
  Object.values(nodes).forEach(node => pendingParents.set(node.id, node.parents.length));
  entryNodeIds.forEach(id => pendingParents.set(id, 0));

  const ready: string[] = [];
  const processed = new Set<string>();
  Object.keys(nodes).forEach(id => {
    if (pendingParents.get(id) === 0) ready.push(id);
  });

  let iterations = 0;
  const maxIterations = graph.nodes.length * 3;

  while (ready.length > 0 && iterations < maxIterations) {
    iterations++;
    const nodeId = ready.shift()!;
    if (processed.has(nodeId)) continue;
    processed.add(nodeId);

    const node = nodes[nodeId];
    if (!entryNodeIds.includes(nodeId)) {
      const parentLevels = node.parents.filter(pid => processed.has(pid)).map(pid => nodes[pid].level);
      node.level = parentLevels.length > 0 ? Math.max(...parentLevels) + 1 : 0;
    }

    node.children.forEach(childId => {
      const current = pendingParents.get(childId) || 0;
      pendingParents.set(childId, Math.max(0, current - 1));
      if (pendingParents.get(childId) === 0 && !processed.has(childId)) ready.push(childId);
    });
  }

  // Handle nodes stuck in cycles
  Object.values(nodes).forEach(node => {
    if (!processed.has(node.id)) {
      const parentLevels = node.parents.filter(pid => processed.has(pid)).map(pid => nodes[pid].level);
      node.level = parentLevels.length > 0 ? Math.max(...parentLevels) + 1 : 0;
      processed.add(node.id);
    }
  });

  // Group by level
  const maxLevel = Math.max(...Object.values(nodes).map(n => n.level), 0);
  for (let i = 0; i <= maxLevel; i++) {
    levels[i] = Object.values(nodes).filter(n => n.level === i).map(n => n.id);
  }

  // Mark back-edges and bidirectional
  allEdges.forEach(edge => {
    const fromLevel = nodes[edge.from]?.level ?? 0;
    const toLevel = nodes[edge.to]?.level ?? 0;
    edge.isBackEdge = toLevel <= fromLevel;
    edge.isBidirectional = allEdges.some(e => e.from === edge.to && e.to === edge.from);
  });

  // Compute positions based on orientation
  if (orientation === 'horizontal') {
    let maxCrossSize = 0;
    levels.forEach(levelNodes => {
      const crossSize = levelNodes.length * cfg.nodeH + (levelNodes.length - 1) * cfg.vGap;
      maxCrossSize = Math.max(maxCrossSize, crossSize);
    });

    levels.forEach((levelNodes, levelIndex) => {
      const crossSize = levelNodes.length * cfg.nodeH + (levelNodes.length - 1) * cfg.vGap;
      const crossOffset = (maxCrossSize - crossSize) / 2;

      levelNodes.forEach((nodeId, nodeIndex) => {
        nodes[nodeId].x = levelIndex * (cfg.nodeW + cfg.hGap);
        nodes[nodeId].y = crossOffset + nodeIndex * (cfg.nodeH + cfg.vGap);
      });
    });

    const width = levels.length * (cfg.nodeW + cfg.hGap) - cfg.hGap;
    const height = maxCrossSize;
    return { nodes, edges: allEdges, levels, width, height, orientation };
  } else {
    let maxCrossSize = 0;
    levels.forEach(levelNodes => {
      const crossSize = levelNodes.length * cfg.nodeW + (levelNodes.length - 1) * cfg.hGap;
      maxCrossSize = Math.max(maxCrossSize, crossSize);
    });

    levels.forEach((levelNodes, levelIndex) => {
      const crossSize = levelNodes.length * cfg.nodeW + (levelNodes.length - 1) * cfg.hGap;
      const crossOffset = (maxCrossSize - crossSize) / 2;

      levelNodes.forEach((nodeId, nodeIndex) => {
        nodes[nodeId].x = crossOffset + nodeIndex * (cfg.nodeW + cfg.hGap);
        nodes[nodeId].y = levelIndex * (cfg.nodeH + cfg.vGap);
      });
    });

    const width = maxCrossSize;
    const height = levels.length * (cfg.nodeH + cfg.vGap) - cfg.vGap;
    return { nodes, edges: allEdges, levels, width, height, orientation };
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getNodeId(node: GraphNode): string {
  return node.config?.nodeId?.toString() || node.id;
}

function getNodeName(node: GraphNode): string {
  return node.name || getNodeId(node);
}

function getNodeTheme(node: GraphNode) {
  const id = getNodeId(node);
  return nodeThemes[id] || nodeThemes.default;
}

// ============================================================================
// VisualNode Component
// ============================================================================

interface VisualNodeProps {
  layoutNode: LayoutNode;
  progress?: NodeProgress;
  isActive: boolean;
  isInPath: boolean;
  isSelected: boolean;
  isFaded: boolean;
  orientation: Orientation;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

function VisualNode({
  layoutNode,
  progress,
  isActive,
  isInPath,
  isSelected,
  isFaded,
  orientation,
  onClick,
  onDoubleClick,
}: VisualNodeProps) {
  const { node } = layoutNode;
  const status = progress?.status;
  const nodeId = getNodeId(node);
  const nodeName = getNodeName(node);
  const theme = getNodeTheme(node);
  const cfg = LAYOUT[orientation];

  const IconComponent = nodeIcons[nodeId] || nodeIcons.default;

  // Determine step label
  const stepLabel = status === 'running' && progress?.stepName
    ? progress.stepName
    : status === 'completed' && progress?.startTime && progress?.endTime
    ? `${((progress.endTime - progress.startTime) / 1000).toFixed(1)}s`
    : null;

  // Opacity
  const opacity = isFaded ? 0.15 : (isInPath || !status ? 1 : 0.45);

  // Scale
  const scale = isSelected || status === 'running' ? 1.04 : 1;

  return (
    <motion.div
      data-node
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity, scale }}
      whileHover={{ scale: scale * 1.03, zIndex: 20 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
      className="absolute group"
      style={{
        width: cfg.nodeW,
        height: cfg.nodeH,
        left: layoutNode.x + cfg.pad,
        top: layoutNode.y + cfg.pad,
        zIndex: isSelected || status === 'running' ? 10 : 1,
      }}
    >
      {/* Card */}
      <div
        className={`
          relative w-full h-full rounded-xl cursor-pointer
          transition-all duration-200
          bg-bg-secondary border
          ${isSelected
            ? 'border-accent ring-2 ring-accent/30 shadow-lg shadow-accent/10'
            : status === 'running'
            ? 'border-accent/60 ring-1 ring-accent/20 shadow-md shadow-accent/5'
            : status === 'completed'
            ? 'border-emerald-500/40 shadow-sm'
            : status === 'error'
            ? 'border-red-500/50 shadow-sm'
            : 'border-border hover:border-border-hover shadow-sm'
          }
        `}
      >
        {/* Clipped inner layer for accent bar + pulse (won't clip the badge outside) */}
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          {/* Top accent bar */}
          <div
            className={`
              absolute top-0 left-0 right-0 h-[3px]
              ${status === 'running'
                ? 'bg-accent'
                : status === 'completed'
                ? 'bg-emerald-500'
                : status === 'error'
                ? 'bg-red-500'
                : ''
              }
            `}
            style={!status ? { backgroundColor: theme.accent, opacity: 0.5 } : undefined}
          />

          {/* Running pulse overlay */}
          {status === 'running' && (
            <div className="absolute inset-0 bg-accent/5 animate-pulse" />
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center h-full px-3 pt-2 pb-1.5">
          {/* Icon */}
          <div className={`
            w-8 h-8 rounded-lg flex items-center justify-center mb-1.5
            ${theme.bg} ${theme.border} border
          `}>
            <IconComponent className={`w-4 h-4 ${theme.icon}`} />
          </div>

          {/* Name */}
          <span
            className="text-[11px] font-semibold text-text-primary text-center leading-tight w-full"
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
              overflow: 'hidden',
            }}
            title={nodeName}
          >
            {nodeName}
          </span>

          {/* Step / duration label */}
          {stepLabel && (
            <span className="text-[9px] text-text-muted mt-0.5 flex items-center gap-0.5 truncate max-w-full">
              {status === 'running' ? (
                <Loader2 className="w-2.5 h-2.5 animate-spin shrink-0" />
              ) : (
                <Clock className="w-2.5 h-2.5 shrink-0" />
              )}
              <span className="truncate">{stepLabel}</span>
            </span>
          )}
        </div>

        {/* Status badge (top-right) — outside the clipped layer so it overflows */}
        {status && status !== 'pending' && (
          <div className={`
            absolute -top-1 -right-1 w-4 h-4 rounded-full
            border-2 border-bg-secondary flex items-center justify-center
            ${status === 'running' ? 'bg-accent' : ''}
            ${status === 'completed' ? 'bg-emerald-500' : ''}
            ${status === 'error' ? 'bg-red-500' : ''}
          `}>
            {status === 'running' && <Loader2 className="w-2 h-2 text-white animate-spin" />}
            {status === 'completed' && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
            {status === 'error' && <AlertCircle className="w-2.5 h-2.5 text-white" />}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Connection Lines (supports both orientations)
// ============================================================================

interface ConnectionLinesProps {
  layout: GraphLayout;
  nodeProgress: Record<string, NodeProgress>;
  currentNodeId?: string;
  executionPath: string[];
  focusedNodeId?: string;
  graphStatus?: 'idle' | 'running' | 'completed' | 'error';
}

function ConnectionLines({
  layout,
  nodeProgress,
  currentNodeId,
  executionPath,
  focusedNodeId,
  graphStatus,
}: ConnectionLinesProps) {
  const cfg = LAYOUT[layout.orientation];
  const svgW = layout.width + cfg.pad * 2;
  const svgH = layout.height + cfg.pad * 2;

  // Deduplicate bidirectional edges
  const seenBiPairs = new Set<string>();
  const filteredEdges = layout.edges.filter(edge => {
    if (edge.isBidirectional) {
      const key = [edge.from, edge.to].sort().join('|');
      if (seenBiPairs.has(key)) return false;
      seenBiPairs.add(key);
    }
    return true;
  });

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={svgW}
      height={svgH}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker id="arrow-default" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="var(--color-border, #3f3f46)" opacity="0.6" />
        </marker>
        <marker id="arrow-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#ef4444" opacity="0.9" />
        </marker>
        <marker id="arrow-completed" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <path d="M0,0 L8,3 L0,6 Z" fill="#10b981" opacity="0.9" />
        </marker>
      </defs>

      <g>
        {filteredEdges.map((edge, index) => {
          const fromNode = layout.nodes[edge.from];
          const toNode = layout.nodes[edge.to];
          if (!fromNode || !toNode) return null;

          // Source and target ports
          let x1: number, y1: number, x2: number, y2: number;

          if (layout.orientation === 'horizontal') {
            x1 = fromNode.x + cfg.pad + cfg.nodeW;
            y1 = fromNode.y + cfg.pad + cfg.nodeH / 2;
            x2 = toNode.x + cfg.pad;
            y2 = toNode.y + cfg.pad + cfg.nodeH / 2;
          } else {
            x1 = fromNode.x + cfg.pad + cfg.nodeW / 2;
            y1 = fromNode.y + cfg.pad + cfg.nodeH;
            x2 = toNode.x + cfg.pad + cfg.nodeW / 2;
            y2 = toNode.y + cfg.pad;
          }

          // Execution state
          const fromIdx = executionPath.indexOf(edge.from);
          const toIdx = executionPath.indexOf(edge.to);
          const isTraversed = fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx;
          const isActive = currentNodeId === edge.from || currentNodeId === edge.to;
          const connectsToFocused = focusedNodeId && (edge.from === focusedNodeId || edge.to === focusedNodeId);
          const shouldFade = focusedNodeId && !connectsToFocused &&
            !(isTraversed && executionPath.includes(focusedNodeId));
          const completedNotUsed = graphStatus === 'completed' && !isTraversed;

          // Build path
          let pathD: string;

          if (edge.isBackEdge || edge.isBidirectional) {
            if (layout.orientation === 'horizontal') {
              const dir = y2 >= y1 ? 1 : -1;
              const curveOff = 50 * dir;
              const midY = (y1 + y2) / 2 + curveOff;
              pathD = `M${x1},${y1} C${x1 + 40},${y1 + curveOff * 0.3}, ${x2 - 40},${midY}, ${x2},${y2}`;
            } else {
              const dir = x2 >= x1 ? 1 : -1;
              const curveOff = 60 * dir;
              const midX = (x1 + x2) / 2 + curveOff;
              pathD = `M${x1},${y1} C${x1 + curveOff * 0.3},${y1 + 30}, ${midX},${(y1 + y2) / 2}, ${x2},${y2}`;
            }
          } else {
            if (layout.orientation === 'horizontal') {
              const dx = Math.abs(x2 - x1);
              const ctrl = Math.min(dx * 0.45, 80);
              pathD = `M${x1},${y1} C${x1 + ctrl},${y1}, ${x2 - ctrl},${y2}, ${x2},${y2}`;
            } else {
              const dy = Math.abs(y2 - y1);
              const ctrl = Math.min(dy * 0.45, 60);
              pathD = `M${x1},${y1} C${x1},${y1 + ctrl}, ${x2},${y2 - ctrl}, ${x2},${y2}`;
            }
          }

          // Style
          let strokeColor: string;
          let strokeW: number;
          let strokeOp: number;
          let dashArray: string | undefined;
          let animClass = '';
          let markerEnd = 'url(#arrow-default)';

          if (shouldFade || completedNotUsed) {
            strokeColor = 'var(--color-border, #3f3f46)';
            strokeOp = completedNotUsed ? 0.2 : 0.12;
            strokeW = 1;
            dashArray = edge.isBackEdge || edge.isBidirectional ? '5,4' : undefined;
            markerEnd = '';
          } else if (isActive && !isTraversed) {
            strokeColor = '#ef4444';
            strokeOp = 0.9;
            strokeW = 2;
            dashArray = '6,4';
            animClass = 'graph-edge-active';
            markerEnd = 'url(#arrow-active)';
          } else if (connectsToFocused && isTraversed) {
            strokeColor = '#10b981';
            strokeOp = 1;
            strokeW = 2.5;
            dashArray = '6,4';
            animClass = 'graph-edge-completed';
            markerEnd = 'url(#arrow-completed)';
          } else if (isTraversed) {
            strokeColor = '#10b981';
            strokeOp = 0.85;
            strokeW = 2;
            dashArray = '6,4';
            animClass = 'graph-edge-completed';
            markerEnd = 'url(#arrow-completed)';
          } else if (edge.isBidirectional) {
            strokeColor = '#a855f7';
            strokeOp = 0.5;
            strokeW = 1.5;
            dashArray = '5,4';
            animClass = 'graph-edge-oscillate';
          } else if (edge.isBackEdge) {
            strokeColor = '#f59e0b';
            strokeOp = 0.5;
            strokeW = 1.5;
            dashArray = '5,4';
            animClass = 'graph-back-edge';
          } else {
            strokeColor = 'var(--color-border, #3f3f46)';
            strokeOp = 0.55;
            strokeW = 1.5;
            dashArray = '6,4';
            animClass = 'graph-edge';
            markerEnd = 'url(#arrow-default)';
          }

          // Label position
          const labelT = 0.5;
          const labelX = x1 + (x2 - x1) * labelT;
          const labelY = y1 + (y2 - y1) * labelT;
          const showLabel = edge.condition && edge.condition !== 'else' && !shouldFade && !completedNotUsed;
          const labelOffset = layout.orientation === 'horizontal'
            ? { dx: 0, dy: y2 > y1 ? 16 : -12 }
            : { dx: x2 > x1 ? 30 : x2 < x1 ? -30 : 0, dy: 0 };

          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeW}
                strokeOpacity={strokeOp}
                strokeDasharray={dashArray}
                strokeLinecap="round"
                className={animClass}
                markerEnd={markerEnd}
              />

              {showLabel && (
                <g>
                  <rect
                    x={labelX + labelOffset.dx - 20}
                    y={labelY + labelOffset.dy - 9}
                    width={40}
                    height={18}
                    rx={6}
                    fill="var(--color-bg-tertiary, #27272a)"
                    stroke="var(--color-border, #3f3f46)"
                    strokeWidth={0.5}
                    opacity={0.95}
                  />
                  <text
                    x={labelX + labelOffset.dx}
                    y={labelY + labelOffset.dy + 4}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={500}
                    fontFamily="system-ui, sans-serif"
                    fill="var(--color-text-secondary, #a1a1aa)"
                    className="select-none"
                  >
                    {edge.condition!.length > 7 ? edge.condition!.slice(0, 5) + '\u2026' : edge.condition}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ============================================================================
// Node Logs Popup
// ============================================================================

interface NodeLog {
  timestamp: number;
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  data?: unknown;
}

interface NodeLogsPopupProps {
  nodeId: string;
  nodeName: string;
  runId?: string;
  isRunning?: boolean;
  onClose: () => void;
}

function NodeLogsPopup({ nodeId, nodeName, runId, isRunning, onClose }: NodeLogsPopupProps) {
  const [logs, setLogs] = useState<NodeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Stop wheel events from reaching the canvas zoom handler
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const stop = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', stop, { passive: true });
    return () => el.removeEventListener('wheel', stop);
  }, []);

  const processNewLog = useCallback((newLog: any, currentLogs: NodeLog[]) => {
    const isForNode = newLog.metadata?.nodeId === nodeId ||
      newLog.context?.nodeId === nodeId ||
      newLog.nodeId === nodeId;
    if (!isForNode) return null;

    const processed: NodeLog = {
      timestamp: newLog.timestamp || Date.now(),
      level: newLog.level || 'info',
      message: newLog.message || '',
      data: newLog.metadata || newLog.data,
    };

    const isDuplicate = currentLogs.slice(-50).some(l =>
      l.timestamp === processed.timestamp && l.message === processed.message
    );
    return isDuplicate ? null : processed;
  }, [nodeId]);

  useEffect(() => {
    if (!runId) {
      setError('No run ID available');
      setLoading(false);
      return;
    }

    let isMounted = true;
    let eventSource: EventSource | null = null;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/v1/generations/${runId}/logs`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch logs');
        if (!isMounted) return;

        const data = await response.json();
        const rawLogs = data.logs || [];
        const initialLogs = rawLogs
          .filter((log: any) =>
            log.metadata?.nodeId === nodeId ||
            log.context?.nodeId === nodeId ||
            log.nodeId === nodeId
          )
          .map((log: any) => ({
            timestamp: log.timestamp || Date.now(),
            level: log.level || 'info',
            message: log.message || '',
            data: log.metadata || log.data,
          }));

        setLogs(initialLogs);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();

    if (isRunning) {
      eventSource = new EventSource(`/api/v1/generations/${runId}/stream`);
      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const newLog = JSON.parse(event.data);
          setLogs(prev => {
            const processed = processNewLog(newLog, prev);
            return processed ? [...prev, processed] : prev;
          });
        } catch {}
      };
    }

    return () => {
      isMounted = false;
      eventSource?.close();
    };
  }, [nodeId, runId, isRunning, processNewLog]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-400 bg-red-500/10';
      case 'warn': return 'text-yellow-400 bg-yellow-500/10';
      case 'debug': return 'text-purple-400 bg-purple-500/10';
      default: return 'text-blue-400 bg-blue-500/10';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-default"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[80vh] bg-bg-secondary border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden cursor-default"
      >
        {/* Header */}
        <div className="border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Terminal className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-text-primary text-base">Node Logs</h3>
                <p className="text-sm text-text-muted">{nodeName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isRunning && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-lg">
                  <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
                  <span className="text-xs font-medium text-accent">Running</span>
                </div>
              )}
              <button onClick={onClose} className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors">
                <X className="w-5 h-5 text-text-muted" />
              </button>
            </div>
          </div>
          {isRunning && (
            <div className="h-0.5 w-full bg-bg-tertiary overflow-hidden">
              <motion.div
                className="h-full w-1/3 bg-accent/60 rounded-full"
                animate={{ x: ['-100%', '400%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent animate-spin" />
              <span className="ml-3 text-text-muted">Loading logs...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mb-3" />
              <p className="text-text-muted">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="w-8 h-8 text-text-muted mb-3" />
              <p className="text-text-muted">No logs available for this node</p>
            </div>
          ) : (
            logs.map((log, index) => (
              <motion.div
                key={`${log.timestamp}-${index}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                className="p-3 rounded-lg bg-bg-primary border border-border hover:border-border-hover transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${getLevelColor(log.level)}`}>
                    {log.level}
                  </span>
                  <span className="text-xs text-text-muted font-mono">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-text-secondary break-words font-mono">
                  {log.message}
                </p>
                {log.data !== undefined && (
                  <details className="mt-2">
                    <summary className="text-xs text-text-muted cursor-pointer hover:text-text-secondary">
                      View data
                    </summary>
                    <pre className="mt-2 p-2 bg-bg-tertiary rounded text-xs text-text-muted overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-bg-tertiary/30 flex items-center justify-between">
          <span className="text-xs text-text-muted">
            {logs.length} log {logs.length === 1 ? 'entry' : 'entries'}
          </span>
          <div className="flex items-center gap-2">
            {runId && (
              <Link
                href={`/logs?runId=${runId}`}
                target="_blank"
                className="px-3 py-2 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <ScrollText className="w-3.5 h-3.5" />
                Open in Logs
                <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function GraphRunViewer({
  graph,
  runState,
  compact = false,
  onNodeClick,
  className = '',
  orientation: orientationProp = 'auto',
  fillContainer = false,
}: GraphRunViewerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showLogsForNode, setShowLogsForNode] = useState<string | null>(null);

  // Pan and zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const MIN_ZOOM = 0.4;
  const MAX_ZOOM = 2.5;

  // Auto-detect orientation
  const [detectedOrientation, setDetectedOrientation] = useState<Orientation>('vertical');
  useEffect(() => {
    if (orientationProp !== 'auto') return;
    const check = () => setDetectedOrientation(window.innerWidth >= 900 ? 'horizontal' : 'vertical');
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [orientationProp]);

  const orientation: Orientation = orientationProp === 'auto' ? detectedOrientation : orientationProp;

  // Compute layout
  const layout = useMemo(() => computeGraphLayout(graph, orientation), [graph, orientation]);

  const cfg = LAYOUT[orientation];
  const executionPath = runState?.executionPath || [];

  // Dynamic canvas height
  const canvasH = compact
    ? 200
    : Math.max(360, layout.height + cfg.pad * 2 + 20);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId);
    onNodeClick?.(nodeId);
  }, [selectedNodeId, onNodeClick]);

  // --- Pan handlers ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.preventDefault();
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  // --- Touch handlers ---
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    if (e.touches.length === 1) {
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, [pan]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      setPan({
        x: e.touches[0].clientX - panStart.current.x,
        y: e.touches[0].clientY - panStart.current.y,
      });
      e.preventDefault();
    } else if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * (distance / lastPinchDistance.current!))));
      lastPinchDistance.current = distance;
      e.preventDefault();
    }
  }, [isPanning]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      lastPinchDistance.current = null;
    } else if (e.touches.length === 1) {
      lastPinchDistance.current = null;
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    }
  }, [pan]);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta)));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  // Focused node for highlight effects
  const focusedNodeId = selectedNodeId || runState?.currentNodeId;

  return (
    <>
      {/* Canvas */}
      <div
        ref={canvasRef}
        className={`
          relative w-full overflow-hidden
          ${fillContainer ? '' : 'rounded-xl border border-border'}
          ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}
          touch-none select-none
          ${className}
        `}
        style={{
          height: fillContainer ? '100%' : canvasH,
          backgroundColor: 'var(--color-bg-primary, #09090b)',
          backgroundImage: 'radial-gradient(circle, var(--color-border, #27272a) 0.75px, transparent 0.75px)',
          backgroundSize: '20px 20px',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Reset view button */}
        {(pan.x !== 0 || pan.y !== 0 || zoom !== 1) && (
          <button
            onClick={resetView}
            className="absolute top-2.5 right-2.5 z-20 px-2.5 py-1.5 rounded-lg
              bg-bg-secondary/90 backdrop-blur border border-border
              hover:bg-bg-tertiary text-text-muted text-xs
              flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Move className="w-3 h-3" />
            Reset
            {zoom !== 1 && <span className="text-text-muted/70">({Math.round(zoom * 100)}%)</span>}
          </button>
        )}

        {/* Pannable / zoomable graph container */}
        <div className="absolute inset-0">
          <div
            className="relative"
            style={{
              transform: `translate(-50%, 0) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
              left: '50%',
              top: 10,
              width: layout.width + cfg.pad * 2,
              height: layout.height + cfg.pad * 2,
            }}
          >
            <ConnectionLines
              layout={layout}
              nodeProgress={runState?.nodeProgress || {}}
              currentNodeId={runState?.currentNodeId}
              executionPath={executionPath}
              focusedNodeId={focusedNodeId || undefined}
              graphStatus={runState?.status}
            />

            {Object.values(layout.nodes).map(layoutNode => {
              const progress = runState?.nodeProgress[layoutNode.id];
              const isActive = runState?.currentNodeId === layoutNode.id;
              const isInPath = executionPath.includes(layoutNode.id);
              const isConnectedToFocused = focusedNodeId ? (
                layoutNode.id === focusedNodeId ||
                layoutNode.children.includes(focusedNodeId) ||
                layoutNode.parents.includes(focusedNodeId)
              ) : false;
              const isFaded = !!(focusedNodeId &&
                layoutNode.id !== focusedNodeId &&
                !isConnectedToFocused &&
                runState?.status !== 'idle');

              return (
                <VisualNode
                  key={layoutNode.id}
                  layoutNode={layoutNode}
                  progress={progress}
                  isActive={isActive}
                  isInPath={isInPath || !runState || runState.status === 'idle'}
                  isSelected={selectedNodeId === layoutNode.id}
                  isFaded={isFaded}
                  orientation={orientation}
                  onClick={() => handleNodeClick(layoutNode.id)}
                  onDoubleClick={() => {
                    if (runState?.runId) setShowLogsForNode(layoutNode.id);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Selected node details panel — overlaid at the bottom of the canvas */}
        <AnimatePresence>
          {selectedNodeId && (
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              className="absolute bottom-3 left-3 right-3 z-30 mx-auto max-w-2xl bg-bg-secondary/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden"
          >
            <div className="p-3.5">
              {/* Header */}
              <div className="flex items-center justify-between mb-2.5">
                <h4 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    runState?.nodeProgress[selectedNodeId]?.status === 'completed' ? 'bg-emerald-500' :
                    runState?.nodeProgress[selectedNodeId]?.status === 'running' ? 'bg-accent animate-pulse' :
                    runState?.nodeProgress[selectedNodeId]?.status === 'error' ? 'bg-red-500' : 'bg-text-muted'
                  }`} />
                  {getNodeName(layout.nodes[selectedNodeId]?.node)}
                </h4>
                <div className="flex items-center gap-1.5">
                  {runState?.runId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLogsForNode(selectedNodeId);
                      }}
                      className="px-2.5 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                      title="View logs"
                    >
                      <FileCode className="w-3 h-3" />
                      Logs
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }}
                    className="p-1 hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              {runState?.nodeProgress[selectedNodeId] ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-bg-primary/60 rounded-lg p-2 border border-border">
                    <span className="text-text-muted block mb-0.5 text-[10px]">Status</span>
                    <span className="text-text-primary font-medium capitalize">
                      {runState.nodeProgress[selectedNodeId]?.status}
                    </span>
                  </div>
                  {runState.nodeProgress[selectedNodeId]?.stepName && (
                    <div className="bg-bg-primary/60 rounded-lg p-2 border border-border">
                      <span className="text-text-muted block mb-0.5 text-[10px]">Step</span>
                      <span className="text-text-primary font-medium truncate block">
                        {runState.nodeProgress[selectedNodeId]?.stepName}
                      </span>
                    </div>
                  )}
                  {runState.nodeProgress[selectedNodeId]?.startTime && (
                    <div className="bg-bg-primary/60 rounded-lg p-2 border border-border">
                      <span className="text-text-muted block mb-0.5 text-[10px]">Duration</span>
                      <span className="text-text-primary font-medium">
                        {(((runState.nodeProgress[selectedNodeId]?.endTime || Date.now()) -
                          runState.nodeProgress[selectedNodeId]!.startTime!) / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  <div className="bg-bg-primary/60 rounded-lg p-2 border border-border">
                    <span className="text-text-muted block mb-0.5 text-[10px]">Type</span>
                    <span className="text-text-primary font-medium">
                      {layout.nodes[selectedNodeId]?.node.type || 'universal'}
                    </span>
                  </div>
                  {runState.nodeProgress[selectedNodeId]?.error && (
                    <div className="col-span-full p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                      <span className="font-medium">Error: </span>
                      {runState.nodeProgress[selectedNodeId]?.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-bg-primary/60 rounded-lg p-2 border border-border">
                    <span className="text-text-muted block mb-0.5 text-[10px]">Type</span>
                    <span className="text-text-primary font-medium">
                      {layout.nodes[selectedNodeId]?.node.type || 'universal'}
                    </span>
                  </div>
                  <div className="bg-bg-primary/60 rounded-lg p-2 border border-border">
                    <span className="text-text-muted block mb-0.5 text-[10px]">Status</span>
                    <span className="text-text-primary font-medium">Not executed</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node Logs Popup */}
      <AnimatePresence>
        {showLogsForNode && (
          <NodeLogsPopup
            nodeId={showLogsForNode}
            nodeName={getNodeName(layout.nodes[showLogsForNode]?.node)}
            runId={runState?.runId}
            isRunning={runState?.status === 'running'}
            onClose={() => setShowLogsForNode(null)}
          />
        )}
      </AnimatePresence>
      </div>
    </>
  );
}

export default GraphRunViewer;
