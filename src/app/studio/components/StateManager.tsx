'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  X,
  Circle,
  ArrowRight,
  ArrowLeft,
  ArrowLeftRight,
  Loader2,
} from 'lucide-react';
import { useGraphStore } from '@/lib/stores/graphStore';

interface NodeDefinition {
  nodeId: string;
  name: string;
  steps?: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
  fullConfig?: Array<{
    type: string;
    config: Record<string, unknown>;
  }>;
}

interface StateNode {
  name: string;
  path: string;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
  readers: string[]; // node names that read this
  writers: string[]; // node names that write to this
  children: Map<string, StateNode>;
  isInfrastructure?: boolean;
}

interface StateManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Cache for node definitions to avoid re-fetching
const nodeDefinitionsCache = new Map<string, NodeDefinition>();


// Infrastructure fields (not typically modified by user nodes)
const INFRASTRUCTURE_FIELDS: Record<string, { type: string; description: string }> = {
  neuronRegistry: { type: 'object', description: 'AI model connections' },
  mcpClient: { type: 'object', description: 'MCP protocol client' },
  memory: { type: 'object', description: 'Conversation memory store' },
  messageQueue: { type: 'object', description: 'Streaming message queue' },
  logger: { type: 'object', description: 'Debug logger instance' },
  mcpRegistry: { type: 'object', description: 'MCP tool registry' },
  nodeCounter: { type: 'number', description: 'Execution counter' },
};

// Type hints for known field types (used for display, not for populating tree)
const KNOWN_FIELD_TYPES: Record<string, { type: string; description?: string }> = {
  // Common data fields
  'data.query': { type: 'object', description: 'User input query' },
  'data.query.message': { type: 'string', description: 'The user message text' },
  'data.query.timestamp': { type: 'string', description: 'When query was sent' },
  'data.response': { type: 'string', description: 'Generated response text' },
  'data.options': { type: 'object', description: 'Runtime options' },
  'data.options.stream': { type: 'boolean', description: 'Enable streaming' },
  'data.contextMessages': { type: 'array', description: 'Conversation history' },
  'data.routingDecision': { type: 'object', description: 'Router decision' },
  'data.executionPlan': { type: 'object', description: 'Planner output' },
  'data.searchResults': { type: 'object', description: 'Search results' },
  // Global state fields
  'globalState': { type: 'object', description: 'Persistent global state' },
};

/**
 * StateManager Component
 * 
 * Visualizes the deeply nested state object that flows between nodes.
 * Shows a tree structure with read/write indicators for each field.
 */
export default function StateManager({ isOpen, onClose }: StateManagerProps) {
  const { nodes, selectNode } = useGraphStore();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['data', 'globalState']));
  const [showInfrastructure, setShowInfrastructure] = useState(false);
  const [nodeDefinitions, setNodeDefinitions] = useState<Map<string, NodeDefinition>>(new Map());
  const [isLoading, setIsLoading] = useState(false);

  // Fetch node definitions when opened
  useEffect(() => {
    if (!isOpen || nodes.length === 0) return;

    const fetchNodeDefinitions = async () => {
      const nodeTypesToFetch = new Set<string>();
      
      // Collect all unique node types that need definitions
      nodes.forEach((node) => {
        if (node.type === 'startNode' || node.type === 'endNode') return;
        const nodeType = node.data?.nodeType;
        if (nodeType && !nodeDefinitionsCache.has(nodeType)) {
          nodeTypesToFetch.add(nodeType);
        }
      });

      if (nodeTypesToFetch.size === 0) {
        // All definitions are cached
        const cachedDefs = new Map<string, NodeDefinition>();
        nodes.forEach((node) => {
          const nodeType = node.data?.nodeType;
          if (nodeType && nodeDefinitionsCache.has(nodeType)) {
            cachedDefs.set(nodeType, nodeDefinitionsCache.get(nodeType)!);
          }
        });
        setNodeDefinitions(cachedDefs);
        return;
      }

      setIsLoading(true);
      const newDefinitions = new Map<string, NodeDefinition>(nodeDefinitionsCache);

      // Fetch each node definition
      await Promise.all(
        Array.from(nodeTypesToFetch).map(async (nodeType) => {
          try {
            const response = await fetch(`/api/v1/nodes/${nodeType}`);
            if (response.ok) {
              const data = await response.json();
              const def: NodeDefinition = {
                nodeId: data.nodeId,
                name: data.name,
                steps: data.fullConfig || data.steps || [],
              };
              nodeDefinitionsCache.set(nodeType, def);
              newDefinitions.set(nodeType, def);
            }
          } catch (error) {
            console.error(`[StateManager] Failed to fetch node definition for ${nodeType}:`, error);
          }
        })
      );

      setNodeDefinitions(newDefinitions);
      setIsLoading(false);
    };

    fetchNodeDefinitions();
  }, [isOpen, nodes]);

  // Build state tree from node configs
  const stateTree = useMemo(() => {
    const root: StateNode = {
      name: 'state',
      path: '',
      type: 'object',
      readers: [],
      writers: [],
      children: new Map(),
    };

    // Helper to ensure a path exists in the tree
    const ensurePath = (pathStr: string, isInfra = false): StateNode => {
      const parts = pathStr.split('.').filter(Boolean);
      let current = root;
      let currentPath = '';

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}.${part}` : part;
        
        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            path: currentPath,
            type: 'any',
            readers: [],
            writers: [],
            children: new Map(),
            isInfrastructure: isInfra,
          });
        }
        current = current.children.get(part)!;
      }

      return current;
    };

    // Helper to apply known type hints to a node
    const applyTypeHints = (stateNode: StateNode) => {
      const hint = KNOWN_FIELD_TYPES[stateNode.path];
      if (hint) {
        stateNode.type = hint.type as StateNode['type'];
        if (hint.description) stateNode.description = hint.description;
      }
    };

    // Add infrastructure fields (only if showInfrastructure would be enabled)
    // These are added lazily, not by default
    Object.entries(INFRASTRUCTURE_FIELDS).forEach(([name, info]) => {
      const node = ensurePath(name, true);
      node.type = info.type as StateNode['type'];
      node.description = info.description;
    });

    // Parse node configs to find reads and writes
    nodes.forEach((node) => {
      if (node.type === 'startNode' || node.type === 'endNode') return;
      
      const nodeName = node.data?.label || node.id;
      const nodeType = node.data?.nodeType;
      
      // Get steps from node definition (fetched from API) or fall back to per-graph overrides
      const nodeDefinition = nodeType ? nodeDefinitions.get(nodeType) : null;
      const definitionSteps = nodeDefinition?.steps || [];
      const graphSteps = node.data?.steps || [];
      
      // Use node definition steps as base, or graph steps if no definition available
      const steps = definitionSteps.length > 0 ? definitionSteps : graphSteps;
      
      // Stringify config AND steps to find all state references
      const config = node.data?.config || {};
      const fullConfig = JSON.stringify({ config, steps });

      // Find all {{state.xxx}} reads
      const readMatches = fullConfig.matchAll(/\{\{\s*state\.([a-zA-Z0-9_.?[\]]+)/g);
      for (const match of readMatches) {
        const path = match[1]
          .replace(/\?/g, '') // Remove optional chaining
          .replace(/\[\d+\]/g, '') // Remove array indices
          .replace(/\.+$/, ''); // Remove trailing dots
        
        if (path) {
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.readers.includes(nodeName)) {
            stateNode.readers.push(nodeName);
          }
        }
      }

      // Find all {{globalState.xxx}} reads
      const globalStateReadMatches = fullConfig.matchAll(/\{\{\s*globalState\.([a-zA-Z0-9_.?[\]]+)/g);
      for (const match of globalStateReadMatches) {
        const path = 'globalState.' + match[1]
          .replace(/\?/g, '')
          .replace(/\[\d+\]/g, '')
          .replace(/\.+$/, '');
        
        if (path) {
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.readers.includes(nodeName)) {
            stateNode.readers.push(nodeName);
          }
        }
      }

      // Find outputField writes (from neuron steps)
      steps.forEach((step: Record<string, unknown>) => {
        const stepConfig = step.config as Record<string, unknown> | undefined;
        
        if (step.type === 'neuron' && stepConfig?.outputField) {
          const path = stepConfig.outputField as string;
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.writers.includes(nodeName)) {
            stateNode.writers.push(nodeName);
          }
        }

        // Conditional setField writes
        if (step.type === 'conditional' && stepConfig?.setField) {
          const path = stepConfig.setField as string;
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.writers.includes(nodeName)) {
            stateNode.writers.push(nodeName);
          }
        }

        // Transform outputPath writes
        if (step.type === 'transform' && stepConfig?.outputPath) {
          const path = stepConfig.outputPath as string;
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.writers.includes(nodeName)) {
            stateNode.writers.push(nodeName);
          }
        }

        // Transform set operation with outputField
        if (step.type === 'transform' && stepConfig?.operation === 'set' && stepConfig?.outputField) {
          const path = stepConfig.outputField as string;
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.writers.includes(nodeName)) {
            stateNode.writers.push(nodeName);
          }
        }

        // Tool outputField writes
        if (step.type === 'tool' && stepConfig?.outputField) {
          const path = stepConfig.outputField as string;
          const stateNode = ensurePath(path);
          applyTypeHints(stateNode);
          if (!stateNode.writers.includes(nodeName)) {
            stateNode.writers.push(nodeName);
          }
        }
      });
    });

    return root;
  }, [nodes, nodeDefinitions]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleNodeClick = useCallback((nodeName: string) => {
    // Find the node by name and select it
    const node = nodes.find(n => 
      n.data?.label === nodeName || 
      n.id === nodeName
    );
    if (node) {
      selectNode(node.id);
    }
  }, [nodes, selectNode]);

  if (!isOpen) return null;

  // Filter infrastructure if not shown
  const visibleChildren = Array.from(stateTree.children.entries()).filter(
    ([, node]) => showInfrastructure || !node.isInfrastructure
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute right-0 top-0 bottom-0 w-80 bg-bg-elevated border-l border-border z-30 flex flex-col"
    >
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-500" />
          <span className="font-medium text-sm text-text-primary">State Manager</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Info */}
      <div className="px-3 py-2 bg-cyan-500/10 border-b border-cyan-500/20 text-xs text-cyan-300">
        State object structure. Click node names to select them.
      </div>

      {/* Toggle infrastructure */}
      <div className="px-3 py-2 border-b border-border">
        <button
          onClick={() => setShowInfrastructure(!showInfrastructure)}
          className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          {showInfrastructure ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showInfrastructure ? 'Hide' : 'Show'} infrastructure
        </button>
      </div>

      {/* State Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
            <span className="ml-2 text-xs text-text-muted">Loading node definitions...</span>
          </div>
        ) : visibleChildren.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Database className="w-8 h-8 text-text-disabled mb-2" />
            <p className="text-xs text-text-muted">No state references found</p>
            <p className="text-[10px] text-text-disabled mt-1">
              Add nodes with state references to see them here
            </p>
          </div>
        ) : (
          <div className="font-mono text-xs">
            {visibleChildren.map(([key, node]) => (
              <StateTreeNode
                key={key}
                node={node}
                depth={0}
                expandedPaths={expandedPaths}
                onToggle={togglePath}
                onNodeClick={handleNodeClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-border bg-bg-primary">
        <div className="flex items-center justify-center gap-4 text-[10px] text-text-muted">
          <div className="flex items-center gap-1">
            <ArrowLeft className="w-3 h-3 text-green-500" />
            <span>Read</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowRight className="w-3 h-3 text-amber-500" />
            <span>Write</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowLeftRight className="w-3 h-3 text-blue-500" />
            <span>Both</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StateTreeNode({
  node,
  depth,
  expandedPaths,
  onToggle,
  onNodeClick,
}: {
  node: StateNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onNodeClick: (nodeName: string) => void;
}) {
  const hasChildren = node.children.size > 0;
  const isExpanded = expandedPaths.has(node.path);
  const hasReaders = node.readers.length > 0;
  const hasWriters = node.writers.length > 0;

  // Determine access type
  const accessType = hasReaders && hasWriters ? 'both' : hasReaders ? 'read' : hasWriters ? 'write' : 'none';

  // Type color
  const typeColors: Record<string, string> = {
    object: 'text-purple-400',
    array: 'text-blue-400',
    string: 'text-green-400',
    number: 'text-amber-400',
    boolean: 'text-pink-400',
    any: 'text-text-muted',
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-1 py-0.5 px-1 rounded hover:bg-bg-secondary cursor-pointer group ${
          node.isInfrastructure ? 'opacity-60' : ''
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => hasChildren && onToggle(node.path)}
      >
        {/* Expand/collapse icon */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
          )
        ) : (
          <Circle className="w-2 h-2 text-text-disabled flex-shrink-0 ml-0.5 mr-0.5" />
        )}

        {/* Field name */}
        <span className={`${node.isInfrastructure ? 'text-text-muted' : 'text-text-primary'}`}>
          {node.name}
        </span>

        {/* Type indicator */}
        {node.type && node.type !== 'any' && (
          <span className={`${typeColors[node.type] || 'text-text-muted'} text-[10px] ml-1`}>
            {node.type === 'array' ? '[]' : node.type === 'object' ? '{}' : node.type.charAt(0)}
          </span>
        )}

        {/* Access indicator */}
        {accessType !== 'none' && (
          <span className="ml-auto flex items-center gap-0.5">
            {accessType === 'read' && <ArrowLeft className="w-2.5 h-2.5 text-green-500" />}
            {accessType === 'write' && <ArrowRight className="w-2.5 h-2.5 text-amber-500" />}
            {accessType === 'both' && <ArrowLeftRight className="w-2.5 h-2.5 text-blue-500" />}
          </span>
        )}
      </div>

      {/* Readers/Writers when expanded */}
      {(hasReaders || hasWriters) && isExpanded && (
        <div
          className="text-[10px] text-text-muted py-1 space-y-0.5"
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
        >
          {hasReaders && (
            <div className="flex items-center gap-1 flex-wrap">
              <ArrowLeft className="w-2.5 h-2.5 text-green-500 flex-shrink-0" />
              {node.readers.map((r, i) => (
                <button
                  key={r}
                  onClick={(e) => { e.stopPropagation(); onNodeClick(r); }}
                  className="text-green-400 hover:text-green-300 hover:underline"
                >
                  {r}{i < node.readers.length - 1 ? ',' : ''}
                </button>
              ))}
            </div>
          )}
          {hasWriters && (
            <div className="flex items-center gap-1 flex-wrap">
              <ArrowRight className="w-2.5 h-2.5 text-amber-500 flex-shrink-0" />
              {node.writers.map((w, i) => (
                <button
                  key={w}
                  onClick={(e) => { e.stopPropagation(); onNodeClick(w); }}
                  className="text-amber-400 hover:text-amber-300 hover:underline"
                >
                  {w}{i < node.writers.length - 1 ? ',' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {Array.from(node.children.entries()).map(([key, child]) => (
            <StateTreeNode
              key={key}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}
