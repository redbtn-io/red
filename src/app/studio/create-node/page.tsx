'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  Brain,
  Wrench,
  Shuffle,
  GitBranch,
  Repeat,
  ChevronDown,
  ChevronRight,
  Info,
  AlertCircle,
  Check,
} from 'lucide-react';
import { pageVariants, staggerItemVariants, staggerContainerVariants } from '@/lib/animations';

interface StepConfig {
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

const STEP_TYPES = [
  { type: 'neuron', label: 'Neuron', description: 'Call an LLM', icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
  { type: 'tool', label: 'Tool', description: 'Execute a tool', icon: Wrench, color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  { type: 'transform', label: 'Transform', description: 'Transform data', icon: Shuffle, color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' },
  { type: 'conditional', label: 'Conditional', description: 'Branch logic', icon: GitBranch, color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
  { type: 'loop', label: 'Loop', description: 'Iterate over items', icon: Repeat, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20 border-cyan-500/30' },
] as const;

const CATEGORIES = [
  { value: 'routing', label: 'Routing' },
  { value: 'communication', label: 'Communication' },
  { value: 'execution', label: 'Execution' },
  { value: 'transformation', label: 'Transformation' },
  { value: 'tools', label: 'Tools' },
  { value: 'utility', label: 'Utility' },
];

const DEFAULT_STEP_CONFIGS: Record<string, Record<string, unknown>> = {
  neuron: {
    systemPrompt: '',
    userPrompt: '{{state.messages}}',
    temperature: 0.7,
    maxTokens: 4096,
    stream: true,
    outputField: 'response',
  },
  tool: {
    toolName: '',
    inputMapping: '',
    outputField: 'toolResult',
  },
  transform: {
    operation: 'set',
    inputField: '',
    outputField: '',
    value: '',
  },
  conditional: {
    condition: '',
    setField: '',
    trueValue: '',
    falseValue: '',
  },
  loop: {
    iteratorField: '',
    maxIterations: 10,
    outputField: 'loopResults',
  },
};

export default function CreateNodePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [neurons, setNeurons] = useState<NeuronInfo[]>([]);
  
  // Node metadata
  const [name, setName] = useState('');
  const [nodeId, setNodeId] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('utility');
  
  // Steps
  const [steps, setSteps] = useState<StepConfig[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [showAddStep, setShowAddStep] = useState(false);

  // Auto-generate nodeId from name
  useEffect(() => {
    if (name && !nodeId) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setNodeId(generated);
    }
  }, [name, nodeId]);

  // Fetch neurons
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

  const addStep = (type: StepConfig['type']) => {
    const newStep: StepConfig = {
      type,
      config: { ...DEFAULT_STEP_CONFIGS[type] },
    };
    setSteps([...steps, newStep]);
    setExpandedSteps((prev) => new Set([...prev, steps.length]));
    setShowAddStep(false);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
    setExpandedSteps((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const updateStepConfig = (index: number, field: string, value: unknown) => {
    setSteps((prev) => {
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
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
    
    // Update expanded state
    setExpandedSteps((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i === index) next.add(newIndex);
        else if (i === newIndex) next.add(index);
        else next.add(i);
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Node name is required');
      return;
    }
    if (!nodeId.trim()) {
      setError('Node ID is required');
      return;
    }
    if (steps.length === 0) {
      setError('At least one step is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: nodeId.trim(),
          name: name.trim(),
          description: description.trim(),
          category,
          steps,
          metadata: {
            inputs: ['state'],
            outputs: ['state'],
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create node');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/explore/nodes');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create node');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <motion.div 
        className="flex-shrink-0 sticky top-0 z-10 bg-[#0f0f0f] border-b border-[#2a2a2a]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/studio"
              className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">Create Node</h1>
              <p className="text-sm text-gray-500">Build a custom node for your workflows</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || success}
            className="flex items-center gap-2 bg-[#ef4444] hover:bg-[#dc2626] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                Created!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Node
              </>
            )}
          </button>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto">
        <motion.div 
          className="max-w-4xl mx-auto px-4 py-8 space-y-8"
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
        >
          {/* Error display */}
          <AnimatePresence>
            {error && (
              <motion.div 
                className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg px-4 py-3"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

        {/* Basic Info */}
        <motion.section 
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4"
          variants={staggerItemVariants}
        >
          <h2 className="text-lg font-semibold text-white">Basic Information</h2>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Node Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Smart Responder"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Node ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g., smart-responder"
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-[#ef4444]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this node does..."
              rows={2}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </motion.section>

        {/* Steps */}
        <motion.section 
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4"
          variants={staggerItemVariants}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              Steps {steps.length > 0 && <span className="text-gray-500">({steps.length})</span>}
            </h2>
            <button
              onClick={() => setShowAddStep(!showAddStep)}
              className="flex items-center gap-1.5 text-sm text-[#ef4444] hover:text-[#ff6b6b] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Step
            </button>
          </div>

          {/* Add Step Panel */}
          {showAddStep && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 bg-[#0a0a0a] rounded-lg border border-[#2a2a2a]">
              {STEP_TYPES.map((stepType) => {
                const Icon = stepType.icon;
                return (
                  <button
                    key={stepType.type}
                    onClick={() => addStep(stepType.type)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border ${stepType.bgColor} hover:bg-opacity-50 transition-colors`}
                  >
                    <Icon className={`w-5 h-5 ${stepType.color}`} />
                    <span className="text-xs font-medium text-gray-300">{stepType.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Steps List */}
          {steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Info className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-400 text-sm">No steps yet</p>
              <p className="text-gray-600 text-xs mt-1">Click &quot;Add Step&quot; to begin building your node</p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <StepEditor
                  key={index}
                  step={step}
                  index={index}
                  total={steps.length}
                  expanded={expandedSteps.has(index)}
                  onToggle={() => toggleStep(index)}
                  onRemove={() => removeStep(index)}
                  onUpdate={(field, value) => updateStepConfig(index, field, value)}
                  onMove={(direction) => moveStep(index, direction)}
                  neurons={neurons}
                />
              ))}
            </div>
          )}
        </motion.section>

        {/* Quick Links */}
        <motion.div 
          className="flex items-center justify-center gap-4 text-sm pb-24 md:pb-12"
          variants={staggerItemVariants}
        >
          <Link href="/explore/nodes" className="text-gray-500 hover:text-gray-300 transition-colors">
            Browse Existing Nodes
          </Link>
          <span className="text-gray-700">•</span>
          <Link href="/studio" className="text-gray-500 hover:text-gray-300 transition-colors">
            Back to Studio
          </Link>
        </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Step Editor Component
function StepEditor({
  step,
  index,
  total,
  expanded,
  onToggle,
  onRemove,
  onUpdate,
  onMove,
  neurons,
}: {
  step: StepConfig;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (field: string, value: unknown) => void;
  onMove: (direction: 'up' | 'down') => void;
  neurons: NeuronInfo[];
}) {
  const stepInfo = STEP_TYPES.find((s) => s.type === step.type)!;
  const Icon = stepInfo.icon;
  const config = step.config;

  return (
    <div className="border border-[#2a2a2a] rounded-lg overflow-hidden bg-[#0f0f0f]">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0a0a0a] border-b border-[#2a2a2a]">
        <button
          className="p-1 text-gray-600 hover:text-gray-400 cursor-grab"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500 font-mono w-5">{index + 1}</span>
        <div className={`p-1.5 rounded ${stepInfo.bgColor}`}>
          <Icon className={`w-4 h-4 ${stepInfo.color}`} />
        </div>
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <span className="text-sm font-medium text-gray-300">{stepInfo.label}</span>
          <span className="text-xs text-gray-600">{stepInfo.description}</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-1 text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="p-1 text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-600 hover:text-red-400 transition-colors"
            title="Remove step"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onToggle} className="p-1 text-gray-500">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {step.type === 'neuron' && (
            <>
              <Field label="Neuron">
                <select
                  value={String(config.neuronId || '')}
                  onChange={(e) => onUpdate('neuronId', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="">Select a neuron...</option>
                  {neurons.map((n) => (
                    <option key={n.neuronId} value={n.neuronId}>
                      {n.name} ({n.model})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="System Prompt">
                <textarea
                  value={String(config.systemPrompt || '')}
                  onChange={(e) => onUpdate('systemPrompt', e.target.value)}
                  rows={3}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
                  placeholder="Instructions for the AI..."
                />
              </Field>
              <Field label="User Prompt">
                <textarea
                  value={String(config.userPrompt || '')}
                  onChange={(e) => onUpdate('userPrompt', e.target.value)}
                  rows={2}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500 resize-none"
                  placeholder="{{state.messages}}"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Temperature">
                  <input
                    type="number"
                    value={config.temperature !== undefined ? Number(config.temperature) : 0.7}
                    onChange={(e) => onUpdate('temperature', parseFloat(e.target.value))}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                  />
                </Field>
                <Field label="Max Tokens">
                  <input
                    type="number"
                    value={config.maxTokens !== undefined ? Number(config.maxTokens) : 4096}
                    onChange={(e) => onUpdate('maxTokens', parseInt(e.target.value))}
                    min={100}
                    max={32000}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Output Field">
                  <input
                    type="text"
                    value={String(config.outputField || '')}
                    onChange={(e) => onUpdate('outputField', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                    placeholder="response"
                  />
                </Field>
                <Field label="Stream">
                  <div className="flex items-center h-full pt-1">
                    <button
                      type="button"
                      onClick={() => onUpdate('stream', !config.stream)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.stream ? 'bg-purple-500' : 'bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.stream ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </Field>
              </div>
            </>
          )}

          {step.type === 'tool' && (
            <>
              <Field label="Tool Name">
                <input
                  type="text"
                  value={String(config.toolName || '')}
                  onChange={(e) => onUpdate('toolName', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  placeholder="mcp-tool-name"
                />
              </Field>
              <Field label="Input Mapping">
                <input
                  type="text"
                  value={String(config.inputMapping || '')}
                  onChange={(e) => onUpdate('inputMapping', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  placeholder="{{state.searchQuery}}"
                />
              </Field>
              <Field label="Output Field">
                <input
                  type="text"
                  value={String(config.outputField || '')}
                  onChange={(e) => onUpdate('outputField', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  placeholder="toolResult"
                />
              </Field>
            </>
          )}

          {step.type === 'transform' && (
            <>
              <Field label="Operation">
                <select
                  value={String(config.operation || 'set')}
                  onChange={(e) => onUpdate('operation', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                >
                  {['set', 'map', 'filter', 'select', 'parse-json', 'append', 'concat'].map((op) => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Input Field">
                  <input
                    type="text"
                    value={String(config.inputField || '')}
                    onChange={(e) => onUpdate('inputField', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                    placeholder="state.data"
                  />
                </Field>
                <Field label="Output Field">
                  <input
                    type="text"
                    value={String(config.outputField || '')}
                    onChange={(e) => onUpdate('outputField', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                    placeholder="transformedData"
                  />
                </Field>
              </div>
              {config.operation === 'set' && (
                <Field label="Value">
                  <input
                    type="text"
                    value={String(config.value || '')}
                    onChange={(e) => onUpdate('value', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-amber-500"
                    placeholder="{{state.variable}}"
                  />
                </Field>
              )}
            </>
          )}

          {step.type === 'conditional' && (
            <>
              <Field label="Condition">
                <input
                  type="text"
                  value={String(config.condition || '')}
                  onChange={(e) => onUpdate('condition', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                  placeholder="state.value > 0"
                />
              </Field>
              <Field label="Set Field">
                <input
                  type="text"
                  value={String(config.setField || '')}
                  onChange={(e) => onUpdate('setField', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                  placeholder="result"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="True Value">
                  <input
                    type="text"
                    value={String(config.trueValue || '')}
                    onChange={(e) => onUpdate('trueValue', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                  />
                </Field>
                <Field label="False Value">
                  <input
                    type="text"
                    value={String(config.falseValue || '')}
                    onChange={(e) => onUpdate('falseValue', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                  />
                </Field>
              </div>
            </>
          )}

          {step.type === 'loop' && (
            <>
              <Field label="Iterator Field">
                <input
                  type="text"
                  value={String(config.iteratorField || '')}
                  onChange={(e) => onUpdate('iteratorField', e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
                  placeholder="state.items"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Max Iterations">
                  <input
                    type="number"
                    value={config.maxIterations !== undefined ? Number(config.maxIterations) : 10}
                    onChange={(e) => onUpdate('maxIterations', parseInt(e.target.value))}
                    min={1}
                    max={100}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
                  />
                </Field>
                <Field label="Output Field">
                  <input
                    type="text"
                    value={String(config.outputField || '')}
                    onChange={(e) => onUpdate('outputField', e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-cyan-500"
                    placeholder="loopResults"
                  />
                </Field>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Field wrapper
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
