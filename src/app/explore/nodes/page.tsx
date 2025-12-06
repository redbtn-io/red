'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
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
  Tags,
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
  category: string;
  isSystem: boolean;
  tier: number;
  icon?: string;
  color?: string;
  inputs: string[];
  outputs: string[];
  steps?: StepConfig[];
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
  Tags,
  Blocks,
  Wrench,
  Shuffle,
  Zap,
  Code,
  Bot,
  Brain,
  Box,
  Repeat,
};

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
  4: { label: 'Free', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  routing: { label: 'Routing', description: 'Direct flow based on content analysis' },
  communication: { label: 'Communication', description: 'Generate and manage responses' },
  execution: { label: 'Execution', description: 'Plan and execute complex tasks' },
  transformation: { label: 'Transformation', description: 'Transform and process data' },
  tools: { label: 'Tools', description: 'External integrations and utilities' },
  infrastructure: { label: 'Infrastructure', description: 'Core system components' },
  utility: { label: 'Utility', description: 'General purpose helpers' },
};

export default function NodesPage() {
  const [nodes, setNodes] = useState<NodeTypeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['routing', 'communication', 'execution'])
  );
  const [selectedNode, setSelectedNode] = useState<NodeTypeInfo | null>(null);
  const [loadingNodeDetails, setLoadingNodeDetails] = useState(false);

  useEffect(() => {
    async function fetchNodes() {
      try {
        const response = await fetch('/api/v1/nodes');
        if (!response.ok) throw new Error('Failed to fetch nodes');
        const data = await response.json();
        setNodes(data.nodes || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load nodes');
      } finally {
        setLoading(false);
      }
    }
    fetchNodes();
  }, []);

  // Fetch full node details when selected
  const handleSelectNode = async (node: NodeTypeInfo) => {
    setSelectedNode(node);
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

  // Filter by search
  const filteredNodes = nodes.filter((n) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      n.name.toLowerCase().includes(query) ||
      n.description?.toLowerCase().includes(query) ||
      n.category.toLowerCase().includes(query)
    );
  });

  // Group by category
  const groupedNodes = filteredNodes.reduce((acc, node) => {
    const category = node.category || 'utility';
    if (!acc[category]) acc[category] = [];
    acc[category].push(node);
    return acc;
  }, {} as Record<string, NodeTypeInfo[]>);

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
      className="flex flex-col lg:flex-row gap-6"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Node List */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <motion.div 
          className="flex items-start justify-between"
          variants={staggerItemVariants}
        >
          <div>
            <h2 className="text-2xl font-bold text-white">Nodes</h2>
            <p className="text-gray-400 text-sm mt-1">
              Building blocks for creating AI workflows
            </p>
          </div>
          <Link
            href="/studio/create-node"
            className="flex items-center gap-2 bg-[#ef4444] hover:bg-[#dc2626] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Node
          </Link>
        </motion.div>

        {/* Search */}
        <motion.div className="relative" variants={staggerItemVariants}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ef4444]"
          />
        </motion.div>

        {/* Categories */}
        <motion.div 
          className="space-y-3"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          {Object.entries(groupedNodes).map(([category, categoryNodes]) => {
            const isExpanded = expandedCategories.has(category);
            const info = CATEGORY_INFO[category] || { label: category, description: '' };

            return (
              <motion.div 
                key={category} 
                className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden"
                variants={staggerItemVariants}
              >
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-4 hover:bg-[#2a2a2a]/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-white capitalize">{info.label}</h3>
                      <p className="text-xs text-gray-500">{info.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-1 rounded">
                    {categoryNodes.length}
                  </span>
                </button>

                {/* Nodes */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      className="border-t border-[#2a2a2a] divide-y divide-[#2a2a2a]"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      {categoryNodes.map((node) => (
                        <NodeRow 
                          key={node.nodeId} 
                          node={node} 
                          isSelected={selectedNode?.nodeId === node.nodeId}
                          onSelect={() => handleSelectNode(node)}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Empty State */}
        {Object.keys(groupedNodes).length === 0 && (
          <motion.div 
            className="flex flex-col items-center justify-center py-16 text-center"
            variants={scaleVariants}
          >
            <Box className="w-16 h-16 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No nodes found</h3>
            <p className="text-gray-500 text-sm">Try a different search term</p>
          </motion.div>
        )}
      </div>

      {/* Node Detail Panel */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={selectedNode?.nodeId || 'empty'}
          className="lg:w-80 xl:w-96"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          {selectedNode ? (
            <NodeDetail 
              node={selectedNode} 
              onClose={() => setSelectedNode(null)}
              loading={loadingNodeDetails}
            />
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center sticky top-20">
              <Box className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a node to view details</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function NodeRow({ 
  node, 
  isSelected, 
  onSelect 
}: { 
  node: NodeTypeInfo; 
  isSelected: boolean;
  onSelect: () => void;
}) {
  const IconComponent = ICON_MAP[node.icon || 'Box'] || Box;
  const tierInfo = TIER_LABELS[node.tier] || TIER_LABELS[4];

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${
        isSelected 
          ? 'bg-[#ef4444]/10 border-l-2 border-[#ef4444]' 
          : 'hover:bg-[#2a2a2a]/50'
      }`}
    >
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${node.color}20` }}
      >
        <IconComponent className="w-5 h-5" color={node.color || '#9ca3af'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-white truncate">{node.name}</h4>
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierInfo.color}`}>
            {tierInfo.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 truncate mt-0.5">
          {node.description}
        </p>
      </div>
    </button>
  );
}

function NodeDetail({ node, onClose, loading }: { node: NodeTypeInfo; onClose: () => void; loading?: boolean }) {
  const IconComponent = ICON_MAP[node.icon || 'Box'] || Box;
  const tierInfo = TIER_LABELS[node.tier] || TIER_LABELS[4];
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

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
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden sticky top-20">
      {/* Header */}
      <div 
        className="p-6 border-b border-[#2a2a2a]"
        style={{ backgroundColor: `${node.color}10` }}
      >
        <div className="flex items-start justify-between">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${node.color}20` }}
          >
            <IconComponent className="w-7 h-7" color={node.color || '#9ca3af'} />
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded border ${tierInfo.color}`}>
            {tierInfo.label}
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mt-4">{node.name}</h3>
        <p className="text-sm text-gray-400 mt-1 capitalize">{node.category}</p>
      </div>

      {/* Content - Scrollable */}
      <div className="p-6 space-y-6 max-h-[calc(100vh-350px)] overflow-y-auto">
        {/* Description */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Description
          </h4>
          <p className="text-sm text-gray-300">{node.description || 'No description available'}</p>
        </div>

        {/* Steps */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : node.steps && node.steps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
                      <span className="text-xs text-gray-500 font-mono w-4">{index + 1}</span>
                      <StepIcon className={`w-4 h-4 ${stepInfo.color}`} />
                      <span className="text-xs font-medium text-gray-300 flex-1 text-left">
                        {stepInfo.label}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
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
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Node ID
          </h4>
          <code className="text-xs bg-[#2a2a2a] text-gray-300 px-2 py-1 rounded font-mono">
            {node.nodeId}
          </code>
        </div>

        {/* Use in Studio button */}
        <Link
          href={`/studio?addNode=${node.nodeId}`}
          className="flex items-center justify-center gap-2 w-full bg-[#ef4444] hover:bg-[#dc2626] text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Play className="w-4 h-4" />
          Use in Studio
        </Link>
      </div>
    </div>
  );
}

// Display step config in a readable format
function StepConfigDisplay({ type, config }: { type: string; config: Record<string, unknown> }) {
  const renderField = (key: string, value: unknown) => {
    if (value === undefined || value === null || value === '') return null;
    
    // Format the value based on type
    let displayValue: React.ReactNode = String(value);
    if (typeof value === 'boolean') {
      displayValue = value ? 'Yes' : 'No';
    } else if (typeof value === 'object') {
      displayValue = (
        <pre className="text-[10px] text-gray-500 whitespace-pre-wrap">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    } else if (typeof value === 'string' && value.length > 50) {
      displayValue = (
        <span className="text-[10px] text-gray-400 break-words">{value}</span>
      );
    }

    return (
      <div key={key} className="mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{formatLabel(key)}</span>
        <div className="text-xs text-gray-300 mt-0.5">{displayValue}</div>
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
