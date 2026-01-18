/**
 * Studio Graph Store
 * 
 * Zustand store for managing graph state in the visual editor.
 * Handles nodes, edges, selection, and dirty state tracking.
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import {
    Node,
    Edge,
    NodeChange,
    EdgeChange,
    Connection,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge as rfAddEdge,
} from 'reactflow';
import dagre from 'dagre';

/**
 * Node data stored in ReactFlow node
 */
export interface StudioNodeData {
  label: string;
  nodeType: string;
  description?: string;
  icon?: string;
  color?: string;
  config?: Record<string, unknown>;
  neuronId?: string;
  tier?: number;
  isValid?: boolean;
  validationErrors?: string[];
  steps?: Array<{
    type: 'neuron' | 'tool' | 'transform' | 'conditional' | 'loop';
    config: Record<string, unknown>;
  }>;
  /** Per-graph parameter overrides for this node instance */
  parameters?: Record<string, unknown>;
}

/**
 * Edge data stored in ReactFlow edge
 */
export interface StudioEdgeData {
  label?: string;
  isConditional?: boolean;
  condition?: string;
  conditionValue?: string;
  isFallback?: boolean;
  targets?: Record<string, string>;
  fallback?: string;
  edgeColor?: string;
  isBidirectional?: boolean; // True if there's a return edge (B → A for this A → B edge)
}

/**
 * Graph metadata
 */
export interface GraphMetadata {
  graphId?: string;
  name: string;
  description: string;
  graphType: 'agent' | 'workflow';
  tier: number;
  isPublic: boolean;
  tags: string[];
  version: string;
  forkedFrom?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type StudioNode = Node<StudioNodeData>;
type StudioEdge = Edge<StudioEdgeData>;

interface GraphStoreState {
  nodes: StudioNode[];
  edges: StudioEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  metadata: GraphMetadata;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  lastSavedAt: Date | null;
  validationErrors: string[];
  isValid: boolean;
  history: {
    past: { nodes: StudioNode[]; edges: StudioEdge[] }[];
    future: { nodes: StudioNode[]; edges: StudioEdge[] }[];
  };
}

interface GraphStoreActions {
  addNode: (node: Omit<StudioNode, 'id'> & { id?: string }) => void;
  updateNode: (nodeId: string, data: Partial<StudioNode>) => void;
  updateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  addEdge: (edge: StudioEdge) => void;
  updateEdge: (edgeId: string, data: Partial<StudioEdgeData>) => void;
  removeEdge: (edgeId: string) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  clearSelection: () => void;
  updateMetadata: (metadata: Partial<GraphMetadata>) => void;
  loadGraph: (graphId: string) => Promise<void>;
  saveGraph: () => Promise<string>;
  newGraph: () => void;
  forkGraph: (graphId: string) => Promise<void>;
  validateGraph: () => void;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
}

const initialState: GraphStoreState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  metadata: {
    name: 'Untitled Graph',
    description: '',
    graphType: 'agent',
    tier: 4,
    isPublic: false,
    tags: [],
    version: '1.0.0'
  },
  isDirty: false,
  isLoading: false,
  isSaving: false,
  lastSavedAt: null,
  validationErrors: [],
  isValid: true,
  history: { past: [], future: [] }
};

function generateNodeId(): string {
  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateEdgeId(source: string, target: string): string {
  return `edge-${source}-${target}-${Date.now()}`;
}

export const useGraphStore = create<GraphStoreState & GraphStoreActions>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      ...initialState,

      addNode: (node) => {
        const newNode: StudioNode = {
          ...node,
          id: node.id || generateNodeId(),
        };
        set((state) => ({ 
          nodes: [...state.nodes, newNode], 
          isDirty: true 
        }));
        get().pushHistory();
        get().validateGraph();
      },

      updateNode: (nodeId, updates) => {
        set((state) => ({
          nodes: state.nodes.map((n) => 
            n.id === nodeId 
              ? { ...n, ...updates, data: updates.data ? { ...n.data, ...updates.data } : n.data } 
              : n
          ),
          isDirty: true
        }));
        get().validateGraph();
      },

      updateNodePosition: (nodeId, position) => {
        set((state) => ({
          nodes: state.nodes.map((n) => 
            n.id === nodeId ? { ...n, position } : n
          ),
          isDirty: true
        }));
      },

      removeNode: (nodeId) => {
        set((state) => ({
          nodes: state.nodes.filter((n) => n.id !== nodeId),
          edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
          isDirty: true
        }));
        get().pushHistory();
        get().validateGraph();
      },

      onNodesChange: (changes) => {
        console.log('[Store] onNodesChange:', changes.map(c => ({ type: c.type, id: 'id' in c ? c.id : undefined })));
        
        set((state) => {
          const meaningful = changes.some((c) => c.type === 'position' || c.type === 'remove');
          const newNodes = applyNodeChanges(changes, state.nodes) as StudioNode[];
          
          // Sync our selectedNodeId with ReactFlow's selection state
          const selectedNode = newNodes.find(n => n.selected);
          const newSelectedNodeId = selectedNode?.id || null;
          
          return {
            nodes: newNodes,
            selectedNodeId: newSelectedNodeId,
            selectedEdgeId: selectedNode ? null : state.selectedEdgeId, // Clear edge selection when node selected
            isDirty: meaningful ? true : state.isDirty
          };
        });
      },

      addEdge: (edge) => {
        set((state) => ({ 
          edges: [...state.edges, edge], 
          isDirty: true 
        }));
        get().pushHistory();
        get().validateGraph();
      },

      updateEdge: (edgeId, data) => {
        set((state) => ({
          edges: state.edges.map((e) => 
            e.id === edgeId ? { ...e, data: { ...e.data, ...data } } : e
          ),
          isDirty: true
        }));
        get().validateGraph();
      },

      removeEdge: (edgeId) => {
        set((state) => ({
          edges: state.edges.filter((e) => e.id !== edgeId),
          selectedEdgeId: state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
          isDirty: true
        }));
        get().pushHistory();
        get().validateGraph();
      },

      onEdgesChange: (changes) => {
        set((state) => {
          const meaningful = changes.some((c) => c.type === 'remove');
          return {
            edges: applyEdgeChanges(changes, state.edges) as StudioEdge[],
            isDirty: meaningful ? true : state.isDirty
          };
        });
      },

      onConnect: (connection) => {
        if (!connection.source || !connection.target) return;
        const newEdge: StudioEdge = {
          id: generateEdgeId(connection.source, connection.target),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle || undefined,
          targetHandle: connection.targetHandle || undefined,
          data: { isConditional: false }
        };
        set((state) => ({ 
          edges: rfAddEdge(newEdge, state.edges) as StudioEdge[], 
          isDirty: true 
        }));
        get().pushHistory();
        get().validateGraph();
      },

      selectNode: (nodeId) => {
        console.log('[Store] selectNode:', nodeId);
        set((state) => ({
          nodes: state.nodes.map(n => ({
            ...n,
            selected: n.id === nodeId
          })),
          selectedNodeId: nodeId,
          selectedEdgeId: null
        }));
      },
      selectEdge: (edgeId) => {
        console.log('[Store] selectEdge:', edgeId);
        set((state) => ({
          nodes: state.nodes.map(n => ({ ...n, selected: false })),
          edges: state.edges.map(e => ({
            ...e,
            selected: e.id === edgeId
          })),
          selectedEdgeId: edgeId,
          selectedNodeId: null
        }));
      },
      clearSelection: () => {
        console.log('[Store] clearSelection');
        set((state) => ({
          nodes: state.nodes.map(n => ({ ...n, selected: false })),
          edges: state.edges.map(e => ({ ...e, selected: false })),
          selectedNodeId: null,
          selectedEdgeId: null
        }));
      },

      updateMetadata: (metadata) => {
        set((state) => ({ 
          metadata: { ...state.metadata, ...metadata }, 
          isDirty: true 
        }));
      },

      loadGraph: async (graphId) => {
        set({ isLoading: true });
        try {
          // Fetch graph and node definitions in parallel
          const [graphResponse, nodesResponse] = await Promise.all([
            fetch(`/api/v1/graphs/${graphId}`),
            fetch('/api/v1/nodes')
          ]);
          
          if (!graphResponse.ok) throw new Error('Failed to load graph');
          const { graph } = await graphResponse.json();
          
          // Build node name lookup map
          const nodeNameMap: Record<string, string> = {};
          if (nodesResponse.ok) {
            const nodesData = await nodesResponse.json();
            const nodesList = nodesData.nodes || [];
            for (const node of nodesList) {
              if (node.nodeId && node.name) {
                nodeNameMap[node.nodeId] = node.name;
              }
            }
          }
          
          interface GraphNodeData {
            id: string;
            type: string;
            config?: {
              nodeId?: string;
              [key: string]: unknown;
            };
            neuronId?: string;
          }
          
          interface GraphEdgeData {
            from: string;
            to?: string;
            condition?: string;
            targets?: Record<string, string>;
            fallback?: string;
          }
          
          // Expand edges first (we need them for layout)
          const edges: StudioEdge[] = [];
          const edgeColors = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4'];
          let colorIndex = 0;
          
          graph.edges.forEach((edge: GraphEdgeData) => {
            if (edge.targets) {
              // Conditional edge - create one edge per target with distinct colors
              const targetEntries = Object.entries(edge.targets);
              targetEntries.forEach(([conditionValue, targetNode]) => {
                edges.push({
                  id: `edge-${edge.from}-${targetNode}-${conditionValue}`,
                  source: edge.from,
                  target: targetNode,
                  type: 'studioEdge',
                  data: {
                    label: conditionValue,
                    isConditional: true,
                    condition: edge.condition,
                    conditionValue,
                    isFallback: false,
                    edgeColor: edgeColors[colorIndex++ % edgeColors.length]
                  }
                });
              });
              // Add fallback edge if defined and different from targets
              if (edge.fallback && !Object.values(edge.targets).includes(edge.fallback)) {
                edges.push({
                  id: `edge-${edge.from}-${edge.fallback}-fallback`,
                  source: edge.from,
                  target: edge.fallback,
                  type: 'studioEdge',
                  data: {
                    label: 'default',
                    isConditional: true,
                    condition: edge.condition,
                    isFallback: true,
                    edgeColor: '#6b7280'
                  }
                });
              }
            } else {
              // Simple edge
              edges.push({
                id: `edge-${edge.from}-${edge.to}`,
                source: edge.from,
                target: edge.to || '',
                type: 'studioEdge',
                data: {
                  isConditional: false
                }
              });
            }
          });
          
          // Detect bidirectional edges and consolidate them
          // Create a set of edge pairs (A→B represented as "A|B" sorted)
          const edgePairs = new Map<string, { forward: StudioEdge; reverse?: StudioEdge }>();
          
          edges.forEach((edge) => {
            const [a, b] = [edge.source, edge.target].sort();
            const pairKey = `${a}|${b}`;
            
            if (!edgePairs.has(pairKey)) {
              edgePairs.set(pairKey, { forward: edge });
            } else {
              // This is the reverse edge
              edgePairs.get(pairKey)!.reverse = edge;
            }
          });
          
          // Filter edges: keep forward edges, remove reverse edges, mark bidirectional ones
          const processedEdges: StudioEdge[] = [];
          const reverseEdgeIds = new Set<string>();
          
          edgePairs.forEach(({ forward, reverse }) => {
            if (reverse) {
              // Bidirectional pair found - mark the forward edge
              reverseEdgeIds.add(reverse.id);
              processedEdges.push({
                ...forward,
                data: {
                  ...forward.data,
                  isBidirectional: true
                }
              });
            } else {
              processedEdges.push(forward);
            }
          });
          
          // Replace edges array with processed edges (removing reverse edges)
          edges.length = 0;
          edges.push(...processedEdges);
          
          // Use dagre for auto-layout if no saved layout
          const hasLayout = graph.layout && Object.keys(graph.layout).length > 0;
          const nodeWidth = 120;
          const nodeHeight = 100;
          
          let layoutPositions: Record<string, { x: number; y: number }> = {};
          
          if (!hasLayout) {
            // Create dagre graph
            const dagreGraph = new dagre.graphlib.Graph();
            dagreGraph.setDefaultEdgeLabel(() => ({}));
            dagreGraph.setGraph({ 
              rankdir: 'LR', // Left to right
              nodesep: 80,   // Vertical spacing between nodes
              ranksep: 150,  // Horizontal spacing between ranks
              marginx: 50,
              marginy: 50
            });
            
            // Add nodes to dagre (including start/end)
            dagreGraph.setNode('__start__', { width: 60, height: 60 });
            dagreGraph.setNode('__end__', { width: 60, height: 60 });
            graph.nodes.forEach((node: GraphNodeData) => {
              dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
            });
            
            // Add edges to dagre
            edges.forEach((edge) => {
              if (edge.target) {
                dagreGraph.setEdge(edge.source, edge.target);
              }
            });
            
            // Run layout
            dagre.layout(dagreGraph);
            
            // Extract positions
            dagreGraph.nodes().forEach((nodeId) => {
              const node = dagreGraph.node(nodeId);
              if (node) {
                layoutPositions[nodeId] = {
                  x: node.x - (nodeId === '__start__' || nodeId === '__end__' ? 30 : nodeWidth / 2),
                  y: node.y - (nodeId === '__start__' || nodeId === '__end__' ? 30 : nodeHeight / 2)
                };
              }
            });
          }
          
          // The actual node type is stored in config.nodeId for universal nodes
          const nodes: StudioNode[] = graph.nodes.map((node: GraphNodeData) => {
            const actualNodeType = node.config?.nodeId || node.type || node.id;
            // Resolve node name: use lookup map, fall back to formatted node type
            const nodeName = nodeNameMap[actualNodeType] || 
              actualNodeType.split('-')[0].replace(/([A-Z])/g, ' $1').trim().replace(/^./, (s: string) => s.toUpperCase());
            const position = hasLayout 
              ? (graph.layout[node.id] || layoutPositions[node.id] || { x: 200, y: 200 })
              : (layoutPositions[node.id] || { x: 200, y: 200 });
            return {
              id: node.id,
              type: 'studioNode',
              position,
              draggable: true,
              selectable: true,
              data: {
                label: nodeName,
                nodeType: actualNodeType,
                config: node.config || {},
                neuronId: node.neuronId,
                // Extract parameters from graph's node config for per-graph overrides
                parameters: (node.config?.parameters as Record<string, unknown>) || {},
                // Extract steps from graph's node config for per-graph step overrides
                steps: (node.config?.steps as Array<{ type: string; config: Record<string, unknown> }>) || undefined
              }
            };
          });

          // Add start node
          nodes.unshift({
            id: '__start__',
            type: 'startNode',
            position: hasLayout 
              ? (graph.layout['__start__'] || layoutPositions['__start__'] || { x: 50, y: 200 })
              : (layoutPositions['__start__'] || { x: 50, y: 200 }),
            draggable: true,
            selectable: true,
            data: { label: 'Start', nodeType: 'start' }
          });
          
          // Add end node
          nodes.push({
            id: '__end__',
            type: 'endNode',
            position: hasLayout 
              ? (graph.layout['__end__'] || layoutPositions['__end__'] || { x: 800, y: 200 })
              : (layoutPositions['__end__'] || { x: 800, y: 200 }),
            draggable: true,
            selectable: true,
            data: { label: 'End', nodeType: 'end' }
          });

          set({
            nodes,
            edges,
            metadata: {
              graphId: graph.graphId,
              name: graph.name,
              description: graph.description || '',
              graphType: graph.graphType || 'agent',
              tier: graph.tier,
              isPublic: graph.isPublic || false,
              tags: graph.tags || [],
              version: graph.version || '1.0.0',
              forkedFrom: graph.forkedFrom,
              createdAt: graph.createdAt ? new Date(graph.createdAt) : undefined,
              updatedAt: graph.updatedAt ? new Date(graph.updatedAt) : undefined
            },
            isLoading: false,
            isDirty: false,
            lastSavedAt: graph.updatedAt ? new Date(graph.updatedAt) : null,
            history: { past: [], future: [] }
          });
          get().validateGraph();
        } catch (error) {
          console.error('Failed to load graph:', error);
          set({ isLoading: false });
          throw error;
        }
      },

      saveGraph: async () => {
        const state = get();
        set({ isSaving: true });
        try {
          const graphNodes = state.nodes
            .filter((n) => !['__start__', '__end__'].includes(n.id))
            .map((n) => {
              // Determine if this is a built-in node type or a custom universal node
              const builtInTypes = ['precheck', 'fastpath', 'context', 'classifier', 'router', 'planner', 'executor', 'responder', 'search', 'scrape', 'command', 'universal'];
              const isBuiltInType = builtInTypes.includes(n.data.nodeType);
              
              // Build config with nodeId and parameters
              const config: Record<string, unknown> = isBuiltInType 
                ? { ...(n.data.config || {}) } 
                : { ...(n.data.config || {}), nodeId: n.data.nodeType };
              
              // Include parameters for per-graph overrides if they exist
              if (n.data.parameters && Object.keys(n.data.parameters).length > 0) {
                config.parameters = n.data.parameters;
              }
              
              // Include steps for per-graph step overrides if they exist
              if (n.data.steps && n.data.steps.length > 0) {
                config.steps = n.data.steps;
              }
              
              return {
                id: n.id,
                type: isBuiltInType ? n.data.nodeType : 'universal',
                neuronId: n.data.neuronId || null,
                config
              };
            });

          const graphEdges = state.edges.map((e) => ({
            from: e.source,
            to: e.data?.isConditional ? undefined : e.target,
            condition: e.data?.condition,
            targets: e.data?.targets,
            fallback: e.data?.fallback
          }));

          const layout: Record<string, { x: number; y: number }> = {};
          for (const node of state.nodes) {
            layout[node.id] = { x: node.position.x, y: node.position.y };
          }

          const payload = {
            name: state.metadata.name,
            description: state.metadata.description,
            graphType: state.metadata.graphType,
            tier: state.metadata.tier,
            isPublic: state.metadata.isPublic,
            tags: state.metadata.tags,
            nodes: graphNodes,
            edges: graphEdges,
            layout
          };

          let response;
          if (state.metadata.graphId) {
            response = await fetch(`/api/v1/graphs/${state.metadata.graphId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          } else {
            response = await fetch('/api/v1/graphs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save graph');
          }

          const result = await response.json();
          set((s) => ({
            metadata: { ...s.metadata, graphId: result.graphId, updatedAt: new Date() },
            isSaving: false,
            isDirty: false,
            lastSavedAt: new Date()
          }));
          return result.graphId;
        } catch (error) {
          console.error('Failed to save graph:', error);
          set({ isSaving: false });
          throw error;
        }
      },

      newGraph: () => {
        set({
          ...initialState,
          nodes: [
            {
              id: '__start__',
              type: 'startNode',
              position: { x: 100, y: 200 },
              draggable: true,
              selectable: true,
              data: { label: 'Start', nodeType: 'start' }
            },
            {
              id: '__end__',
              type: 'endNode',
              position: { x: 500, y: 200 },
              draggable: true,
              selectable: true,
              data: { label: 'End', nodeType: 'end' }
            }
          ]
        });
      },

      forkGraph: async (graphId) => {
        await get().loadGraph(graphId);
        set((state) => ({
          metadata: {
            ...state.metadata,
            graphId: undefined,
            name: `${state.metadata.name} (Fork)`,
            forkedFrom: graphId
          },
          isDirty: true
        }));
      },

      validateGraph: () => {
        const { nodes, edges } = get();
        const errors: string[] = [];
        const realNodes = nodes.filter((n) => !['__start__', '__end__'].includes(n.id));
        
        if (realNodes.length === 0) {
          errors.push('Graph must have at least one node');
        }
        
        for (const node of realNodes) {
          const hasIncoming = edges.some((e) => e.target === node.id);
          const hasOutgoing = edges.some((e) => e.source === node.id);
          if (!hasIncoming && !hasOutgoing) {
            errors.push(`Node "${node.data.label}" is not connected`);
          }
        }
        
        if (!edges.some((e) => e.source === '__start__') && realNodes.length > 0) {
          errors.push('Start must be connected to a node');
        }
        if (!edges.some((e) => e.target === '__end__') && realNodes.length > 0) {
          errors.push('At least one node must connect to End');
        }
        
        set({ validationErrors: errors, isValid: errors.length === 0 });
      },

      undo: () => {
        const { history, nodes, edges } = get();
        if (history.past.length === 0) return;
        const previous = history.past[history.past.length - 1];
        set({
          nodes: previous.nodes,
          edges: previous.edges,
          history: {
            past: history.past.slice(0, -1),
            future: [{ nodes, edges }, ...history.future]
          },
          isDirty: true
        });
        get().validateGraph();
      },

      redo: () => {
        const { history, nodes, edges } = get();
        if (history.future.length === 0) return;
        const next = history.future[0];
        set({
          nodes: next.nodes,
          edges: next.edges,
          history: {
            past: [...history.past, { nodes, edges }],
            future: history.future.slice(1)
          },
          isDirty: true
        });
        get().validateGraph();
      },

      pushHistory: () => {
        const { nodes, edges, history } = get();
        set({
          history: {
            past: [...history.past, { nodes: [...nodes], edges: [...edges] }].slice(-50),
            future: []
          }
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setSaving: (saving) => set({ isSaving: saving }),
      markDirty: () => set({ isDirty: true }),
      markClean: () => set({ isDirty: false }),
      reset: () => set(initialState)
    })),
    { name: 'graph-store' }
  )
);

// Selector hooks
export const useSelectedNode = () => {
  const selectedNodeId = useGraphStore((state) => state.selectedNodeId);
  const nodes = useGraphStore((state) => state.nodes);
  return selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null;
};

export const useSelectedEdge = () => {
  const selectedEdgeId = useGraphStore((state) => state.selectedEdgeId);
  const edges = useGraphStore((state) => state.edges);
  return selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) : null;
};

export const useIsDirty = () => useGraphStore((state) => state.isDirty);
export const useIsValid = () => useGraphStore((state) => state.isValid);
export const useValidationErrors = () => useGraphStore((state) => state.validationErrors);
