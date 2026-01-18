'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, 
  Loader2, 
  ChevronDown,
  ChevronUp,
  AlertCircle,
  GitBranch,
  Clock,
  Activity,
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
} from 'lucide-react';

// ============================================================================
// Node Icon & Color Mapping (matches Studio canvas styling)
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

const nodeColors: Record<string, string> = {
  router: '#f59e0b',
  planner: '#8b5cf6',
  executor: '#3b82f6',
  respond: '#22c55e',
  search: '#06b6d4',
  command: '#ec4899',
  context: '#6366f1',
  browse: '#14b8a6',
  summarizer: '#a855f7',
  optimizer: '#eab308',
  error_handler: '#ef4444',
  default: '#6b7280',
};

// ============================================================================
// Types
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

interface GraphRunViewerProps {
  graph: GraphDefinition;
  runState?: GraphRunState;
  compact?: boolean;
  onNodeClick?: (nodeId: string) => void;
  className?: string;
}

// ============================================================================
// Layout Computation - Build visual tree structure
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
}

interface EdgeInfo {
  from: string;
  to: string;
  condition?: string;
  isFallback?: boolean;
  isBackEdge?: boolean;
  isBidirectional?: boolean;
}

const NODE_WIDTH = 120;
const NODE_HEIGHT = 80;
const H_GAP = 40;
const V_GAP = 60;

function computeGraphLayout(graph: GraphDefinition): GraphLayout {
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
  
  // Build parent/child relationships from edges and collect edge info
  const edgePairs = new Set<string>();
  
  graph.edges.forEach(edge => {
    if (edge.from === '__start__') {
      // Start node(s)
      if (edge.to && nodes[edge.to]) {
        nodes[edge.to].level = 0;
      }
      return;
    }
    if (edge.from === '__end__' || !nodes[edge.from]) return;
    
    const parent = nodes[edge.from];
    
    const addEdge = (toId: string, condition?: string, isFallback = false) => {
      if (toId === '__end__' || !nodes[toId]) return;
      
      if (!parent.children.includes(toId)) {
        parent.children.push(toId);
      }
      if (!nodes[toId].parents.includes(edge.from)) {
        nodes[toId].parents.push(edge.from);
      }
      
      // Track for bidirectional detection
      const pairKey = [edge.from, toId].sort().join('|');
      edgePairs.add(pairKey);
      
      allEdges.push({
        from: edge.from,
        to: toId,
        condition,
        isFallback,
        isBackEdge: false,
        isBidirectional: false,
      });
    };
    
    if (edge.to) {
      addEdge(edge.to, edge.condition);
    }
    if (edge.targets) {
      Object.entries(edge.targets).forEach(([key, targetId]) => {
        addEdge(targetId, key);
      });
    }
    if (edge.fallback) {
      addEdge(edge.fallback, 'else', true);
    }
  });
  
  // Level assignment using modified Kahn's algorithm (topological sort)
  // Nodes are assigned level = max(parent levels) + 1
  // Handles cycles by tracking pending parent count
  
  // Find entry nodes (level 0)
  const entryNodeIds = Object.values(nodes).filter(n => n.level === 0).map(n => n.id);
  
  if (entryNodeIds.length === 0 && graph.nodes.length > 0) {
    nodes[graph.nodes[0].id].level = 0;
    entryNodeIds.push(graph.nodes[0].id);
  }
  
  // Count how many parents each node has (in-degree)
  const pendingParents = new Map<string, number>();
  Object.values(nodes).forEach(node => {
    pendingParents.set(node.id, node.parents.length);
  });
  
  // Entry nodes have 0 pending (or we override them)
  entryNodeIds.forEach(id => pendingParents.set(id, 0));
  
  // Queue starts with nodes that have 0 pending parents
  const ready: string[] = [];
  const processed = new Set<string>();
  
  Object.keys(nodes).forEach(id => {
    if (pendingParents.get(id) === 0) {
      ready.push(id);
    }
  });
  
  // Process nodes in topological order
  let iterations = 0;
  const maxIterations = graph.nodes.length * 3;
  
  while (ready.length > 0 && iterations < maxIterations) {
    iterations++;
    const nodeId = ready.shift()!;
    
    if (processed.has(nodeId)) continue;
    processed.add(nodeId);
    
    const node = nodes[nodeId];
    
    // Assign level based on max of processed parent levels
    if (!entryNodeIds.includes(nodeId)) {
      const parentLevels = node.parents
        .filter(pid => processed.has(pid))
        .map(pid => nodes[pid].level);
      
      node.level = parentLevels.length > 0 ? Math.max(...parentLevels) + 1 : 0;
    }
    
    // Decrement pending count for children
    node.children.forEach(childId => {
      const current = pendingParents.get(childId) || 0;
      pendingParents.set(childId, Math.max(0, current - 1));
      
      if (pendingParents.get(childId) === 0 && !processed.has(childId)) {
        ready.push(childId);
      }
    });
  }
  
  // Handle nodes stuck in cycles - force process them
  Object.values(nodes).forEach(node => {
    if (!processed.has(node.id)) {
      const parentLevels = node.parents
        .filter(pid => processed.has(pid))
        .map(pid => nodes[pid].level);
      
      node.level = parentLevels.length > 0 ? Math.max(...parentLevels) + 1 : 0;
      processed.add(node.id);
    }
  });
  
  // Group nodes by level
  const maxLevel = Math.max(...Object.values(nodes).map(n => n.level), 0);
  for (let i = 0; i <= maxLevel; i++) {
    levels[i] = Object.values(nodes)
      .filter(n => n.level === i)
      .map(n => n.id);
  }
  
  // Mark back-edges (edges where target level <= source level) and bidirectional edges
  allEdges.forEach(edge => {
    const fromLevel = nodes[edge.from]?.level ?? 0;
    const toLevel = nodes[edge.to]?.level ?? 0;
    edge.isBackEdge = toLevel <= fromLevel;
    
    // Check for reverse edge (bidirectional)
    const hasReverse = allEdges.some(e => e.from === edge.to && e.to === edge.from);
    edge.isBidirectional = hasReverse;
  });
  
  // Compute x positions within each level
  // All coordinates are absolute from (0,0) in the top-left
  let maxWidth = 0;
  levels.forEach((levelNodes, levelIndex) => {
    const totalWidth = levelNodes.length * NODE_WIDTH + (levelNodes.length - 1) * H_GAP;
    maxWidth = Math.max(maxWidth, totalWidth);
    
    levelNodes.forEach((nodeId, nodeIndex) => {
      // x is the LEFT edge of the node (we'll center the whole container later)
      nodes[nodeId].x = nodeIndex * (NODE_WIDTH + H_GAP);
      nodes[nodeId].y = levelIndex * (NODE_HEIGHT + V_GAP);
    });
  });
  
  // Center each level horizontally within the max width
  levels.forEach((levelNodes) => {
    const levelWidth = levelNodes.length * NODE_WIDTH + (levelNodes.length - 1) * H_GAP;
    const offset = (maxWidth - levelWidth) / 2;
    levelNodes.forEach((nodeId) => {
      nodes[nodeId].x += offset;
    });
  });
  
  const height = levels.length * (NODE_HEIGHT + V_GAP);
  
  return { nodes, edges: allEdges, levels, width: maxWidth, height };
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNodeId(node: GraphNode): string {
  return node.config?.nodeId?.toString() || node.id;
}

function getNodeName(node: GraphNode): string {
  return node.name || getNodeId(node);
}

// ============================================================================
// Visual Node Component (Studio-style with icon in colored background)
// ============================================================================

interface VisualNodeProps {
  layoutNode: LayoutNode;
  progress?: NodeProgress;
  isActive: boolean;
  isInPath: boolean;
  isSelected: boolean;
  isFaded: boolean; // Should this node be faded (not focused/connected)
  onClick?: () => void;
  onDoubleClick?: () => void;
}

function VisualNode({ layoutNode, progress, isActive, isInPath, isSelected, isFaded, onClick, onDoubleClick }: VisualNodeProps) {
  const { node } = layoutNode;
  const status = progress?.status;
  const nodeId = getNodeId(node);
  const nodeName = getNodeName(node);
  
  // Get icon and color based on nodeId
  const IconComponent = nodeIcons[nodeId] || nodeIcons.default;
  const bgColor = nodeColors[nodeId] || nodeColors.default;
  
  // Status-based border styling - more pronounced for selected/active
  const borderClass = isSelected 
    ? 'border-[3px] border-accent ring-4 ring-accent/50 shadow-xl shadow-accent/20'
    : status === 'running' 
    ? 'border-[3px] border-accent ring-2 ring-accent/40 shadow-lg shadow-accent/15' 
    : status === 'completed'
    ? 'border-2 border-green-500/80 shadow-md'
    : status === 'error'
    ? 'border-2 border-red-500/80 shadow-md'
    : 'border-2 border-border hover:border-border-hover';
  
  // Fade logic: if node is faded (not connected to focus), use very low opacity
  // Otherwise use path-based opacity
  const opacityClass = isFaded ? 'opacity-15' : (isInPath || !status ? 'opacity-100' : 'opacity-40');
  
  // Scale up selected/active nodes slightly
  const scaleStyle = isSelected || status === 'running' ? 1.05 : 1;
  
  return (
    <motion.div
      data-node
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: scaleStyle }}
      whileHover={{ scale: scaleStyle * 1.02, zIndex: 10 }}
      transition={{ duration: 0.2 }}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick?.(); }}
      className={`
        absolute rounded-xl bg-bg-secondary shadow-lg cursor-pointer transition-all
        ${borderClass} ${opacityClass}
      `}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        left: layoutNode.x + 30, // Add 30px offset to match SVG
        top: layoutNode.y + 30,  // Add 30px offset to match SVG
        zIndex: isSelected || status === 'running' ? 5 : 1,
      }}
    >
      {/* Node content - Studio style */}
      <div className="flex flex-col items-center justify-center h-full p-2">
        {/* Icon container with colored background */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center mb-1.5 relative shadow-sm"
          style={{ backgroundColor: bgColor }}
        >
          <IconComponent className="w-5 h-5 text-white" />
          
          {/* Pulse overlay for running */}
          {status === 'running' && (
            <div className="absolute inset-0 rounded-lg bg-white/30 animate-pulse" />
          )}
        </div>
        
        {/* Name */}
        <span className="text-xs font-medium text-text-primary text-center leading-tight truncate max-w-[100px]">
          {nodeName}
        </span>
        
        {/* Status/type label */}
        <span className="text-[10px] text-text-muted mt-0.5">
          {status === 'running' && progress?.stepName 
            ? progress.stepName.slice(0, 14) + (progress.stepName.length > 14 ? '…' : '')
            : status === 'completed' && progress?.startTime && progress?.endTime
            ? `${((progress.endTime - progress.startTime) / 1000).toFixed(1)}s`
            : 'universal'}
        </span>
      </div>
      
      {/* Status indicator dot (top-right corner) */}
      {status && (
        <div className={`
          absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-bg-secondary flex items-center justify-center
          ${status === 'running' ? 'bg-accent' : ''}
          ${status === 'completed' ? 'bg-green-500' : ''}
          ${status === 'error' ? 'bg-red-500' : ''}
          ${status === 'pending' ? 'bg-gray-400' : ''}
        `}>
          {status === 'running' && (
            <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
          )}
          {status === 'completed' && (
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-2.5 h-2.5 text-white" />
          )}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Connection Lines Component (Studio-style with back-edge animations)
// ============================================================================

interface ConnectionLinesProps {
  layout: GraphLayout;
  nodeProgress: Record<string, NodeProgress>;
  currentNodeId?: string;
  executionPath: string[];
  focusedNodeId?: string; // Selected or active node
  graphStatus?: 'idle' | 'running' | 'completed' | 'error'; // Graph run status
}

function ConnectionLines({ layout, nodeProgress, currentNodeId, executionPath, focusedNodeId, graphStatus }: ConnectionLinesProps) {
  const svgHeight = layout.height + 60;
  const svgWidth = layout.width + 60;
  
  // Filter edges: for bidirectional pairs, only keep one (the forward one)
  const seenBidirectionalPairs = new Set<string>();
  const filteredEdges = layout.edges.filter(edge => {
    if (edge.isBidirectional) {
      // Create a canonical key for the pair (sorted)
      const pairKey = [edge.from, edge.to].sort().join('|');
      if (seenBidirectionalPairs.has(pairKey)) {
        return false; // Skip this duplicate
      }
      seenBidirectionalPairs.add(pairKey);
    }
    return true;
  });
  
  return (
    <svg 
      className="absolute pointer-events-none"
      style={{ 
        width: svgWidth, 
        height: svgHeight, 
        left: 0,
        top: 0,
        overflow: 'visible' 
      }}
    >
      <g>
        {filteredEdges.map((edge, index) => {
          const fromNode = layout.nodes[edge.from];
          const toNode = layout.nodes[edge.to];
          if (!fromNode || !toNode) return null;
          
          // Calculate positions - add 30 offset to match node CSS positions
          const x1 = fromNode.x + 30 + NODE_WIDTH / 2;
          const y1 = fromNode.y + 30 + NODE_HEIGHT;
          const x2 = toNode.x + 30 + NODE_WIDTH / 2;
          const y2 = toNode.y + 30;
          
          // Check execution state
          const fromIdx = executionPath.indexOf(edge.from);
          const toIdx = executionPath.indexOf(edge.to);
          const isTraversed = fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx;
          const isActive = currentNodeId === edge.from || currentNodeId === edge.to;
          
          // Check if this edge connects to the focused node
          const connectsToFocused = focusedNodeId && (edge.from === focusedNodeId || edge.to === focusedNodeId);
          // Edge should be faded if: there's a focused node AND this edge doesn't connect to it
          // BUT also only fade if the edge isn't part of the executed path to the focused node
          const shouldFade = focusedNodeId && !connectsToFocused && !(isTraversed && executionPath.includes(focusedNodeId));
          
          // Generate path and styling based on edge type
          let pathD: string;
          let strokeColor: string;
          let strokeDash: string | undefined;
          let strokeOpacity: number;
          let strokeWidth: number;
          let animationClass = '';
          
          if (edge.isBidirectional) {
            // Bidirectional: single line with oscillating animation
            const deltaY = y2 - y1;
            const controlY = Math.min(Math.abs(deltaY) * 0.4, 40);
            pathD = `M ${x1} ${y1} 
                     C ${x1} ${y1 + controlY}, 
                       ${x2} ${y2 - controlY}, 
                       ${x2} ${y2 - 6}`;
            strokeDash = '6,4';
            
            // When completed and not traversed, fade the colored line significantly
            const completedAndNotUsed = graphStatus === 'completed' && !isTraversed;
            
            if (shouldFade || completedAndNotUsed) {
              strokeColor = '#6b7280';
              strokeOpacity = completedAndNotUsed ? 0.2 : 0.15;
              strokeWidth = 1;
              animationClass = '';
            } else {
              strokeColor = '#a855f7'; // Purple for bidirectional
              strokeOpacity = 0.8;
              strokeWidth = 1.5;
              animationClass = 'graph-edge-oscillate';
            }
          } else if (edge.isBackEdge) {
            // Back-edge (non-bidirectional): curve around to the side
            const direction = x2 >= x1 ? 1 : -1;
            const curveOffset = 70 * direction;
            const midX = (x1 + x2) / 2 + curveOffset;
            pathD = `M ${x1} ${y1} 
                     C ${x1 + curveOffset * 0.5} ${y1 + 30}, 
                       ${midX} ${(y1 + y2) / 2},
                       ${x2 + curveOffset * 0.3} ${y2 - 20}
                     Q ${x2} ${y2 - 5}, ${x2} ${y2 - 6}`;
            strokeDash = '6,4';
            
            // When completed and not traversed, fade the colored line significantly
            const completedAndNotUsed = graphStatus === 'completed' && !isTraversed;
            
            if (shouldFade || completedAndNotUsed) {
              strokeColor = '#6b7280';
              strokeOpacity = completedAndNotUsed ? 0.2 : 0.15;
              strokeWidth = 1;
              animationClass = '';
            } else {
              strokeColor = '#f59e0b';
              strokeOpacity = 0.8;
              strokeWidth = 1.5;
              animationClass = 'graph-back-edge';
            }
          } else {
            // Normal forward edge: smooth bezier curve
            const deltaY = y2 - y1;
            const controlY = Math.min(Math.abs(deltaY) * 0.4, 40);
            
            pathD = `M ${x1} ${y1} 
                     C ${x1} ${y1 + controlY}, 
                       ${x2} ${y2 - controlY}, 
                       ${x2} ${y2 - 6}`;
            
            // All edges get dotted lines with flow animation
            strokeDash = '6,4';
            
            // When completed and not traversed, fade more aggressively
            const completedAndNotUsed = graphStatus === 'completed' && !isTraversed;
            
            if (shouldFade) {
              // Faded edge - not connected to focused node
              strokeColor = '#6b7280';
              strokeOpacity = 0.15;
              strokeWidth = 1;
              animationClass = 'graph-edge';
            } else if (connectsToFocused && isTraversed) {
              // Highlighted: connects to focused node AND was traversed
              strokeColor = '#22c55e';
              strokeOpacity = 1;
              strokeWidth = 2.5;
              animationClass = 'graph-edge-completed';
            } else if (isActive) {
              strokeColor = '#ef4444';
              strokeOpacity = 1;
              strokeWidth = 2;
              animationClass = 'graph-edge-active';
            } else if (isTraversed) {
              strokeColor = '#22c55e';
              strokeOpacity = 1;
              strokeWidth = 2;
              animationClass = 'graph-edge-completed';
            } else if (connectsToFocused) {
              // Connects to focused but not traversed - show but dimmed
              strokeColor = '#6b7280';
              strokeOpacity = 0.3;
              strokeWidth = 1.5;
              animationClass = 'graph-edge';
            } else if (completedAndNotUsed) {
              // Graph completed but this edge wasn't used - very faded
              strokeColor = '#6b7280';
              strokeOpacity = 0.15;
              strokeWidth = 1;
              animationClass = '';
            } else {
              strokeColor = '#6b7280';
              strokeOpacity = 0.5;
              strokeWidth = 1.5;
              animationClass = 'graph-edge';
            }
          }
          
          const edgeKey = `${edge.from}-${edge.to}-${index}`;
          
          return (
            <g key={edgeKey}>
              {/* Main edge path - use regular path to avoid re-render animation issues */}
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeDasharray={strokeDash}
                className={animationClass}
              />
              
              {/* Edge label for conditions - skip "else" labels since they're implied */}
              {edge.condition && edge.condition !== 'else' && (
                (() => {
                  // Position label at 60% along the edge
                  const t = 0.60;
                  const labelX = x1 + (x2 - x1) * t;
                  const labelY = y1 + (y2 - y1) * t;
                  // Offset to the OUTSIDE of the curve (same direction as the curve)
                  const offsetX = x2 > x1 ? 35 : x2 < x1 ? -35 : 0;
                  
                  return (
                    <g>
                      <rect
                        x={labelX + offsetX - 22}
                        y={labelY - 8}
                        width={44}
                        height={16}
                        rx={4}
                        fill="rgba(0,0,0,0.8)"
                      />
                      <text
                        x={labelX + offsetX}
                        y={labelY + 4}
                        textAnchor="middle"
                        fontSize={9}
                        fontWeight={500}
                        fill={edge.isBackEdge ? '#f59e0b' : '#ef4444'}
                        className="select-none"
                      >
                        {edge.condition.length > 8 ? edge.condition.slice(0, 6) + '…' : edge.condition}
                      </text>
                    </g>
                  );
                })()
              )}
              
              {/* Back-edge indicator */}
              {edge.isBackEdge && !edge.condition && (
                <text
                  x={(x1 + x2) / 2 + (x2 >= x1 ? 40 : -40)}
                  y={(y1 + y2) / 2}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#f59e0b"
                  className="select-none"
                >
                  ↺
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ============================================================================
// Node Logs Popup Component
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

  // Helper to process logs and prevent duplicates
  const processNewLog = useCallback((newLog: any, currentLogs: NodeLog[]) => {
    // Check metadata.nodeId (graph node ID) or context.nodeId (legacy)
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

    // Dedup check - simple check against last 50 logs
    const isDuplicate = currentLogs.slice(-50).some(l => 
      l.timestamp === processed.timestamp && 
      l.message === processed.message
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

    // 1. Fetch initial logs
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
        console.error('Error fetching logs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load logs');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHistory();

    // 2. Setup Streaming if running
    if (isRunning) {
      // Use the generations stream endpoint
      eventSource = new EventSource(`/api/v1/generations/${runId}/stream`);
      
      eventSource.onopen = () => {
        if (isMounted) console.log('[Logs] Stream connected');
      };

      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const newLog = JSON.parse(event.data);
          
          setLogs(prev => {
             const processed = processNewLog(newLog, prev);
             return processed ? [...prev, processed] : prev;
          });
        } catch (e) {
          console.error('[Logs] Error parsing event:', e);
        }
      };

      eventSource.onerror = (e) => {
        if (isMounted) console.error('[Logs] Stream error:', e);
        // EventSource auto-reconnects, but we might want to handle fatal errors
        if (eventSource?.readyState === EventSource.CLOSED) {
           // Maybe switch back to polling? or just let it close
        }
      };
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[80vh] bg-bg-secondary border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg-tertiary/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10">
              <Terminal className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary text-base">Node Logs</h3>
              <p className="text-sm text-text-muted">{nodeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
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
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
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
          <button
            onClick={onClose}
            className="px-4 py-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
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
  className = ''
}: GraphRunViewerProps) {
  const [expanded, setExpanded] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showLogsForNode, setShowLogsForNode] = useState<string | null>(null);
  
  // Pan and zoom state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const lastPinchDistance = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Zoom constraints
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;
  
  // Compute layout
  const layout = useMemo(() => computeGraphLayout(graph), [graph]);
  
  // Use execution path if available
  const executionPath = runState?.executionPath || [];
  
  // Calculate container dimensions
  const containerHeight = compact ? 180 : Math.max(320, layout.height + 100);
  
  // Calculate completion stats
  const completedCount = Object.values(runState?.nodeProgress || {})
    .filter(p => p.status === 'completed').length;
  const totalNodes = graph.nodes.length;
  const progressPct = totalNodes > 0 ? Math.round((completedCount / totalNodes) * 100) : 0;
  
  // Calculate duration
  const duration = runState?.startTime 
    ? ((runState.endTime || Date.now()) - runState.startTime) / 1000
    : 0;
  
  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId === selectedNodeId ? null : nodeId);
    onNodeClick?.(nodeId);
  }, [selectedNodeId, onNodeClick]);
  
  // Pan handlers for drag scrolling (mouse)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start panning on left click and not on a node
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.preventDefault();
  }, [pan]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    });
  }, [isPanning]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Touch handlers for mobile drag scrolling and pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    
    if (e.touches.length === 1) {
      // Single touch - pan
      const touch = e.touches[0];
      setIsPanning(true);
      panStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
    } else if (e.touches.length === 2) {
      // Two touches - prepare for pinch zoom
      setIsPanning(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy);
    }
  }, [pan]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      // Single touch - pan
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - panStart.current.x,
        y: touch.clientY - panStart.current.y,
      });
      e.preventDefault();
    } else if (e.touches.length === 2 && lastPinchDistance.current !== null) {
      // Two touches - pinch zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const scaleFactor = distance / lastPinchDistance.current;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * scaleFactor));
      
      setZoom(newZoom);
      lastPinchDistance.current = distance;
      e.preventDefault();
    }
  }, [isPanning, zoom, MIN_ZOOM, MAX_ZOOM]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      lastPinchDistance.current = null;
    } else if (e.touches.length === 1) {
      // Went from 2 to 1 finger - start panning
      lastPinchDistance.current = null;
      const touch = e.touches[0];
      setIsPanning(true);
      panStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
    }
  }, [pan]);
  
  // Wheel zoom handler - uses native event listener to avoid passive event issues
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out or in
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * delta)));
  }, [MIN_ZOOM, MAX_ZOOM]);

  // Attach wheel listener with { passive: false } to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);
  
  // Reset pan and zoom
  const resetView = useCallback(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
  }, []);

  return (
    <>
      {/* Graph Canvas with drag scrolling */}
      <div 
        ref={canvasRef}
        className={`relative w-full bg-bg-primary ${isPanning ? 'cursor-grabbing' : 'cursor-grab'} touch-none select-none`}
        style={{ 
          height: containerHeight,
          overflow: 'hidden',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Reset view button */}
        {(pan.x !== 0 || pan.y !== 0 || zoom !== 1) && (
          <button
            onClick={resetView}
            className="absolute top-2 right-2 z-10 px-2 py-1 rounded-md bg-bg-tertiary/80 hover:bg-bg-tertiary text-text-muted text-xs flex items-center gap-1 transition-colors"
          >
            <Move className="w-3 h-3" />
            Reset {zoom !== 1 && `(${Math.round(zoom * 100)}%)`}
          </button>
        )}
        {/* Pannable/Zoomable content container - centers the graph */}
        <div 
          className="absolute inset-0"
        >
          <div 
            className="relative"
            style={{ 
              transform: `translateX(-50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
              left: '50%',
              top: 20,
              width: layout.width + 60,  // 30px padding on each side
              height: layout.height + 60, // 30px padding top and bottom
            }}
          >
            {/* Connection Lines */}
            <ConnectionLines
              layout={layout}
              nodeProgress={runState?.nodeProgress || {}}
              currentNodeId={runState?.currentNodeId}
              executionPath={executionPath}
              focusedNodeId={selectedNodeId || runState?.currentNodeId}
              graphStatus={runState?.status}
            />
            {/* Nodes */}
            {Object.values(layout.nodes).map(layoutNode => {
              const progress = runState?.nodeProgress[layoutNode.id];
              const isActive = runState?.currentNodeId === layoutNode.id;
              const isInPath = executionPath.includes(layoutNode.id);
              
              // Determine the focused node (selected takes priority, then active)
              const focusedNodeId = selectedNodeId || runState?.currentNodeId;
              
              // Check if this node is connected to the focused node
              const isConnectedToFocused = focusedNodeId ? (
                layoutNode.id === focusedNodeId ||
                layoutNode.children.includes(focusedNodeId) ||
                layoutNode.parents.includes(focusedNodeId)
              ) : false;
              
              // Node should be faded if: there's a focused node AND this node isn't it AND isn't connected
              // But only if the node is in the execution path or has been touched
              const isFaded = !!(focusedNodeId && layoutNode.id !== focusedNodeId && !isConnectedToFocused && runState?.status !== 'idle');
              
              return (
                <VisualNode
                  key={layoutNode.id}
                  layoutNode={layoutNode}
                  progress={progress}
                  isActive={isActive}
                  isInPath={isInPath || !runState || runState.status === 'idle'}
                  isSelected={selectedNodeId === layoutNode.id}
                  isFaded={isFaded}
                  onClick={() => handleNodeClick(layoutNode.id)}
                  onDoubleClick={() => {
                    if (runState?.runId) {
                      setShowLogsForNode(layoutNode.id);
                    }
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      {/* Selected Node Details Panel - Fixed at bottom */}
      <AnimatePresence>
        {selectedNodeId && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-bg-secondary border-t border-border shadow-2xl shadow-black/50"
          >
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-text-primary text-sm flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    runState?.nodeProgress[selectedNodeId]?.status === 'completed' ? 'bg-green-500' :
                    runState?.nodeProgress[selectedNodeId]?.status === 'running' ? 'bg-accent animate-pulse' :
                    runState?.nodeProgress[selectedNodeId]?.status === 'error' ? 'bg-red-500' : 'bg-text-muted'
                  }`} />
                  {getNodeName(layout.nodes[selectedNodeId]?.node)}
                </h4>
                <div className="flex items-center gap-2">
                  {runState?.runId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowLogsForNode(selectedNodeId);
                      }}
                      className="px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                      title="View logs"
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      Logs
                    </button>
                  )}
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedNodeId(null); }}
                    className="p-1.5 hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
              </div>
              {runState?.nodeProgress[selectedNodeId] ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border">
                    <span className="text-text-muted block mb-0.5">Status</span>
                    <span className="text-text-primary font-medium capitalize">
                      {runState.nodeProgress[selectedNodeId]?.status}
                    </span>
                  </div>
                  {runState.nodeProgress[selectedNodeId]?.stepName && (
                    <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border">
                      <span className="text-text-muted block mb-0.5">Step</span>
                      <span className="text-text-primary font-medium truncate block">
                        {runState.nodeProgress[selectedNodeId]?.stepName}
                      </span>
                    </div>
                  )}
                  {runState.nodeProgress[selectedNodeId]?.startTime && (
                    <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border">
                      <span className="text-text-muted block mb-0.5">Duration</span>
                      <span className="text-text-primary font-medium">
                        {(((runState.nodeProgress[selectedNodeId]?.endTime || Date.now()) - 
                          runState.nodeProgress[selectedNodeId]!.startTime!) / 1000).toFixed(2)}s
                      </span>
                    </div>
                  )}
                  <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border">
                    <span className="text-text-muted block mb-0.5">Type</span>
                    <span className="text-text-primary font-medium">
                      {layout.nodes[selectedNodeId]?.node.type || 'universal'}
                    </span>
                  </div>
                  {runState.nodeProgress[selectedNodeId]?.error && (
                    <div className="col-span-full p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                      <span className="font-medium">Error: </span>
                      {runState.nodeProgress[selectedNodeId]?.error}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border">
                    <span className="text-text-muted block mb-0.5">Type</span>
                    <span className="text-text-primary font-medium">
                      {layout.nodes[selectedNodeId]?.node.type || 'universal'}
                    </span>
                  </div>
                  <div className="bg-bg-primary/50 rounded-lg p-2.5 border border-border">
                    <span className="text-text-muted block mb-0.5">Status</span>
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
    </>
  );
}

export default GraphRunViewer;
