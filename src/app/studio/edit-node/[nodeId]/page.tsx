'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import SmartInput from '../../components/SmartInput';
import { useAvailableTools } from '@/hooks/useAvailableTools';
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
    X,
    Sparkles,
    MessageSquare,
    Search,
    Zap,
    Box,
    Code,
    Database,
    Globe,
    Settings,
    Terminal,
    FileText,
    Image,
    Music,
    Video,
    Mail,
    Bell,
    Calendar,
    Clock,
    Cloud,
    Heart,
    Star,
    Bookmark,
    Tag,
    Lock,
    Unlock,
    Eye,
    Link as LinkIcon,
    Cpu,
    Activity,
    BarChart,
    PieChart,
    TrendingUp,
    Filter,
    Layers,
    Grid,
    List,
    MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { pageVariants, staggerItemVariants } from '@/lib/animations';
import { ColorPicker } from '@/components/ui/ColorPicker';

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

// Parameter definition for exposed knobs
interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  default: unknown;
  description?: string;
  min?: number | null;
  max?: number | null;
  enum?: unknown[] | null;
}

const PARAMETER_TYPES = [
  { type: 'string', label: 'String', description: 'Text value' },
  { type: 'number', label: 'Number', description: 'Numeric value with optional min/max' },
  { type: 'boolean', label: 'Boolean', description: 'True/false toggle' },
  { type: 'select', label: 'Select', description: 'Choose from predefined options' },
  { type: 'json', label: 'JSON', description: 'Complex object or array' },
] as const;

interface NodeData {
  nodeId: string;
  name: string;
  description?: string;
  tags?: string[];
  steps: StepConfig[];
  parameters?: Record<string, ParameterDefinition>;
  metadata?: {
    icon?: string;
    color?: string;
    inputs?: string[];
    outputs?: string[];
  };
  // Top-level inputs/outputs from API
  inputs?: string[];
  outputs?: string[];
  isOwned?: boolean;
  isSystem?: boolean;
  isImmutable?: boolean;
}

const ICON_OPTIONS: { icon: LucideIcon; name: string }[] = [
  // Primary icons (shown by default)
  { icon: Brain, name: 'brain' },
  { icon: Sparkles, name: 'sparkles' },
  { icon: MessageSquare, name: 'message-square' },
  { icon: Search, name: 'search' },
  { icon: Zap, name: 'zap' },
  { icon: Wrench, name: 'wrench' },
  { icon: Code, name: 'code' },
  { icon: Terminal, name: 'terminal' },
  // Extended icons (shown when expanded)
  { icon: Database, name: 'database' },
  { icon: Globe, name: 'globe' },
  { icon: Settings, name: 'settings' },
  { icon: Box, name: 'box' },
  { icon: GitBranch, name: 'git-branch' },
  { icon: Shuffle, name: 'shuffle' },
  { icon: FileText, name: 'file-text' },
  { icon: Image, name: 'image' },
  { icon: Music, name: 'music' },
  { icon: Video, name: 'video' },
  { icon: Mail, name: 'mail' },
  { icon: Bell, name: 'bell' },
  { icon: Calendar, name: 'calendar' },
  { icon: Clock, name: 'clock' },
  { icon: Cloud, name: 'cloud' },
  { icon: Heart, name: 'heart' },
  { icon: Star, name: 'star' },
  { icon: Bookmark, name: 'bookmark' },
  { icon: Tag, name: 'tag' },
  { icon: Lock, name: 'lock' },
  { icon: Unlock, name: 'unlock' },
  { icon: Eye, name: 'eye' },
  { icon: LinkIcon, name: 'link' },
  { icon: Cpu, name: 'cpu' },
  { icon: Activity, name: 'activity' },
  { icon: BarChart, name: 'bar-chart' },
  { icon: PieChart, name: 'pie-chart' },
  { icon: TrendingUp, name: 'trending-up' },
  { icon: Filter, name: 'filter' },
  { icon: Layers, name: 'layers' },
  { icon: Grid, name: 'grid' },
  { icon: List, name: 'list' },
];

// Icon button size: 3.5 icon + 1.5*2 padding = ~28px, plus 4px gap
const ICON_BUTTON_SIZE = 32;

const SUGGESTED_TAGS = [
  'ai', 'llm', 'chat', 'search', 'transform', 'data', 'api', 'tool', 'utility', 'custom'
];

const STEP_TYPES = [
  { type: 'neuron', label: 'Neuron', description: 'Call an LLM', icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
  { type: 'tool', label: 'Tool', description: 'Execute a tool', icon: Wrench, color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  { type: 'transform', label: 'Transform', description: 'Transform data', icon: Shuffle, color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' },
  { type: 'conditional', label: 'Conditional', description: 'Branch logic', icon: GitBranch, color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
  { type: 'loop', label: 'Loop', description: 'Iterate over items', icon: Repeat, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20 border-cyan-500/30' },
] as const;

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

export default function EditNodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [neurons, setNeurons] = useState<NeuronInfo[]>([]);
  const [notEditable, setNotEditable] = useState(false);
  
  // Node metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [icon, setIcon] = useState('brain');
  const [color, setColor] = useState('#a855f7');
  const [inputs, setInputs] = useState<string[]>(['state']);
  const [outputs, setOutputs] = useState<string[]>(['state']);
  const [inputValue, setInputValue] = useState('');
  const [outputValue, setOutputValue] = useState('');
  
  // Steps
  const [steps, setSteps] = useState<StepConfig[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([0]));
  const [showAddStep, setShowAddStep] = useState(false);
  const [showAllIcons, setShowAllIcons] = useState(false);
  const [visibleIconCount, setVisibleIconCount] = useState(8);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const iconContainerRef = useRef<HTMLDivElement>(null);
  
  // Parameters
  const [parameters, setParameters] = useState<Record<string, ParameterDefinition>>({});
  const [showAddParameter, setShowAddParameter] = useState(false);
  const [newParamName, setNewParamName] = useState('');
  const [expandedParams, setExpandedParams] = useState<Set<string>>(new Set());

  // Calculate how many icons fit in the container
  useEffect(() => {
    const calculateVisibleIcons = () => {
      if (iconContainerRef.current) {
        const containerWidth = iconContainerRef.current.offsetWidth;
        // Account for padding (1.5 * 4px * 2 = 12px) and the "more" button
        const availableWidth = containerWidth - 12 - ICON_BUTTON_SIZE;
        const count = Math.max(4, Math.floor(availableWidth / ICON_BUTTON_SIZE));
        // Don't show more button if all icons fit
        setVisibleIconCount(Math.min(count, ICON_OPTIONS.length));
      }
    };

    calculateVisibleIcons();
    window.addEventListener('resize', calculateVisibleIcons);
    return () => window.removeEventListener('resize', calculateVisibleIcons);
  }, []);

  // Fetch existing node data
  useEffect(() => {
    async function fetchNode() {
      try {
        const response = await fetch(`/api/v1/nodes/${nodeId}`);
        if (!response.ok) {
          throw new Error('Node not found');
        }
        const data: NodeData = await response.json();
        
        // Check if editable
        if (data.isSystem || data.isImmutable || !data.isOwned) {
          setNotEditable(true);
          setError('This node cannot be edited. Fork it to create your own copy.');
        }
        
        // Set all form fields with proper defaults
        setName(data.name || '');
        setDescription(data.description || '');
        setTags(data.tags || []);
        
        // Ensure metadata exists and has defaults
        const metadata = data.metadata || {};
        setIcon(metadata.icon || 'brain');
        setColor(metadata.color || '#a855f7');
        // Inputs and outputs can be at top level or in metadata
        const nodeInputs = data.inputs || metadata.inputs || ['state'];
        const nodeOutputs = data.outputs || metadata.outputs || ['state'];
        setInputs(Array.isArray(nodeInputs) && nodeInputs.length > 0 ? nodeInputs : ['state']);
        setOutputs(Array.isArray(nodeOutputs) && nodeOutputs.length > 0 ? nodeOutputs : ['state']);
        
        // Use fullConfig for actual step configs (steps only contains schema info)
        // The API returns:
        // - steps: Array of { stepIndex, type, configurable } (schema only)
        // - fullConfig: Array of { type, config } (actual step configs with values)
        const rawSteps = (data as unknown as { fullConfig?: StepConfig[] }).fullConfig || data.steps || [];
        const normalizedSteps = rawSteps.map((step: StepConfig) => ({
          type: step.type,
          config: step.config || DEFAULT_STEP_CONFIGS[step.type] || {},
        }));
        setSteps(normalizedSteps);
        
        // Load parameters
        setParameters(data.parameters || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load node');
      } finally {
        setLoading(false);
      }
    }
    fetchNode();
  }, [nodeId]);

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

  const addTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const addInput = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !inputs.includes(trimmed)) {
      setInputs([...inputs, trimmed]);
    }
    setInputValue('');
  };

  const removeInput = (input: string) => {
    if (input !== 'state') setInputs(inputs.filter((i) => i !== input));
  };

  const addOutput = () => {
    const trimmed = outputValue.trim();
    if (trimmed && !outputs.includes(trimmed)) {
      setOutputs([...outputs, trimmed]);
    }
    setOutputValue('');
  };

  const removeOutput = (output: string) => {
    if (output !== 'state') setOutputs(outputs.filter((o) => o !== output));
  };

  // Parameter management
  const addParameter = () => {
    const key = newParamName.trim().replace(/\s+/g, '_').toLowerCase();
    if (!key || parameters[key]) return;
    
    setParameters({
      ...parameters,
      [key]: {
        type: 'string',
        default: '',
        description: '',
      },
    });
    setExpandedParams((prev) => new Set([...prev, key]));
    setNewParamName('');
    setShowAddParameter(false);
  };

  const removeParameter = (key: string) => {
    const { [key]: _, ...rest } = parameters;
    setParameters(rest);
    setExpandedParams((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  const updateParameter = (key: string, updates: Partial<ParameterDefinition>) => {
    setParameters((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...updates },
    }));
  };

  const toggleParam = (key: string) => {
    setExpandedParams((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getDefaultForType = (type: ParameterDefinition['type']): unknown => {
    switch (type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'select': return '';
      case 'json': return {};
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
    if (steps.length === 0) {
      setError('At least one step is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/nodes/${nodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          tags,
          steps,
          parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
          metadata: {
            icon,
            color,
            inputs,
            outputs,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update node');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/studio/nodes');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update node');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg-primary">
        <Loader2 className="w-8 h-8 text-text-secondary animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-bg-primary">
      {/* Header */}
      <motion.div 
        className="flex-shrink-0 sticky top-0 z-10 bg-bg-elevated border-b border-border"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/studio/nodes"
              className="p-2 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Edit Node</h1>
              <p className="text-sm text-text-muted font-mono">{nodeId}</p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || success || notEditable}
            className="flex items-center gap-2 bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
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
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-text-primary">Basic Information</h2>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Node Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={notEditable}
                placeholder="e.g., Smart Responder"
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={notEditable}
                placeholder="Describe what this node does..."
                rows={2}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent resize-none disabled:opacity-50"
              />
            </div>

            {/* Icon & Color */}
            <div className="flex gap-4">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Icon
                </label>
                <div className="relative" ref={iconPickerRef}>
                  <div ref={iconContainerRef} className={`flex flex-wrap gap-1 p-1.5 bg-bg-primary border border-border rounded-lg ${notEditable ? 'opacity-50' : ''}`}>
                    {ICON_OPTIONS.slice(0, visibleIconCount).map(({ icon: IconComponent, name: iconName }) => (
                      <button
                        key={iconName}
                        onClick={() => !notEditable && setIcon(iconName)}
                        disabled={notEditable}
                        className={`p-1.5 rounded transition-colors ${
                          icon === iconName
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                        } disabled:cursor-not-allowed`}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </button>
                    ))}
                    {visibleIconCount < ICON_OPTIONS.length && (
                      <button
                        onClick={() => !notEditable && setShowAllIcons(!showAllIcons)}
                        disabled={notEditable}
                        className={`p-1.5 rounded transition-colors ${
                          showAllIcons
                            ? 'bg-accent text-white'
                            : 'bg-bg-secondary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                        } disabled:cursor-not-allowed disabled:opacity-50`}
                        title="Show more icons"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  
                  {/* Floating icon panel */}
                  <AnimatePresence>
                    {showAllIcons && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                        className="absolute z-50 top-full left-0 mt-1 w-64 p-2 bg-bg-secondary border border-border rounded-lg shadow-xl"
                      >
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-xs text-text-secondary">All Icons</span>
                          <button
                            onClick={() => setShowAllIcons(false)}
                            className="text-text-muted hover:text-text-primary"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-48 overflow-y-auto">
                          {ICON_OPTIONS.map(({ icon: IconComponent, name: iconName }) => (
                            <button
                              key={iconName}
                              onClick={() => {
                                setIcon(iconName);
                                setShowAllIcons(false);
                              }}
                              className={`p-1.5 rounded transition-colors ${
                                icon === iconName
                                  ? 'bg-accent text-white'
                                  : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                              }`}
                              title={iconName}
                            >
                              <IconComponent className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              
              <div className="flex-shrink-0">
                <label className="block text-sm font-medium text-text-secondary mb-1.5 text-center">
                  Color
                </label>
                <div className="flex justify-center">
                  <ColorPicker value={color} onChange={setColor} disabled={notEditable} />
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Tags
              </label>
              <div className={`flex flex-wrap gap-1.5 mb-2 ${notEditable ? 'opacity-50' : ''}`}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 bg-bg-tertiary text-text-secondary px-2 py-1 rounded text-xs"
                  >
                    {tag}
                    {!notEditable && (
                      <button onClick={() => removeTag(tag)} className="text-text-muted hover:text-text-primary">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!notEditable && (
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Add tag and press Enter..."
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              )}
              {tags.length === 0 && !notEditable && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {SUGGESTED_TAGS.slice(0, 5).map((tag) => (
                    <button
                      key={tag}
                      onClick={() => addTag(tag)}
                      className="text-xs px-1.5 py-0.5 text-text-disabled hover:text-text-secondary"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Inputs & Outputs */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Inputs
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {inputs.map((input) => (
                    <span
                      key={input}
                      className="inline-flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 text-blue-400 px-2 py-1 rounded-md text-xs"
                    >
                      {input}
                      {input !== 'state' && !notEditable && (
                        <button
                          onClick={() => removeInput(input)}
                          className="text-blue-400/60 hover:text-blue-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {!notEditable && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addInput();
                        }
                      }}
                      placeholder="Add input..."
                      className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={addInput}
                      disabled={!inputValue.trim()}
                      className="px-2 py-1.5 bg-bg-tertiary hover:bg-bg-active disabled:opacity-50 rounded-lg text-xs text-text-secondary"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Outputs
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {outputs.map((output) => (
                    <span
                      key={output}
                      className="inline-flex items-center gap-1 bg-green-500/20 border border-green-500/30 text-green-400 px-2 py-1 rounded-md text-xs"
                    >
                      {output}
                      {output !== 'state' && !notEditable && (
                        <button
                          onClick={() => removeOutput(output)}
                          className="text-green-400/60 hover:text-green-300"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {!notEditable && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={outputValue}
                      onChange={(e) => setOutputValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addOutput();
                        }
                      }}
                      placeholder="Add output..."
                      className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-green-500"
                    />
                    <button
                      onClick={addOutput}
                      disabled={!outputValue.trim()}
                      className="px-2 py-1.5 bg-bg-tertiary hover:bg-bg-active disabled:opacity-50 rounded-lg text-xs text-text-secondary"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

          </motion.section>

          {/* Parameters */}
          <motion.section 
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Parameters {Object.keys(parameters).length > 0 && <span className="text-text-muted">({Object.keys(parameters).length})</span>}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Expose configurable knobs that can be customized per-graph
                </p>
              </div>
              {!notEditable && (
                <button
                  onClick={() => setShowAddParameter(!showAddParameter)}
                  className="flex items-center gap-1.5 text-sm text-accent-text hover:text-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Parameter
                </button>
              )}
            </div>

            {/* Add Parameter Form */}
            {showAddParameter && !notEditable && (
              <div className="p-4 bg-bg-primary rounded-lg border border-border space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Parameter Name</label>
                  <input
                    type="text"
                    value={newParamName}
                    onChange={(e) => setNewParamName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addParameter();
                      }
                    }}
                    placeholder="e.g., temperature, maxTokens, model"
                    className="w-full bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                  />
                  <p className="text-xs text-text-disabled mt-1">
                    Use in step configs as <code className="bg-bg-tertiary px-1 rounded">{'{{parameters.name}}'}</code>
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddParameter(false)}
                    className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addParameter}
                    disabled={!newParamName.trim() || !!parameters[newParamName.trim().replace(/\s+/g, '_').toLowerCase()]}
                    className="px-3 py-1.5 text-sm bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg"
                  >
                    Add Parameter
                  </button>
                </div>
              </div>
            )}

            {/* Parameters List */}
            {Object.keys(parameters).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Settings className="w-10 h-10 text-text-disabled mb-3" />
                <p className="text-text-secondary text-sm">No parameters yet</p>
                <p className="text-text-disabled text-xs mt-1">
                  Parameters let users customize your node without editing step configs
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(parameters).map(([key, param]) => (
                  <div key={key} className="border border-border rounded-lg overflow-hidden bg-bg-elevated">
                    <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary border-b border-border">
                      <button
                        onClick={() => toggleParam(key)}
                        className="flex-1 flex items-center gap-2 text-left"
                      >
                        <span className="text-sm font-medium text-text-primary font-mono">{key}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">{param.type}</span>
                      </button>
                      {!notEditable && (
                        <button
                          onClick={() => removeParameter(key)}
                          className="p-1 text-text-disabled hover:text-red-400 transition-colors"
                          title="Remove parameter"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => toggleParam(key)} className="p-1 text-text-muted">
                        {expandedParams.has(key) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>

                    {expandedParams.has(key) && (
                      <div className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Type</label>
                            <div className="relative">
                              <select
                                value={param.type}
                                onChange={(e) => {
                                  const newType = e.target.value as ParameterDefinition['type'];
                                  updateParameter(key, {
                                    type: newType,
                                    default: getDefaultForType(newType),
                                    enum: newType === 'select' ? [] : null,
                                    min: newType === 'number' ? null : undefined,
                                    max: newType === 'number' ? null : undefined,
                                  });
                                }}
                                disabled={notEditable}
                                className="w-full appearance-none bg-bg-primary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                              >
                                {PARAMETER_TYPES.map((t) => (
                                  <option key={t.type} value={t.type}>{t.label} - {t.description}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Default Value</label>
                            {param.type === 'boolean' ? (
                              <button
                                type="button"
                                onClick={() => !notEditable && updateParameter(key, { default: !param.default })}
                                disabled={notEditable}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                                  param.default ? 'bg-accent' : 'bg-gray-700'
                                }`}
                              >
                                <span
                                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    param.default ? 'translate-x-6' : 'translate-x-1'
                                  }`}
                                />
                              </button>
                            ) : param.type === 'select' && param.enum && param.enum.length > 0 ? (
                              <div className="relative">
                                <select
                                  value={String(param.default || '')}
                                  onChange={(e) => updateParameter(key, { default: e.target.value })}
                                  disabled={notEditable}
                                  className="w-full appearance-none bg-bg-primary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                                >
                                  <option value="">Select default...</option>
                                  {param.enum.map((opt, i) => (
                                    <option key={i} value={String(opt)}>{String(opt)}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                              </div>
                            ) : param.type === 'number' ? (
                              <input
                                type="number"
                                value={param.default !== undefined ? Number(param.default) : 0}
                                onChange={(e) => updateParameter(key, { default: parseFloat(e.target.value) || 0 })}
                                min={param.min ?? undefined}
                                max={param.max ?? undefined}
                                step="any"
                                disabled={notEditable}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                              />
                            ) : param.type === 'json' ? (
                              <textarea
                                value={typeof param.default === 'string' ? param.default : JSON.stringify(param.default, null, 2)}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(e.target.value);
                                    updateParameter(key, { default: parsed });
                                  } catch {
                                    updateParameter(key, { default: e.target.value });
                                  }
                                }}
                                rows={2}
                                disabled={notEditable}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent font-mono text-xs resize-none disabled:opacity-50"
                                placeholder="{}"
                              />
                            ) : (
                              <input
                                type="text"
                                value={String(param.default || '')}
                                onChange={(e) => updateParameter(key, { default: e.target.value })}
                                disabled={notEditable}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                                placeholder="Default value"
                              />
                            )}
                          </div>
                        </div>

                        {param.type === 'number' && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-text-muted mb-1.5">Min (optional)</label>
                              <input
                                type="number"
                                value={param.min ?? ''}
                                onChange={(e) => updateParameter(key, { min: e.target.value ? parseFloat(e.target.value) : null })}
                                step="any"
                                disabled={notEditable}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                                placeholder="No minimum"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-muted mb-1.5">Max (optional)</label>
                              <input
                                type="number"
                                value={param.max ?? ''}
                                onChange={(e) => updateParameter(key, { max: e.target.value ? parseFloat(e.target.value) : null })}
                                step="any"
                                disabled={notEditable}
                                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                                placeholder="No maximum"
                              />
                            </div>
                          </div>
                        )}

                        {param.type === 'select' && (
                          <div>
                            <label className="block text-xs font-medium text-text-muted mb-1.5">Options (one per line)</label>
                            <textarea
                              value={(param.enum || []).join('\n')}
                              onChange={(e) => {
                                const options = e.target.value.split('\n').filter(Boolean);
                                updateParameter(key, { enum: options });
                              }}
                              rows={3}
                              disabled={notEditable}
                              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none disabled:opacity-50"
                              placeholder="option1&#10;option2&#10;option3"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-xs font-medium text-text-muted mb-1.5">Description</label>
                          <input
                            type="text"
                            value={param.description || ''}
                            onChange={(e) => updateParameter(key, { description: e.target.value })}
                            disabled={notEditable}
                            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                            placeholder="What does this parameter do?"
                          />
                        </div>

                        <div className="bg-bg-tertiary rounded-lg p-3 text-xs text-text-muted">
                          <p className="font-medium mb-1">Usage in step configs:</p>
                          <code className="text-accent">{'{{parameters.' + key + '}}'}</code>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Steps */}
          <motion.section 
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                Steps {steps.length > 0 && <span className="text-text-muted">({steps.length})</span>}
              </h2>
              {!notEditable && (
                <button
                  onClick={() => setShowAddStep(!showAddStep)}
                  className="flex items-center gap-1.5 text-sm text-accent-text hover:text-accent-hover transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Step
                </button>
              )}
            </div>

            {/* Add Step Panel */}
            {showAddStep && !notEditable && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 bg-bg-primary rounded-lg border border-border">
                {STEP_TYPES.map((stepType) => {
                  const Icon = stepType.icon;
                  return (
                    <button
                      key={stepType.type}
                      onClick={() => addStep(stepType.type)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-lg border ${stepType.bgColor} hover:bg-opacity-50 transition-colors`}
                    >
                      <Icon className={`w-5 h-5 ${stepType.color}`} />
                      <span className="text-xs font-medium text-text-secondary">{stepType.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Steps List */}
            {steps.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Info className="w-12 h-12 text-text-disabled mb-3" />
                <p className="text-text-secondary text-sm">No steps yet</p>
                <p className="text-text-disabled text-xs mt-1">Click &quot;Add Step&quot; to begin building your node</p>
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
                    disabled={notEditable}
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
            className="flex items-center justify-center gap-4 text-sm pb-scroll-safe"
            variants={staggerItemVariants}
          >
            <Link href="/studio/nodes" className="text-text-muted hover:text-text-secondary transition-colors">
              Back to Nodes
            </Link>
            <span className="text-gray-700">•</span>
            <Link href="/studio" className="text-text-muted hover:text-text-secondary transition-colors">
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
  disabled,
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
  disabled?: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onUpdate: (field: string, value: unknown) => void;
  onMove: (direction: 'up' | 'down') => void;
  neurons: NeuronInfo[];
}) {
  const stepInfo = STEP_TYPES.find((s) => s.type === step.type)!;
  const Icon = stepInfo.icon;
  const config = step.config || {};

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated">
      <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 bg-bg-primary border-b border-border">
        <button
          className="hidden sm:block p-1 text-text-disabled hover:text-text-secondary cursor-grab"
          title="Drag to reorder"
          disabled={disabled}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <span className="text-xs text-text-muted font-mono w-5 flex-shrink-0">{index + 1}</span>
        <div className={`p-1.5 rounded flex-shrink-0 ${stepInfo.bgColor}`}>
          <Icon className={`w-4 h-4 ${stepInfo.color}`} />
        </div>
        <button
          onClick={onToggle}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <span className="text-sm font-medium text-text-secondary truncate">{stepInfo.label}</span>
          <span className="hidden sm:inline text-xs text-text-disabled truncate">{stepInfo.description}</span>
        </button>
        <div className="flex items-center flex-shrink-0">
          <button
            onClick={() => onMove('up')}
            disabled={index === 0 || disabled}
            className="p-1 text-text-disabled hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move up"
          >
            <ChevronDown className="w-4 h-4 rotate-180" />
          </button>
          <button
            onClick={() => onMove('down')}
            disabled={index === total - 1 || disabled}
            className="p-1 text-text-disabled hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move down"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={onRemove}
            disabled={disabled}
            className="p-1 text-text-disabled hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Remove step"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={onToggle} className="p-1 text-text-muted">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {step.type === 'neuron' && (
            <>
              <Field label="Neuron">
                <div className="relative">
                  <select
                    value={String(config.neuronId || '')}
                    onChange={(e) => onUpdate('neuronId', e.target.value)}
                    disabled={disabled}
                    className="w-full appearance-none bg-bg-primary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  >
                    <option value="">Select a neuron...</option>
                    {neurons.map((n) => (
                      <option key={n.neuronId} value={n.neuronId}>
                        {n.name} ({n.model})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                </div>
              </Field>
              <Field label="System Prompt">
                <SmartInput
                  value={String(config.systemPrompt || '')}
                  onChange={(val) => onUpdate('systemPrompt', val)}
                  rows={3}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
                  placeholder="Instructions for the AI..."
                />
              </Field>
              <Field label="User Prompt">
                <SmartInput
                  value={String(config.userPrompt || '')}
                  onChange={(val) => onUpdate('userPrompt', val)}
                  rows={2}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
                  placeholder="{{state.data.query.message}}"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Temperature">
                  <input
                    type="number"
                    value={config.temperature !== undefined ? Number(config.temperature) : 0.7}
                    onChange={(e) => onUpdate('temperature', parseFloat(e.target.value))}
                    disabled={disabled}
                    min={0}
                    max={1}
                    step={0.1}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </Field>
                <Field label="Max Tokens">
                  <input
                    type="number"
                    value={config.maxTokens !== undefined ? Number(config.maxTokens) : 4096}
                    onChange={(e) => onUpdate('maxTokens', parseInt(e.target.value))}
                    disabled={disabled}
                    min={100}
                    max={32000}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500 disabled:opacity-50"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Output Field">
                  <input
                    type="text"
                    value={String(config.outputField || '')}
                    onChange={(e) => onUpdate('outputField', e.target.value)}
                    disabled={disabled}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-purple-500 disabled:opacity-50"
                    placeholder="response"
                  />
                </Field>
                <Field label="Stream">
                  <div className="flex items-center h-full pt-1 gap-2">
                    <button
                      type="button"
                      onClick={() => !disabled && onUpdate('stream', !config.stream)}
                      disabled={disabled}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                        config.stream ? 'bg-purple-500' : 'bg-gray-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          config.stream ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-xs text-text-muted">
                      {config.stream ? 'To user' : 'Silent'}
                    </span>
                  </div>
                </Field>
              </div>
              <Field label="Structured Output">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      if (config.structuredOutput) {
                        onUpdate('structuredOutput', undefined);
                      } else {
                        onUpdate('structuredOutput', {
                          schema: { type: 'object', properties: {}, required: [] }
                        });
                      }
                    }}
                    disabled={disabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                      config.structuredOutput ? 'bg-purple-500' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        config.structuredOutput ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-xs text-text-muted">
                    {config.structuredOutput ? 'JSON Schema' : 'Freeform text'}
                  </span>
                </div>
                {Boolean(config.structuredOutput) && (
                  <textarea
                    value={
                      typeof config.structuredOutput === 'object'
                        ? JSON.stringify((config.structuredOutput as { schema?: unknown }).schema || config.structuredOutput, null, 2)
                        : ''
                    }
                    onChange={(e) => {
                      try {
                        const schema = JSON.parse(e.target.value);
                        onUpdate('structuredOutput', { schema });
                      } catch { /* Allow invalid JSON while typing */ }
                    }}
                    disabled={disabled}
                    rows={5}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-purple-500 resize-none font-mono disabled:opacity-50"
                    placeholder='{"type": "object", "properties": {...}}'
                  />
                )}
              </Field>
            </>
          )}

          {step.type === 'tool' && (
            <ToolStepEditorInline
              config={config}
              onUpdate={onUpdate}
              disabled={disabled ?? false}
            />
          )}

          {step.type === 'transform' && (
            <TransformStepEditorEdit config={config} onUpdate={onUpdate} disabled={disabled} />
          )}

          {step.type === 'conditional' && (
            <>
              <Field label="Condition">
                <SmartInput
                  value={String(config.condition || '')}
                  onChange={(val) => onUpdate('condition', val)}
                  singleLine
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-green-500 disabled:opacity-50"
                  placeholder="state.value > 0"
                />
              </Field>
              <Field label="Set Field">
                <SmartInput
                  value={String(config.setField || '')}
                  onChange={(val) => onUpdate('setField', val)}
                  singleLine
                  isOutput
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-green-500 disabled:opacity-50"
                  placeholder="result"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="True Value">
                  <SmartInput
                    value={String(config.trueValue || '')}
                    onChange={(val) => onUpdate('trueValue', val)}
                    singleLine
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-green-500 disabled:opacity-50"
                  />
                </Field>
                <Field label="False Value">
                  <SmartInput
                    value={String(config.falseValue || '')}
                    onChange={(val) => onUpdate('falseValue', val)}
                    singleLine
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-green-500 disabled:opacity-50"
                  />
                </Field>
              </div>
            </>
          )}

          {step.type === 'loop' && (
            <LoopStepEditorFull
              config={config}
              onUpdate={onUpdate}
              disabled={disabled}
            />
          )}

          {/* Parameter Hint */}
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-start gap-2 text-xs text-text-muted">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-text-secondary mb-1">Use parameters in your config</p>
                <p>Reference defined parameters with <code className="bg-bg-tertiary px-1 rounded text-accent">{'{{parameters.name}}'}</code></p>
                <p className="mt-1">Access state with <code className="bg-bg-tertiary px-1 rounded text-accent">{'{{state.field}}'}</code></p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Field wrapper
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// Tool Step Editor with schema display
function ToolStepEditorInline({
  config,
  onUpdate,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdate: (field: string, value: unknown) => void;
  disabled: boolean;
}) {
  const { tools } = useAvailableTools();
  const [showBrowser, setShowBrowser] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Find the selected tool's schema
  const selectedTool = tools.find(t => t.name === config.toolName);
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
  }, [config.toolName, hasSchema]);

  const handleSelectTool = (toolName: string) => {
    onUpdate('toolName', toolName);
    setShowBrowser(false);
    setSearchQuery('');
  };

  const updateMapping = (param: string, value: string) => {
    const newMappings = { ...inputMappings, [param]: value };
    setInputMappings(newMappings);
    onUpdate('parameters', newMappings);
  };

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Field label="Tool Name">
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={String(config.toolName || '')}
              onChange={(e) => onUpdate('toolName', e.target.value)}
              disabled={disabled}
              className="flex-1 bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-blue-500 disabled:opacity-50"
              placeholder="mcp-tool-name"
            />
            <button
              type="button"
              onClick={() => setShowBrowser(!showBrowser)}
              disabled={disabled}
              className="px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg hover:bg-bg-hover transition-colors text-accent disabled:opacity-50"
            >
              {showBrowser ? '×' : '...'}
            </button>
          </div>
          
          {/* Mini tool browser */}
          {showBrowser && (
            <div className="p-3 bg-bg-secondary border border-border rounded-lg space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredTools.slice(0, 10).map(tool => (
                  <div
                    key={`${tool.server}:${tool.name}`}
                    onClick={() => handleSelectTool(tool.name)}
                    className="p-2 bg-bg-primary rounded-lg hover:bg-bg-hover cursor-pointer border border-transparent hover:border-border"
                  >
                    <div className="font-mono text-sm text-accent-text">{tool.name}</div>
                    <div className="text-xs text-text-muted line-clamp-1">{tool.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Field>

      {/* Tool Parameters - show schema-based inputs when available */}
      {hasSchema ? (
        <Field label="Tool Parameters">
          <div className="space-y-3 p-3 bg-bg-secondary border border-border rounded-lg">
            {Object.entries(schemaProperties).map(([param, schema]) => {
              const isRequired = requiredParams.includes(param);
              const paramSchema = schema as { type?: string; description?: string; enum?: string[] };
              return (
                <div key={param} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-mono text-accent-text">
                      {param}
                      {isRequired && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    {paramSchema.type && (
                      <span className="text-xs text-text-disabled px-1.5 py-0.5 bg-bg-primary rounded">
                        {Array.isArray(paramSchema.type) ? paramSchema.type.join(' | ') : paramSchema.type}
                      </span>
                    )}
                  </div>
                  {paramSchema.description && (
                    <p className="text-xs text-text-muted leading-relaxed">{paramSchema.description}</p>
                  )}
                  {paramSchema.enum ? (
                    <div className="relative">
                      <select
                        value={inputMappings[param] || ''}
                        onChange={(e) => updateMapping(param, e.target.value)}
                        disabled={disabled}
                        className="w-full appearance-none bg-bg-primary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50"
                      >
                        <option value="">Select or use template...</option>
                        {paramSchema.enum.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={inputMappings[param] || ''}
                      onChange={(e) => updateMapping(param, e.target.value)}
                      disabled={disabled}
                      placeholder={`{{state.${param}}} or literal value`}
                      className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-disabled focus:outline-none focus:border-accent disabled:opacity-50"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-text-disabled">
            Use <code className="px-1 py-0.5 bg-bg-secondary rounded">{'{{state.field}}'}</code> to reference state
          </p>
        </Field>
      ) : (
        <p className="text-sm text-text-disabled italic">
          Select a tool above to configure its parameters
        </p>
      )}

      <Field label="Output Field">
        <input
          type="text"
          value={String(config.outputField || '')}
          onChange={(e) => onUpdate('outputField', e.target.value)}
          disabled={disabled}
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-blue-500 disabled:opacity-50"
          placeholder="toolResult"
        />
      </Field>
    </>
  );
}

// Full Transform Step Editor with all operations
const TRANSFORM_OPERATIONS_EDIT = [
  { value: 'set', label: 'set', description: 'Set a value (use globalState.namespace.key for persistence)' },
  { value: 'map', label: 'map', description: 'Transform each array item' },
  { value: 'filter', label: 'filter', description: 'Keep items matching condition' },
  { value: 'select', label: 'select', description: 'Extract nested property' },
  { value: 'json', label: 'json', description: 'Convert: string ↔ object/array' },
  { value: 'append', label: 'append', description: 'Add item to array' },
  { value: 'concat', label: 'concat', description: 'Concatenate two arrays' },
  { value: 'increment', label: 'increment', description: 'Add 1 (or custom amount) to number' },
  { value: 'decrement', label: 'decrement', description: 'Subtract 1 (or custom amount) from number' },
];

function TransformStepEditorEdit({
  config,
  onUpdate,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdate: (field: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const operation = String(config.operation || 'set');

  return (
    <>
      <Field label="Operation">
        <div className="relative">
          <select
            value={operation}
            onChange={(e) => onUpdate('operation', e.target.value)}
            disabled={disabled}
            className="w-full appearance-none bg-bg-primary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
          >
            {TRANSFORM_OPERATIONS_EDIT.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {TRANSFORM_OPERATIONS_EDIT.find(o => o.value === operation)?.description}
        </p>
      </Field>

      <Field label="Input Field">
        <SmartInput
          value={String(config.inputField || '')}
          onChange={(val) => onUpdate('inputField', val)}
          singleLine
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
          placeholder="state.data or globalState.namespace.key"
        />
      </Field>

      <Field label="Output Field">
        <SmartInput
          value={String(config.outputField || '')}
          onChange={(val) => onUpdate('outputField', val)}
          singleLine
          isOutput
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
          placeholder="data.result or globalState.namespace.key"
        />
      </Field>

      {['set', 'append'].includes(operation) && (
        <Field label="Value">
          <SmartInput
            value={String(config.value || '')}
            onChange={(val) => onUpdate('value', val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder="{{state.variable}}"
          />
        </Field>
      )}

      {['map', 'select'].includes(operation) && (
        <Field label={operation === 'map' ? 'Transform Template' : 'Property Path'}>
          <SmartInput
            value={String(config.transform || '')}
            onChange={(val) => onUpdate('transform', val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder={operation === 'map' ? '{{item.url}}' : 'results.items'}
          />
          {operation === 'map' && (
            <p className="mt-1 text-xs text-text-muted">
              Use <code className="px-1 bg-bg-tertiary rounded">{'{{item}}'}</code> and <code className="px-1 bg-bg-tertiary rounded">{'{{index}}'}</code>
            </p>
          )}
        </Field>
      )}

      {operation === 'filter' && (
        <Field label="Filter Condition">
          <SmartInput
            value={String(config.filterCondition || '')}
            onChange={(val) => onUpdate('filterCondition', val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder="{{item.score}} > 0.5"
          />
          <p className="mt-1 text-xs text-text-muted">
            Use <code className="px-1 bg-bg-tertiary rounded">{'{{item}}'}</code> for current element
          </p>
        </Field>
      )}

      {operation === 'append' && (
        <Field label="Condition (optional)">
          <SmartInput
            value={String(config.condition || '')}
            onChange={(val) => onUpdate('condition', val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder="{{state.shouldAppend}}"
          />
        </Field>
      )}

      {operation === 'concat' && (
        <Field label="Second Array Field">
          <SmartInput
            value={String(config.value || '')}
            onChange={(val) => onUpdate('value', val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder="state.otherArray"
          />
        </Field>
      )}

      {(operation === 'increment' || operation === 'decrement') && (
        <Field label={`${operation === 'increment' ? 'Increment' : 'Decrement'} Amount (optional)`}>
          <SmartInput
            value={String(config.value !== undefined ? config.value : '')}
            onChange={(val) => onUpdate('value', val === '' ? undefined : val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-amber-500 disabled:opacity-50"
            placeholder="1"
          />
          <p className="mt-1 text-xs text-text-muted">
            Leave empty for default (1). If inputField is undefined, initializes to 0.
          </p>
        </Field>
      )}
    </>
  );
}

// Nested step types available inside loops
const LOOP_NESTED_STEP_TYPES = [
  { type: 'neuron', label: 'Neuron', icon: Brain, color: 'text-purple-400', bgColor: 'bg-purple-500/20 border-purple-500/30' },
  { type: 'tool', label: 'Tool', icon: Wrench, color: 'text-blue-400', bgColor: 'bg-blue-500/20 border-blue-500/30' },
  { type: 'transform', label: 'Transform', icon: Shuffle, color: 'text-amber-400', bgColor: 'bg-amber-500/20 border-amber-500/30' },
  { type: 'conditional', label: 'Conditional', icon: GitBranch, color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' },
] as const;

// Full Loop Step Editor with nested steps
function LoopStepEditorFull({
  config,
  onUpdate,
  disabled,
}: {
  config: Record<string, unknown>;
  onUpdate: (field: string, value: unknown) => void;
  disabled?: boolean;
}) {
  const [showAddStep, setShowAddStep] = useState(false);
  const [expandedNestedSteps, setExpandedNestedSteps] = useState<Set<number>>(new Set());
  
  const nestedSteps = (config.steps as Array<{ type: string; config: Record<string, unknown> }>) || [];
  
  const addNestedStep = (type: string) => {
    if (disabled) return;
    const newStep = { type, config: {} };
    onUpdate('steps', [...nestedSteps, newStep]);
    setShowAddStep(false);
    setExpandedNestedSteps(prev => new Set([...prev, nestedSteps.length]));
  };
  
  const removeNestedStep = (index: number) => {
    if (disabled) return;
    const updated = nestedSteps.filter((_, i) => i !== index);
    onUpdate('steps', updated);
  };
  
  const updateNestedStepConfig = (index: number, field: string, value: unknown) => {
    const updated = nestedSteps.map((step, i) => {
      if (i !== index) return step;
      return { ...step, config: { ...step.config, [field]: value } };
    });
    onUpdate('steps', updated);
  };
  
  const toggleNestedStep = (index: number) => {
    setExpandedNestedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <>
      <Field label="Exit Condition">
        <SmartInput
          value={String(config.exitCondition || '')}
          onChange={(val) => onUpdate('exitCondition', val)}
          singleLine
          className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-50"
          placeholder="state.searchComplete === true"
        />
        <p className="mt-1 text-xs text-text-disabled">
          Loop exits when this evaluates to true. Use <code className="px-1 py-0.5 bg-bg-secondary rounded">state.loopIteration</code> for count.
        </p>
      </Field>
      
      <div className="grid grid-cols-2 gap-4">
        <Field label="Max Iterations">
          <input
            type="number"
            value={config.maxIterations !== undefined ? Number(config.maxIterations) : 5}
            onChange={(e) => onUpdate('maxIterations', parseInt(e.target.value) || 5)}
            disabled={disabled}
            min={1}
            max={100}
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
        </Field>
        <Field label="Accumulator Field (Optional)">
          <SmartInput
            value={String(config.accumulatorField || '')}
            onChange={(val) => onUpdate('accumulatorField', val)}
            singleLine
            className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            placeholder="result"
          />
        </Field>
      </div>
      
      {/* Nested Steps */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-text-muted">Loop Steps (run each iteration)</label>
          {!disabled && (
            <button
              onClick={() => setShowAddStep(!showAddStep)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-cyan-400 hover:text-cyan-300 bg-cyan-900/20 hover:bg-cyan-900/30 border border-cyan-500/30 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Step
            </button>
          )}
        </div>
        
        {showAddStep && !disabled && (
          <div className="mb-3 p-3 bg-bg-secondary border border-border rounded-lg">
            <p className="text-xs text-text-muted mb-2">Select step type:</p>
            <div className="grid grid-cols-2 gap-2">
              {LOOP_NESTED_STEP_TYPES.map((stepType) => {
                const Icon = stepType.icon;
                return (
                  <button
                    key={stepType.type}
                    onClick={() => addNestedStep(stepType.type)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border ${stepType.bgColor} hover:opacity-80 transition-opacity`}
                  >
                    <Icon className={`w-4 h-4 ${stepType.color}`} />
                    <span className="text-xs text-text-secondary">{stepType.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {nestedSteps.length === 0 ? (
          <div className="text-center py-6 text-xs text-text-disabled border border-dashed border-border rounded-lg">
            No steps yet. Add steps to run in each iteration.
          </div>
        ) : (
          <div className="space-y-2">
            {nestedSteps.map((nestedStep, idx) => {
              const typeInfo = LOOP_NESTED_STEP_TYPES.find(t => t.type === nestedStep.type) || 
                { icon: Info, color: 'text-text-secondary', bgColor: 'bg-gray-500/20 border-gray-500/30', label: nestedStep.type };
              const Icon = typeInfo.icon;
              const isExpanded = expandedNestedSteps.has(idx);
              
              return (
                <div key={idx} className={`border rounded-lg overflow-hidden ${typeInfo.bgColor}`}>
                  <div className="flex items-center gap-2 px-3 py-2 bg-bg-primary/50">
                    <span className="text-xs text-text-muted font-mono w-5">{idx + 1}</span>
                    <div className="p-1.5 rounded bg-bg-secondary">
                      <Icon className={`w-4 h-4 ${typeInfo.color}`} />
                    </div>
                    <button
                      onClick={() => toggleNestedStep(idx)}
                      className="flex-1 text-left text-sm text-text-secondary hover:text-text-primary"
                    >
                      {typeInfo.label}
                    </button>
                    {!disabled && (
                      <button
                        onClick={() => removeNestedStep(idx)}
                        className="p-1.5 text-text-disabled hover:text-red-400 transition-colors"
                        title="Remove step"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => toggleNestedStep(idx)} className="p-1.5 text-text-muted">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {isExpanded && (
                    <div className="p-3 bg-bg-primary space-y-3 border-t border-border">
                      <NestedStepConfigEdit
                        type={nestedStep.type}
                        config={nestedStep.config || {}}
                        onUpdate={(field, value) => updateNestedStepConfig(idx, field, value)}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// Nested step config editor for edit-node page
function NestedStepConfigEdit({
  type,
  config,
  onUpdate,
  disabled,
}: {
  type: string;
  config: Record<string, unknown>;
  onUpdate: (field: string, value: unknown) => void;
  disabled?: boolean;
}) {
  switch (type) {
    case 'neuron':
      return (
        <>
          <Field label="System Prompt">
            <SmartInput
              value={String(config.systemPrompt || '')}
              onChange={(val) => onUpdate('systemPrompt', val)}
              rows={2}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none disabled:opacity-50"
              placeholder="Instructions for the AI..."
            />
          </Field>
          <Field label="User Prompt">
            <SmartInput
              value={String(config.userPrompt || '')}
              onChange={(val) => onUpdate('userPrompt', val)}
              rows={2}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary resize-none disabled:opacity-50"
              placeholder="{{state.loopIteration}}: Process item..."
            />
          </Field>
          <Field label="Output Field">
            <input
              type="text"
              value={String(config.outputField || '')}
              onChange={(e) => onUpdate('outputField', e.target.value)}
              disabled={disabled}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
              placeholder="response"
            />
          </Field>
        </>
      );
      
    case 'tool':
      return (
        <>
          <Field label="Tool Name">
            <input
              type="text"
              value={String(config.toolName || '')}
              onChange={(e) => onUpdate('toolName', e.target.value)}
              disabled={disabled}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
              placeholder="web_search"
            />
          </Field>
          <Field label="Input Mapping (JSON)">
            <SmartInput
              value={typeof config.inputMapping === 'string' ? config.inputMapping : JSON.stringify(config.inputMapping || {}, null, 2)}
              onChange={(val) => {
                try { onUpdate('inputMapping', JSON.parse(val)); }
                catch { onUpdate('inputMapping', val); }
              }}
              rows={3}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono resize-none disabled:opacity-50"
              placeholder='{"query": "{{state.searchQuery}}"}'
            />
          </Field>
          <Field label="Output Field">
            <input
              type="text"
              value={String(config.outputField || '')}
              onChange={(e) => onUpdate('outputField', e.target.value)}
              disabled={disabled}
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
              placeholder="toolResult"
            />
          </Field>
        </>
      );
      
    case 'transform':
      return (
        <>
          <Field label="Operation">
            <div className="relative">
              <select
                value={String(config.operation || 'set')}
                onChange={(e) => onUpdate('operation', e.target.value)}
                disabled={disabled}
                className="w-full appearance-none bg-bg-primary border border-border rounded-lg px-3 py-2 pr-8 text-sm text-text-primary disabled:opacity-50"
              >
                {['set', 'map', 'filter', 'select', 'parse-json', 'append', 'concat'].map((op) => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Input Field">
              <SmartInput
                value={String(config.inputField || '')}
                onChange={(val) => onUpdate('inputField', val)}
                singleLine
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                placeholder="state.data"
              />
            </Field>
            <Field label="Output Field">
              <SmartInput
                value={String(config.outputField || '')}
                onChange={(val) => onUpdate('outputField', val)}
                singleLine
                isOutput
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                placeholder="result"
              />
            </Field>
          </div>
          {config.operation === 'set' && (
            <Field label="Value">
              <SmartInput
                value={String(config.value || '')}
                onChange={(val) => onUpdate('value', val)}
                singleLine
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                placeholder="{{state.item}}"
              />
            </Field>
          )}
        </>
      );
      
    case 'conditional':
      return (
        <>
          <Field label="Condition">
            <SmartInput
              value={String(config.condition || '')}
              onChange={(val) => onUpdate('condition', val)}
              singleLine
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono disabled:opacity-50"
              placeholder="state.value > 0"
            />
          </Field>
          <Field label="Set Field">
            <SmartInput
              value={String(config.setField || '')}
              onChange={(val) => onUpdate('setField', val)}
              singleLine
              isOutput
              className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
              placeholder="result"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="True Value">
              <SmartInput
                value={String(config.trueValue || '')}
                onChange={(val) => onUpdate('trueValue', val)}
                singleLine
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                placeholder="yes"
              />
            </Field>
            <Field label="False Value">
              <SmartInput
                value={String(config.falseValue || '')}
                onChange={(val) => onUpdate('falseValue', val)}
                singleLine
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2 text-sm text-text-primary disabled:opacity-50"
                placeholder="no"
              />
            </Field>
          </div>
        </>
      );
      
    default:
      return <p className="text-xs text-text-disabled">Unknown step type: {type}</p>;
  }
}
