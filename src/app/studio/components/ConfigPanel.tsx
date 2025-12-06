'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Trash2,
  Copy,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Info,
  Brain,
  Wrench,
  Shuffle,
  GitBranch,
  Repeat,
  Plus,
  GripVertical,
  Save,
  Variable,
} from 'lucide-react';
import { useGraphStore } from '@/lib/stores/graphStore';
import type { StudioNodeData } from '@/lib/stores/graphStore';
import type { Node } from 'reactflow';

interface ConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StepConfig {
  stepIndex: number;
  type: 'neuron' | 'tool' | 'transform' | 'conditional' | 'loop';
  configurable: Record<string, unknown>;
}

interface FullStepConfig {
  type: 'neuron' | 'tool' | 'transform' | 'conditional' | 'loop';
  config: Record<string, unknown>;
}

interface NeuronInfo {
  neuronId: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  role: string;
}

interface NodeSchema {
  nodeId: string;
  name: string;
  description: string;
  type: 'builtin' | 'universal';
  tier: string;
  category?: string;
  schema?: {
    type: string;
    properties: Record<string, SchemaProperty>;
    required?: string[];
  };
  steps?: StepConfig[];
  fullConfig?: FullStepConfig[];
}

interface SchemaProperty {
  type: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  items?: SchemaProperty;
}

/**
 * ConfigPanel Component
 * 
 * Right sidebar for configuring the selected node.
 * Dynamically generates form fields based on node schema.
 */
export default function ConfigPanel({ isOpen, onClose }: ConfigPanelProps) {
  const { selectedNodeId, nodes, updateNode, removeNode } = useGraphStore();
  const [nodeSchema, setNodeSchema] = useState<NodeSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'config', 'steps']));
  const [neurons, setNeurons] = useState<NeuronInfo[]>([]);
  const [editedSteps, setEditedSteps] = useState<FullStepConfig[]>([]);
  const [hasStepChanges, setHasStepChanges] = useState(false);

  // Find the selected node
  const selectedNode = selectedNodeId 
    ? (nodes.find((n: Node) => n.id === selectedNodeId) as Node<StudioNodeData> | undefined)
    : undefined;

  // Fetch neurons for step configuration
  useEffect(() => {
    async function fetchNeurons() {
      try {
        const response = await fetch('/api/v1/neurons');
        if (response.ok) {
          const data = await response.json();
          setNeurons(data.neurons || []);
        }
      } catch (err) {
        console.error('Error fetching neurons:', err);
      }
    }
    fetchNeurons();
  }, []);

  // Fetch node schema when selection changes
  useEffect(() => {
    async function fetchSchema() {
      if (!selectedNode || selectedNode.type === 'startNode' || selectedNode.type === 'endNode') {
        setNodeSchema(null);
        setEditedSteps([]);
        return;
      }

      const nodeType = selectedNode.data?.nodeType;
      if (!nodeType) {
        setNodeSchema(null);
        setEditedSteps([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/v1/nodes/${nodeType}`);
        if (!response.ok) {
          if (response.status === 404) {
            // Node type not found - might be a complex node
            setNodeSchema(null);
            setEditedSteps([]);
            return;
          }
          throw new Error('Failed to fetch node schema');
        }
        const data = await response.json();
        setNodeSchema(data);
        // Initialize edited steps from schema
        if (data.fullConfig) {
          setEditedSteps(data.fullConfig);
          setHasStepChanges(false);
        }
      } catch (err) {
        console.error('Error fetching node schema:', err);
        setError(err instanceof Error ? err.message : 'Failed to load schema');
      } finally {
        setLoading(false);
      }
    }

    fetchSchema();
  }, [selectedNode?.id, selectedNode?.data?.nodeType]);

  const handleDelete = useCallback(() => {
    if (selectedNodeId) {
      removeNode(selectedNodeId);
    }
  }, [selectedNodeId, removeNode]);

  const handleDuplicate = useCallback(() => {
    if (!selectedNode) return;
    
    const { addNode } = useGraphStore.getState();
    addNode({
      type: selectedNode.type || 'studio',
      position: {
        x: selectedNode.position.x + 50,
        y: selectedNode.position.y + 50,
      },
      data: { ...selectedNode.data },
    });
  }, [selectedNode]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Update a step's config
  const handleStepChange = useCallback((index: number, field: string, value: unknown) => {
    setEditedSteps((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        config: {
          ...updated[index].config,
          [field]: value,
        },
      };
      return updated;
    });
    setHasStepChanges(true);
  }, []);

  // Save step changes to node data
  const handleSaveSteps = useCallback(() => {
    if (selectedNodeId && selectedNode) {
      updateNode(selectedNodeId, {
        data: {
          ...selectedNode.data,
          steps: editedSteps,
        },
      });
      setHasStepChanges(false);
    }
  }, [selectedNodeId, selectedNode, editedSteps, updateNode]);

  // No selection state
  if (!selectedNodeId || !selectedNode) {
    return (
      <>
        {/* Mobile overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        <div className={`
          fixed lg:relative inset-y-0 right-0 z-50 lg:z-auto
          w-80 bg-[#0f0f0f] border-l border-[#2a2a2a] p-6
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          lg:block
        `}>
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-1 rounded hover:bg-[#1a1a1a] text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
              <Info className="w-8 h-8 text-gray-600" />
            </div>
            <p className="text-gray-400 text-sm">Select a node to configure</p>
            <p className="text-gray-600 text-xs mt-2">
              Click on a node in the canvas or drag a new node from the palette
            </p>
          </div>
        </div>
      </>
    );
  }

  // Start/End node - minimal config
  if (selectedNode.type === 'startNode' || selectedNode.type === 'endNode') {
    return (
      <>
        {/* Mobile overlay */}
        {isOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        <div className={`
          fixed lg:relative inset-y-0 right-0 z-50 lg:z-auto
          w-80 bg-[#0f0f0f] border-l border-[#2a2a2a] flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          lg:block
        `}>
          <Header
            title={selectedNode.type === 'startNode' ? 'Start Node' : 'End Node'}
            onDelete={handleDelete}
            onClose={onClose}
          />
          <div className="p-4">
            <p className="text-gray-400 text-sm">
              {selectedNode.type === 'startNode'
                ? 'This is the entry point of your graph. Connect it to the first node in your flow.'
                : 'This is the exit point of your graph. Connect the last node to this to complete the flow.'}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      <div className={`
        fixed lg:relative inset-y-0 right-0 z-50 lg:z-auto
        w-80 lg:w-96 h-full max-h-full min-h-0 bg-[#0f0f0f] border-l border-[#2a2a2a] flex flex-col overflow-hidden
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        lg:flex
      `}>
        <Header
          title={selectedNode.data?.label || 'Node'}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onClose={onClose}
        />

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Basic Info Section */}
        <Section
          title="Basic"
          expanded={expandedSections.has('basic')}
          onToggle={() => toggleSection('basic')}
        >
          <div className="space-y-4">
            <Field label="Name">
              <input
                type="text"
                value={selectedNode.data?.label || ''}
                onChange={(e) =>
                  updateNode(selectedNodeId, {
                    data: { ...selectedNode.data, label: e.target.value },
                  })
                }
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500"
              />
            </Field>

            <Field label="Node Type">
              <div className="text-sm text-gray-400 bg-[#1a1a1a] rounded-lg px-3 py-2">
                {selectedNode.data?.nodeType || 'Unknown'}
              </div>
            </Field>

            {selectedNode.data?.category && (
              <Field label="Category">
                <div className="text-sm text-gray-400 bg-[#1a1a1a] rounded-lg px-3 py-2 capitalize">
                  {selectedNode.data.category}
                </div>
              </Field>
            )}
          </div>
        </Section>

        {/* Configuration Section */}
        {loading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="flex items-center gap-2 text-red-400 bg-red-900/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        ) : nodeSchema?.schema?.properties ? (
          <Section
            title="Configuration"
            expanded={expandedSections.has('config')}
            onToggle={() => toggleSection('config')}
          >
            <SchemaForm
              schema={nodeSchema.schema}
              values={selectedNode.data?.config || {}}
              onChange={(config) =>
                updateNode(selectedNodeId, {
                  data: { ...selectedNode.data, config },
                })
              }
            />
          </Section>
        ) : (
          <Section
            title="Configuration"
            expanded={expandedSections.has('config')}
            onToggle={() => toggleSection('config')}
          >
            <p className="text-gray-500 text-sm">No configuration available for this node type.</p>
          </Section>
        )}

        {/* Node Info Section */}
        {nodeSchema && (
          <Section
            title="Info"
            expanded={expandedSections.has('info')}
            onToggle={() => toggleSection('info')}
          >
            <p className="text-gray-400 text-sm">{nodeSchema.description}</p>
            {nodeSchema.type && (
              <div className="mt-2">
                <span className="text-xs text-gray-500">Type: </span>
                <span className="text-xs text-gray-400">{nodeSchema.type}</span>
              </div>
            )}
            {nodeSchema.tier !== 'free' && (
              <div className="mt-3">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    nodeSchema.tier === 'basic'
                      ? 'bg-blue-900/50 text-blue-400'
                      : nodeSchema.tier === 'pro'
                      ? 'bg-purple-900/50 text-purple-400'
                      : 'bg-amber-900/50 text-amber-400'
                  }`}
                >
                  Requires {nodeSchema.tier} tier
                </span>
              </div>
            )}
          </Section>
        )}

        {/* Steps Section - For Universal Nodes */}
        {editedSteps && editedSteps.length > 0 && (
          <Section
            title={`Steps (${editedSteps.length})`}
            expanded={expandedSections.has('steps')}
            onToggle={() => toggleSection('steps')}
            action={hasStepChanges ? (
              <button
                onClick={handleSaveSteps}
                className="flex items-center gap-1 text-xs bg-[#ef4444] text-white px-2 py-1 rounded hover:bg-[#dc2626] transition-colors"
              >
                <Save className="w-3 h-3" />
                Save
              </button>
            ) : undefined}
          >
            <div className="space-y-2">
              {editedSteps.map((step, index) => (
                <StepCard 
                  key={index} 
                  step={step} 
                  index={index}
                  neurons={neurons}
                  onChange={(field, value) => handleStepChange(index, field, value)}
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
    </>
  );
}

// Header component
function Header({
  title,
  onDelete,
  onDuplicate,
  onClose,
}: {
  title: string;
  onDelete: () => void;
  onDuplicate?: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
      <h3 className="text-sm font-semibold text-gray-200 truncate">{title}</h3>
      <div className="flex items-center gap-1">
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded hover:bg-[#1a1a1a] text-gray-400 hover:text-gray-200 transition-colors"
            title="Duplicate node"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition-colors"
          title="Delete node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded hover:bg-[#1a1a1a] text-gray-400 hover:text-gray-200 transition-colors ml-1"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Collapsible section component
function Section({
  title,
  expanded,
  onToggle,
  children,
  action,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#2a2a2a]">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-4 py-3 hover:bg-[#1a1a1a] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            {title}
          </span>
        </button>
        {action && <div className="pr-4">{action}</div>}
      </div>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Field wrapper component
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// Dynamic schema form component
function SchemaForm({
  schema,
  values,
  onChange,
}: {
  schema: { properties: Record<string, SchemaProperty>; required?: string[] };
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const handleFieldChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-4">
      {Object.entries(schema.properties).map(([key, prop]) => (
        <Field key={key} label={formatLabel(key)}>
          <SchemaField
            propKey={key}
            prop={prop}
            value={values[key]}
            onChange={(value) => handleFieldChange(key, value)}
            required={schema.required?.includes(key)}
          />
          {prop.description && (
            <p className="text-xs text-gray-600 mt-1">{prop.description}</p>
          )}
        </Field>
      ))}
    </div>
  );
}

// Individual schema field component
function SchemaField({
  propKey,
  prop,
  value,
  onChange,
  required,
}: {
  propKey: string;
  prop: SchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  required?: boolean;
}) {
  // Enum - dropdown
  if (prop.enum) {
    return (
      <select
        value={(value as string) || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500"
      >
        <option value="">Select...</option>
        {prop.enum.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // Boolean - toggle
  if (prop.type === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          value ? 'bg-red-500' : 'bg-gray-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    );
  }

  // Number - number input
  if (prop.type === 'number' || prop.type === 'integer') {
    return (
      <input
        type="number"
        value={(value as number) ?? prop.default ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        min={prop.minimum}
        max={prop.maximum}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500"
      />
    );
  }

  // Array - textarea with JSON
  if (prop.type === 'array') {
    const arrayValue = Array.isArray(value) ? value : [];
    return (
      <textarea
        value={arrayValue.join('\n')}
        onChange={(e) => onChange(e.target.value.split('\n').filter(Boolean))}
        placeholder="One item per line"
        rows={3}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500 resize-none"
      />
    );
  }

  // Default - text input
  return (
    <input
      type="text"
      value={(value as string) ?? prop.default ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-red-500"
    />
  );
}

// Utility to format field labels
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// Step type icons and colors
const STEP_TYPE_INFO: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string; label: string }> = {
  neuron: { icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-900/30', label: 'Neuron' },
  tool: { icon: Wrench, color: 'text-blue-400', bgColor: 'bg-blue-900/30', label: 'Tool' },
  transform: { icon: Shuffle, color: 'text-amber-400', bgColor: 'bg-amber-900/30', label: 'Transform' },
  conditional: { icon: GitBranch, color: 'text-green-400', bgColor: 'bg-green-900/30', label: 'Conditional' },
  loop: { icon: Repeat, color: 'text-cyan-400', bgColor: 'bg-cyan-900/30', label: 'Loop' },
};

// Step card component for displaying and editing universal node steps
function StepCard({ 
  step, 
  index,
  neurons,
  onChange,
}: { 
  step: FullStepConfig; 
  index: number;
  neurons: NeuronInfo[];
  onChange: (field: string, value: unknown) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = STEP_TYPE_INFO[step.type] || { icon: Info, color: 'text-gray-400', bgColor: 'bg-gray-900/30', label: step.type };
  const Icon = typeInfo.icon;
  const config = step.config || {};

  return (
    <div className="border border-[#2a2a2a] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#1a1a1a] transition-colors"
      >
        <GripVertical className="w-3 h-3 text-gray-600" />
        <span className="text-xs text-gray-500 font-mono w-4">{index + 1}</span>
        <div className={`p-1 rounded ${typeInfo.bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${typeInfo.color}`} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-xs font-medium text-gray-300">{typeInfo.label}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-[#2a2a2a] bg-[#0a0a0a] space-y-3">
          {step.type === 'neuron' && (
            <NeuronStepEditor config={config} neurons={neurons} onChange={onChange} />
          )}
          {step.type === 'tool' && (
            <ToolStepEditor config={config} onChange={onChange} />
          )}
          {step.type === 'transform' && (
            <TransformStepEditor config={config} onChange={onChange} />
          )}
          {step.type === 'conditional' && (
            <ConditionalStepEditor config={config} onChange={onChange} />
          )}
          {step.type === 'loop' && (
            <LoopStepEditor config={config} onChange={onChange} />
          )}
        </div>
      )}
    </div>
  );
}

// Neuron step editor
function NeuronStepEditor({ 
  config, 
  neurons,
  onChange 
}: { 
  config: Record<string, unknown>;
  neurons: NeuronInfo[];
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Neuron">
        <select
          value={String(config.neuronId || '')}
          onChange={(e) => onChange('neuronId', e.target.value)}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
        >
          <option value="">Select a neuron...</option>
          {neurons.map((n) => (
            <option key={n.neuronId} value={n.neuronId}>
              {n.name} ({n.model})
            </option>
          ))}
        </select>
      </StepField>
      <StepField label="System Prompt">
        <SmartInput
          value={String(config.systemPrompt || '')}
          onChange={(val) => onChange('systemPrompt', val)}
          rows={3}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
          placeholder="Instructions for the AI..."
          isOutput={false}
        />
      </StepField>
      <StepField label="User Prompt">
        <SmartInput
          value={String(config.userPrompt || '')}
          onChange={(val) => onChange('userPrompt', val)}
          rows={2}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
          placeholder="{{state.variable}}"
          isOutput={false}
        />
      </StepField>
      <div className="flex gap-2">
        <StepField label="Temperature" className="flex-1">
          <input
            type="number"
            value={config.temperature !== undefined ? Number(config.temperature) : 0.7}
            onChange={(e) => onChange('temperature', parseFloat(e.target.value))}
            min={0}
            max={1}
            step={0.1}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
          />
        </StepField>
        <StepField label="Max Tokens" className="flex-1">
          <input
            type="number"
            value={config.maxTokens !== undefined ? Number(config.maxTokens) : 4096}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value))}
            min={100}
            max={32000}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500"
          />
        </StepField>
      </div>
      <StepField label="Output Field">
        <SmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
          placeholder="response"
          isOutput={true}
        />
      </StepField>
      <StepField label="Stream">
        <button
          type="button"
          onClick={() => onChange('stream', !config.stream)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            config.stream ? 'bg-purple-500' : 'bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              config.stream ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </StepField>
    </>
  );
}

// Tool step editor
function ToolStepEditor({ 
  config, 
  onChange 
}: { 
  config: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Tool Name">
        <SmartInput
          value={String(config.toolName || config.name || '')}
          onChange={(val) => onChange('toolName', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="mcp-tool-name"
          isOutput={false}
        />
      </StepField>
      <StepField label="Input Mapping">
        <SmartInput
          value={String(config.inputMapping || '')}
          onChange={(val) => onChange('inputMapping', val)}
          rows={2}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="{{state.searchQuery}}"
          isOutput={false}
        />
      </StepField>
      <StepField label="Output Field">
        <SmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-blue-500 resize-none"
          placeholder="toolResult"
          isOutput={true}
        />
      </StepField>
    </>
  );
}

// Transform step editor
function TransformStepEditor({ 
  config, 
  onChange 
}: { 
  config: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  const operations = ['map', 'filter', 'select', 'parse-json', 'append', 'concat', 'set'];
  
  return (
    <>
      <StepField label="Operation">
        <select
          value={String(config.operation || 'set')}
          onChange={(e) => onChange('operation', e.target.value)}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500"
        >
          {operations.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </StepField>
      <StepField label="Input Field">
        <SmartInput
          value={String(config.inputField || '')}
          onChange={(val) => onChange('inputField', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500 resize-none"
          placeholder="state.data"
          isOutput={false}
        />
      </StepField>
      <StepField label="Output Field">
        <SmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500 resize-none"
          placeholder="transformedData"
          isOutput={true}
        />
      </StepField>
      {config.operation === 'set' && (
        <StepField label="Value">
          <SmartInput
            value={String(config.value || '')}
            onChange={(val) => onChange('value', val)}
            rows={2}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-amber-500 resize-none"
            placeholder="{{state.variable}}"
            isOutput={false}
          />
        </StepField>
      )}
    </>
  );
}

// Conditional step editor
function ConditionalStepEditor({ 
  config, 
  onChange 
}: { 
  config: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Condition">
        <SmartInput
          value={String(config.condition || '')}
          onChange={(val) => onChange('condition', val)}
          rows={2}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500 resize-none"
          placeholder="state.value > 0"
          isOutput={false}
        />
      </StepField>
      <StepField label="Set Field">
        <SmartInput
          value={String(config.setField || '')}
          onChange={(val) => onChange('setField', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500 resize-none"
          placeholder="result"
          isOutput={true}
        />
      </StepField>
      <div className="flex gap-2">
        <StepField label="True Value" className="flex-1">
          <SmartInput
            value={String(config.trueValue || '')}
            onChange={(val) => onChange('trueValue', val)}
            rows={1}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500 resize-none"
            isOutput={false}
          />
        </StepField>
        <StepField label="False Value" className="flex-1">
          <SmartInput
            value={String(config.falseValue || '')}
            onChange={(val) => onChange('falseValue', val)}
            rows={1}
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-green-500 resize-none"
            isOutput={false}
          />
        </StepField>
      </div>
    </>
  );
}

// Loop step editor
function LoopStepEditor({ 
  config, 
  onChange 
}: { 
  config: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Iterator Field">
        <SmartInput
          value={String(config.iteratorField || '')}
          onChange={(val) => onChange('iteratorField', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="state.items"
          isOutput={false}
        />
      </StepField>
      <StepField label="Max Iterations">
        <input
          type="number"
          value={config.maxIterations !== undefined ? Number(config.maxIterations) : 10}
          onChange={(e) => onChange('maxIterations', parseInt(e.target.value))}
          min={1}
          max={100}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500"
        />
      </StepField>
      <StepField label="Output Field">
        <SmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          rows={1}
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="loopResults"
          isOutput={true}
        />
      </StepField>
    </>
  );
}

// Step field wrapper
function StepField({ 
  label, 
  children, 
  className = '' 
}: { 
  label: string; 
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

// Smart Input Component with Variable Autocomplete
function SmartInput({
  value,
  onChange,
  placeholder,
  isOutput = false,
  rows = 1,
  className = '',
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isOutput?: boolean;
  rows?: number;
  className?: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { nodes } = useGraphStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract variables from all nodes in the graph
  const variables = useMemo(() => {
    const vars = new Set<string>();
    nodes.forEach((node) => {
      // Check steps
      if (node.data?.steps) {
        node.data.steps.forEach((step: any) => {
          if (step.config?.outputField) vars.add(step.config.outputField);
          if (step.config?.setField) vars.add(step.config.setField);
        });
      }
      // Check config (if any built-in nodes use standard keys)
      if (node.data?.config?.outputField) vars.add(node.data.config.outputField as string);
    });
    return Array.from(vars).sort();
  }, [nodes]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (variable: string) => {
    if (isOutput) {
      onChange(variable);
    } else {
      // If input/condition, wrap in state.data accessor
      // If the field is empty, just insert
      // If not empty, append with space? Or replace?
      // For now, let's append if not empty, or replace if empty
      const toInsert = `state.data.${variable}`;
      if (!value) {
        onChange(toInsert);
      } else {
        // Simple append for now
        onChange(`${value} ${toInsert}`);
      }
    }
    setShowSuggestions(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        rows={rows}
        className={className}
        placeholder={placeholder}
      />
      {showSuggestions && variables.length > 0 && (
        <div className="absolute z-20 w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg mt-1 max-h-32 overflow-y-auto shadow-lg">
          <div className="px-2 py-1 text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#2a2a2a] bg-[#151515]">
            Variables
          </div>
          {variables.map((v) => (
            <button
              key={v}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent blur
                handleSelect(v);
              }}
              className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-[#2a2a2a] flex items-center gap-2 transition-colors"
            >
              <Variable className="w-3 h-3 text-blue-400" />
              <span>{v}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
