'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
    Repeat, GripVertical,
    Save,
    Variable,
    Lock,
    Unlock,
    Search
} from 'lucide-react';
import { useGraphStore } from '@/lib/stores/graphStore';
import SmartInput from './SmartInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';
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

/** Parameter definition from node schema */
interface NodeParameter {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  default?: unknown;
  description?: string;
  min?: number;
  max?: number;
  enum?: string[];
  stepIndex?: number;
  configPath?: string;
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
  /** Parameterizable fields defined by the node */
  parameters?: Record<string, NodeParameter>;
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'config', 'parameters', 'steps']));
  const [neurons, setNeurons] = useState<NeuronInfo[]>([]);
  const [editedSteps, setEditedSteps] = useState<FullStepConfig[]>([]);
  const [hasStepChanges, setHasStepChanges] = useState(false);
  const [stepsUnlocked, setStepsUnlocked] = useState(false);

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
        setStepsUnlocked(false);
        return;
      }

      const nodeType = selectedNode.data?.nodeType;
      if (!nodeType) {
        setNodeSchema(null);
        setEditedSteps([]);
        setStepsUnlocked(false);
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
        // Initialize edited steps: prefer per-graph overrides, fall back to node definition
        // This allows each graph to have its own step configuration
        const graphSteps = selectedNode.data?.steps;
        if (graphSteps && graphSteps.length > 0) {
          // Use per-graph step overrides
          setEditedSteps(graphSteps);
          setHasStepChanges(false);
        } else if (data.fullConfig) {
          // Fall back to node definition's default config
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
          w-80 bg-bg-elevated border-l border-border p-6
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          lg:block
        `}>
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-1 rounded hover:bg-bg-secondary text-text-secondary"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
              <Info className="w-8 h-8 text-text-disabled" />
            </div>
            <p className="text-text-secondary text-sm">Select a node to configure</p>
            <p className="text-text-disabled text-xs mt-2">
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
          w-80 bg-bg-elevated border-l border-border flex flex-col
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
            <p className="text-text-secondary text-sm">
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
        w-72 md:w-80 lg:w-96 xl:w-[28rem] h-full max-h-full min-h-0 bg-bg-elevated border-l border-border flex flex-col overflow-hidden
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
                className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500"
              />
            </Field>

            <Field label="Node Type">
              <div className="text-sm text-text-secondary bg-bg-secondary rounded-lg px-3 py-2">
                {selectedNode.data?.nodeType || 'Unknown'}
              </div>
            </Field>
          </div>
        </Section>

        {/* Configuration Section */}
        {loading ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-text-secondary animate-spin" />
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
            <p className="text-text-muted text-sm">No configuration available for this node type.</p>
          </Section>
        )}

        {/* Parameters Section - Per-graph overrides */}
        {nodeSchema?.parameters && Object.keys(nodeSchema.parameters).length > 0 && (
          <Section
            title="Parameters"
            expanded={expandedSections.has('parameters')}
            onToggle={() => toggleSection('parameters')}
          >
            <div className="mb-3 p-2 bg-blue-900/20 rounded-lg border border-blue-500/30">
              <div className="flex items-center gap-2 text-blue-400 text-xs">
                <Variable className="w-3.5 h-3.5" />
                <span>Per-graph overrides. Changes only affect this graph.</span>
              </div>
            </div>
            <div className="space-y-4">
              {Object.entries(nodeSchema.parameters).map(([key, param]) => (
                <Field key={key} label={formatLabel(key)}>
                  <ParameterInput
                    paramKey={key}
                    param={param}
                    value={selectedNode.data?.parameters?.[key]}
                    defaultValue={param.default}
                    onChange={(value) => {
                      const currentParams = selectedNode.data?.parameters || {};
                      updateNode(selectedNodeId, {
                        data: {
                          ...selectedNode.data,
                          parameters: { ...currentParams, [key]: value }
                        }
                      });
                    }}
                    onReset={() => {
                      const currentParams = { ...(selectedNode.data?.parameters || {}) };
                      delete currentParams[key];
                      updateNode(selectedNodeId, {
                        data: {
                          ...selectedNode.data,
                          parameters: currentParams
                        }
                      });
                    }}
                  />
                  {param.description && (
                    <p className="text-xs text-text-disabled mt-1">{param.description}</p>
                  )}
                </Field>
              ))}
            </div>
          </Section>
        )}

        {/* Node Info Section */}
        {nodeSchema && (
          <Section
            title="Info"
            expanded={expandedSections.has('info')}
            onToggle={() => toggleSection('info')}
          >
            <p className="text-text-secondary text-sm">{nodeSchema.description}</p>
            {nodeSchema.type && (
              <div className="mt-2">
                <span className="text-xs text-text-muted">Type: </span>
                <span className="text-xs text-text-secondary">{nodeSchema.type}</span>
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

        {/* Steps Section - For Universal Nodes with per-graph overrides */}
        {editedSteps && editedSteps.length > 0 && (
          <Section
            title={`Steps (${editedSteps.length})`}
            expanded={expandedSections.has('steps')}
            onToggle={() => toggleSection('steps')}
            action={
              <div className="flex items-center gap-2">
                {!stepsUnlocked ? (
                  <button
                    onClick={() => setStepsUnlocked(true)}
                    className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary px-2 py-1 rounded transition-colors"
                    title="Unlock to edit step configurations"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Locked</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setStepsUnlocked(false)}
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 px-2 py-1 rounded transition-colors"
                      title="Lock step configurations"
                    >
                      <Unlock className="w-3 h-3" />
                      <span>Unlocked</span>
                    </button>
                    {hasStepChanges && (
                      <button
                        onClick={handleSaveSteps}
                        className="flex items-center gap-1 text-xs bg-accent text-white px-2 py-1 rounded hover:bg-accent-hover transition-colors"
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                    )}
                  </>
                )}
              </div>
            }
          >
            {!stepsUnlocked ? (
              /* Locked view - show steps as read-only summary */
              <div className="space-y-2 opacity-60">
                {editedSteps.map((step, index) => {
                  const typeInfo = STEP_TYPE_INFO[step.type] || { icon: Info, color: 'text-text-secondary', bgColor: 'bg-gray-900/30', label: step.type };
                  const Icon = typeInfo.icon;
                  return (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-bg-primary/50">
                      <span className="text-xs text-text-muted font-mono w-4">{index + 1}</span>
                      <div className={`p-1 rounded ${typeInfo.bgColor}`}>
                        <Icon className={`w-3.5 h-3.5 ${typeInfo.color}`} />
                      </div>
                      <span className="text-xs font-medium text-text-secondary">{typeInfo.label}</span>
                      <div className="flex-1" />
                      <Lock className="w-3 h-3 text-text-disabled" />
                    </div>
                  );
                })}
                <button
                  onClick={() => setStepsUnlocked(true)}
                  className="w-full py-2 text-xs text-text-muted hover:text-text-secondary border border-dashed border-border rounded-lg hover:border-amber-500/50 transition-colors"
                >
                  Click to unlock and edit steps
                </button>
              </div>
            ) : (
              /* Unlocked view - full editing */
              <div className="space-y-2">
                {/* Info box explaining per-graph step overrides */}
                <div className="mb-3 p-2 bg-amber-900/20 rounded-lg border border-amber-500/30">
                  <div className="flex items-start gap-2 text-amber-400 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium">Advanced:</span>
                      <span className="text-amber-300/80"> Step configs are low-level. Use Parameters above for common tweaks. Changes only affect this graph.</span>
                    </div>
                  </div>
                </div>
                {editedSteps.map((step, index) => (
                  <StepCard 
                    key={index} 
                    step={step} 
                    index={index}
                    neurons={neurons}
                    nodeParameters={nodeSchema?.parameters ? Object.keys(nodeSchema.parameters) : []}
                    onChange={(field, value) => handleStepChange(index, field, value)}
                  />
                ))}
              </div>
            )}
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
    <div className="p-4 border-b border-border flex items-center justify-between">
      <h3 className="text-sm font-semibold text-text-primary truncate">{title}</h3>
      <div className="flex items-center gap-1">
        {onDuplicate && (
          <button
            onClick={onDuplicate}
            className="p-1.5 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
            title="Duplicate node"
          >
            <Copy className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-red-900/50 text-text-secondary hover:text-red-400 transition-colors"
          title="Delete node"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors ml-1"
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
    <div className="border-b border-border">
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-4 py-3 hover:bg-bg-secondary transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
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
      <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>
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
            <p className="text-xs text-text-disabled mt-1">{prop.description}</p>
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
        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500"
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
        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500"
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
        className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500 resize-none"
      />
    );
  }

  // Default - text input
  return (
    <input
      type="text"
      value={(value as string) ?? prop.default ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500"
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

// Parameter input component for per-graph overrides
function ParameterInput({
  paramKey,
  param,
  value,
  defaultValue,
  onChange,
  onReset,
}: {
  paramKey: string;
  param: NodeParameter;
  value: unknown;
  defaultValue: unknown;
  onChange: (value: unknown) => void;
  onReset: () => void;
}) {
  const hasOverride = value !== undefined;
  const displayValue = hasOverride ? value : defaultValue;

  // Select/enum type
  if (param.type === 'select' && param.enum) {
    return (
      <div className="flex gap-2">
        <select
          value={(displayValue as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 bg-bg-secondary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500 ${
            hasOverride ? 'border-blue-500' : 'border-border'
          }`}
        >
          {param.enum.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        {hasOverride && (
          <button
            onClick={onReset}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-text-secondary rounded transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        )}
      </div>
    );
  }

  // Boolean type
  if (param.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!displayValue)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            displayValue ? 'bg-red-500' : 'bg-gray-700'
          } ${hasOverride ? 'ring-2 ring-blue-500' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              displayValue ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        {hasOverride && (
          <button
            onClick={onReset}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-text-secondary rounded transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        )}
      </div>
    );
  }

  // Number type
  if (param.type === 'number') {
    return (
      <div className="flex gap-2">
        <input
          type="number"
          value={(displayValue as number) ?? ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          min={param.min}
          max={param.max}
          step={param.min !== undefined && param.max !== undefined && param.max <= 2 ? 0.1 : 1}
          className={`flex-1 bg-bg-secondary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500 ${
            hasOverride ? 'border-blue-500' : 'border-border'
          }`}
        />
        {hasOverride && (
          <button
            onClick={onReset}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-text-secondary rounded transition-colors"
            title="Reset to default"
          >
            Reset
          </button>
        )}
      </div>
    );
  }

  // JSON type
  if (param.type === 'json') {
    const jsonString = typeof displayValue === 'string' 
      ? displayValue 
      : JSON.stringify(displayValue ?? {}, null, 2);
    return (
      <div className="space-y-1">
        <div className="flex gap-2">
          <textarea
            value={jsonString}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                onChange(parsed);
              } catch {
                // Keep raw string if invalid JSON
                onChange(e.target.value);
              }
            }}
            rows={3}
            className={`flex-1 bg-bg-secondary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500 font-mono text-xs resize-none ${
              hasOverride ? 'border-blue-500' : 'border-border'
            }`}
            placeholder="{}"
          />
          {hasOverride && (
            <button
              onClick={onReset}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-text-secondary rounded transition-colors self-start"
              title="Reset to default"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    );
  }

  // Default: string type
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={(displayValue as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 bg-bg-secondary border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-red-500 ${
          hasOverride ? 'border-blue-500' : 'border-border'
        }`}
      />
      {hasOverride && (
        <button
          onClick={onReset}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-text-secondary rounded transition-colors"
          title="Reset to default"
        >
          Reset
        </button>
      )}
    </div>
  );
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
  nodeParameters = [],
  onChange,
}: { 
  step: FullStepConfig; 
  index: number;
  neurons: NeuronInfo[];
  nodeParameters?: string[];
  onChange: (field: string, value: unknown) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeInfo = STEP_TYPE_INFO[step.type] || { icon: Info, color: 'text-text-secondary', bgColor: 'bg-gray-900/30', label: step.type };
  const Icon = typeInfo.icon;
  const config = step.config || {};

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-secondary transition-colors"
      >
        <GripVertical className="w-3 h-3 text-text-disabled" />
        <span className="text-xs text-text-muted font-mono w-4">{index + 1}</span>
        <div className={`p-1 rounded ${typeInfo.bgColor}`}>
          <Icon className={`w-3.5 h-3.5 ${typeInfo.color}`} />
        </div>
        <div className="flex-1 text-left">
          <span className="text-xs font-medium text-text-secondary">{typeInfo.label}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        )}
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 pt-2 border-t border-border bg-bg-primary space-y-3">
          {step.type === 'neuron' && (
            <NeuronStepEditor config={config} neurons={neurons} nodeParameters={nodeParameters} onChange={onChange} />
          )}
          {step.type === 'tool' && (
            <ToolStepEditor config={config} nodeParameters={nodeParameters} onChange={onChange} />
          )}
          {step.type === 'transform' && (
            <TransformStepEditor config={config} nodeParameters={nodeParameters} onChange={onChange} />
          )}
          {step.type === 'conditional' && (
            <ConditionalStepEditor config={config} nodeParameters={nodeParameters} onChange={onChange} />
          )}
          {step.type === 'loop' && (
            <LoopStepEditor config={config} nodeParameters={nodeParameters} onChange={onChange} />
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
  nodeParameters = [],
  onChange 
}: { 
  config: Record<string, unknown>;
  neurons: NeuronInfo[];
  nodeParameters?: string[];
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Neuron">
        <select
          value={String(config.neuronId || '')}
          onChange={(e) => onChange('neuronId', e.target.value)}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
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
        <GraphSmartInput
          value={String(config.systemPrompt || '')}
          onChange={(val) => onChange('systemPrompt', val)}
          rows={3}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 resize-none"
          placeholder="Instructions for the AI..."
          isOutput={false}
          nodeParameters={nodeParameters}
        />
      </StepField>
      <StepField label="User Prompt">
        <GraphSmartInput
          value={String(config.userPrompt || '')}
          onChange={(val) => onChange('userPrompt', val)}
          rows={2}
          nodeParameters={nodeParameters}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 resize-none"
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
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
          />
        </StepField>
        <StepField label="Max Tokens" className="flex-1">
          <input
            type="number"
            value={config.maxTokens !== undefined ? Number(config.maxTokens) : 4096}
            onChange={(e) => onChange('maxTokens', parseInt(e.target.value))}
            min={100}
            max={32000}
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500"
          />
        </StepField>
      </div>
      <StepField label="Output Field">
        <GraphSmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-purple-500 resize-none"
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
  nodeParameters = [],
  onChange 
}: { 
  config: Record<string, unknown>;
  nodeParameters?: string[];
  onChange: (field: string, value: unknown) => void;
}) {
  const { tools } = useAvailableTools();
  const [showBrowser, setShowBrowser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Find the selected tool's schema
  const selectedTool = tools.find(t => t.name === config.toolName || t.name === config.name);
  const schemaProperties = selectedTool?.inputSchema?.properties || {};
  const requiredParams = selectedTool?.inputSchema?.required || [];
  const hasSchema = Object.keys(schemaProperties).length > 0;

  // Parse existing parameters or inputMapping (for migration)
  const getInputMappings = (): Record<string, string> => {
    const mapping = config.parameters || config.inputMapping;
    if (typeof mapping === 'object' && mapping !== null) {
      return mapping as Record<string, string>;
    }
    return {};
  };

  const [inputMappings, setInputMappings] = useState<Record<string, string>>(getInputMappings());

  // Update mappings when tool changes
  useEffect(() => {
    if (hasSchema) {
      const newMappings: Record<string, string> = {};
      Object.keys(schemaProperties).forEach(key => {
        newMappings[key] = inputMappings[key] || '';
      });
      setInputMappings(newMappings);
    }
  }, [config.toolName]);

  const handleSelectTool = (toolName: string) => {
    onChange('toolName', toolName);
    setShowBrowser(false);
    setSearchQuery('');
  };

  const updateMapping = (param: string, value: string) => {
    const newMappings = { ...inputMappings, [param]: value };
    setInputMappings(newMappings);
    onChange('parameters', newMappings);
  };

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <StepField label="Tool Name">
        <div className="space-y-2">
          <div className="flex gap-2">
            <GraphSmartInput
              value={String(config.toolName || config.name || '')}
              onChange={(val) => onChange('toolName', val)}
              rows={1}
              className="flex-1 bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-blue-500 resize-none"
              placeholder="mcp-tool-name"
              isOutput={false}
              nodeParameters={nodeParameters}
            />
            <button
              type="button"
              onClick={() => setShowBrowser(!showBrowser)}
              className="px-2 py-1.5 text-xs bg-bg-secondary border border-border rounded hover:bg-bg-hover transition-colors text-accent"
            >
              {showBrowser ? '×' : '...'}
            </button>
          </div>
          
          {/* Mini tool browser */}
          {showBrowser && (
            <div className="p-2 bg-bg-primary border border-border rounded space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-6 pr-2 py-1 bg-bg-secondary border border-border rounded text-xs text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {filteredTools.slice(0, 8).map(tool => (
                  <div
                    key={`${tool.server}:${tool.name}`}
                    onClick={() => handleSelectTool(tool.name)}
                    className="p-1.5 bg-bg-secondary rounded hover:bg-bg-hover cursor-pointer"
                  >
                    <div className="font-mono text-xs text-accent-text">{tool.name}</div>
                    <div className="text-xs text-text-muted truncate">{tool.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </StepField>

      {/* Tool Parameters - show schema-based inputs when available */}
      {hasSchema ? (
        <StepField label="Tool Parameters">
          <div className="space-y-2 p-2 bg-bg-primary border border-border rounded">
            {Object.entries(schemaProperties).map(([param, schema]) => {
              const isRequired = requiredParams.includes(param);
              const paramSchema = schema as { type?: string; description?: string; enum?: string[] };
              return (
                <div key={param} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <label className="text-xs font-mono text-accent-text">
                      {param}
                      {isRequired && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    {paramSchema.type && (
                      <span className="text-[10px] text-text-disabled px-1 bg-bg-secondary rounded">
                        {Array.isArray(paramSchema.type) ? paramSchema.type.join('|') : paramSchema.type}
                      </span>
                    )}
                  </div>
                  {paramSchema.description && (
                    <p className="text-[10px] text-text-muted leading-tight">{paramSchema.description}</p>
                  )}
                  {paramSchema.enum ? (
                    <select
                      value={inputMappings[param] || ''}
                      onChange={(e) => updateMapping(param, e.target.value)}
                      className="w-full bg-bg-secondary border border-border rounded px-1.5 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    >
                      <option value="">Select...</option>
                      {paramSchema.enum.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={inputMappings[param] || ''}
                      onChange={(e) => updateMapping(param, e.target.value)}
                      placeholder={`{{state.${param}}}`}
                      className="w-full bg-bg-secondary border border-border rounded px-1.5 py-1 text-xs text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </StepField>
      ) : (
        <StepField label="Input Mapping">
          <GraphSmartInput
            value={typeof config.inputMapping === 'string' ? config.inputMapping : JSON.stringify(config.inputMapping || '')}
            onChange={(val) => onChange('inputMapping', val)}
            rows={2}
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-blue-500 resize-none"
            placeholder="{{state.searchQuery}}"
            isOutput={false}
            nodeParameters={nodeParameters}
          />
          <p className="mt-1 text-[10px] text-text-disabled">
            Select a tool to see its parameters
          </p>
        </StepField>
      )}

      <StepField label="Output Field">
        <GraphSmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          rows={1}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-blue-500 resize-none"
          placeholder="toolResult"
          isOutput={true}
          nodeParameters={nodeParameters}
        />
      </StepField>
    </>
  );
}

// Transform step editor
function TransformStepEditor({ 
  config,
  nodeParameters = [],
  onChange 
}: { 
  config: Record<string, unknown>;
  nodeParameters?: string[];
  onChange: (field: string, value: unknown) => void;
}) {
  const operations = ['map', 'filter', 'select', 'parse-json', 'append', 'concat', 'set'];
  
  return (
    <>
      <StepField label="Operation">
        <select
          value={String(config.operation || 'set')}
          onChange={(e) => onChange('operation', e.target.value)}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-amber-500"
        >
          {operations.map((op) => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </StepField>
      <StepField label="Input Field">
        <GraphSmartInput
          value={String(config.inputField || '')}
          onChange={(val) => onChange('inputField', val)}
          rows={1}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-amber-500 resize-none"
          placeholder="state.data"
          isOutput={false}
          nodeParameters={nodeParameters}
        />
      </StepField>
      <StepField label="Output Field">
        <GraphSmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          rows={1}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-amber-500 resize-none"
          placeholder="data.result or globalState.namespace.key"
          isOutput={true}
          nodeParameters={nodeParameters}
        />
      </StepField>
      {config.operation === 'set' && (
        <StepField label="Value">
          <GraphSmartInput
            value={String(config.value || '')}
            onChange={(val) => onChange('value', val)}
            rows={2}
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-amber-500 resize-none"
            placeholder="{{state.variable}}"
            isOutput={false}
            nodeParameters={nodeParameters}
          />
        </StepField>
      )}
    </>
  );
}

// Conditional step editor
function ConditionalStepEditor({ 
  config,
  nodeParameters = [],
  onChange 
}: { 
  config: Record<string, unknown>;
  nodeParameters?: string[];
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Condition">
        <GraphSmartInput
          nodeParameters={nodeParameters}
          value={String(config.condition || '')}
          onChange={(val) => onChange('condition', val)}
          rows={2}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-green-500 resize-none"
          placeholder="state.value > 0"
          isOutput={false}
        />
      </StepField>
      <StepField label="Set Field">
        <GraphSmartInput
          value={String(config.setField || '')}
          onChange={(val) => onChange('setField', val)}
          rows={1}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-green-500 resize-none"
          placeholder="result"
          isOutput={true}
          nodeParameters={nodeParameters}
        />
      </StepField>
      <div className="flex gap-2">
        <StepField label="True Value" className="flex-1">
          <GraphSmartInput
            value={String(config.trueValue || '')}
            onChange={(val) => onChange('trueValue', val)}
            rows={1}
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-green-500 resize-none"
            isOutput={false}
            nodeParameters={nodeParameters}
          />
        </StepField>
        <StepField label="False Value" className="flex-1">
          <GraphSmartInput
            value={String(config.falseValue || '')}
            onChange={(val) => onChange('falseValue', val)}
            rows={1}
            className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-green-500 resize-none"
            isOutput={false}
            nodeParameters={nodeParameters}
          />
        </StepField>
      </div>
    </>
  );
}

// Loop step editor
function LoopStepEditor({ 
  config,
  nodeParameters = [],
  onChange 
}: { 
  config: Record<string, unknown>;
  nodeParameters?: string[];
  onChange: (field: string, value: unknown) => void;
}) {
  return (
    <>
      <StepField label="Iterator Field">
        <GraphSmartInput
          value={String(config.iteratorField || '')}
          onChange={(val) => onChange('iteratorField', val)}
          rows={1}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="state.items"
          isOutput={false}
          nodeParameters={nodeParameters}
        />
      </StepField>
      <StepField label="Max Iterations">
        <input
          type="number"
          value={config.maxIterations !== undefined ? Number(config.maxIterations) : 10}
          onChange={(e) => onChange('maxIterations', parseInt(e.target.value))}
          min={1}
          max={100}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500"
        />
      </StepField>
      <StepField label="Output Field">
        <GraphSmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onChange('outputField', val)}
          rows={1}
          className="w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none"
          placeholder="loopResults"
          isOutput={true}
          nodeParameters={nodeParameters}
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
      <label className="block text-[10px] font-medium text-text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

// GraphSmartInput - wrapper around SmartInput that extracts graph variables and node parameters
function GraphSmartInput({
  value,
  onChange,
  placeholder,
  isOutput = false,
  rows = 1,
  className = '',
  nodeParameters = [],
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  isOutput?: boolean;
  rows?: number;
  className?: string;
  nodeParameters?: string[];
}) {
  const { nodes } = useGraphStore();

  // Extract variables from all nodes in the graph
  const graphVariables = useMemo(() => {
    const vars = new Set<string>();
    nodes.forEach((node) => {
      // Check steps
      if (node.data?.steps) {
        node.data.steps.forEach((step: any) => {
          if (step.config?.outputField) vars.add(step.config.outputField);
          if (step.config?.setField) vars.add(step.config.setField);
          if (step.config?.outputPath) vars.add(step.config.outputPath);
        });
      }
      // Check config (if any built-in nodes use standard keys)
      if (node.data?.config?.outputField) vars.add(node.data.config.outputField as string);
    });
    return Array.from(vars).sort();
  }, [nodes]);

  return (
    <SmartInput
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      isOutput={isOutput}
      rows={rows}
      className={className}
      graphVariables={graphVariables}
      nodeParameters={nodeParameters}
    />
  );
}
