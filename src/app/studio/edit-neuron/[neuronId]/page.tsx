'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Save,
    Loader2,
    Brain,
    Server,
    Zap,
    MessageSquare,
    Wrench,
    Settings,
    AlertCircle,
    Check, Info
} from 'lucide-react';
import { pageVariants, staggerItemVariants } from '@/lib/animations';

const PROVIDERS = [
  { id: 'ollama', name: 'Ollama', description: 'Local LLM server', icon: Server, color: '#10B981' },
  { id: 'openai', name: 'OpenAI', description: 'GPT models', icon: Zap, color: '#10A37F' },
  { id: 'anthropic', name: 'Anthropic', description: 'Claude models', icon: Brain, color: '#D97706' },
  { id: 'google', name: 'Google', description: 'Gemini models', icon: Zap, color: '#4285F4' },
  { id: 'custom', name: 'Custom', description: 'Custom endpoint', icon: Settings, color: '#8B5CF6' },
];

const ROLES = [
  { id: 'chat', name: 'Chat', description: 'Conversational AI for user interactions', icon: MessageSquare },
  { id: 'worker', name: 'Worker', description: 'Background processing and analysis', icon: Zap },
  { id: 'specialist', name: 'Specialist', description: 'Domain-specific expertise', icon: Wrench },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  ollama: ['llama3.3:70b', 'llama3.2:3b', 'qwen2.5:32b', 'deepseek-r1:32b', 'mistral:7b', 'codellama:13b'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini'],
  anthropic: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307', 'claude-3-opus-20240229'],
  google: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  custom: [],
};

export default function EditNeuronPage({ params }: { params: Promise<{ neuronId: string }> }) {
  const { neuronId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [notEditable, setNotEditable] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState('ollama');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [role, setRole] = useState('chat');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  // Load neuron data
  useEffect(() => {
    async function loadNeuron() {
      try {
        const response = await fetch(`/api/v1/neurons/${neuronId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to load neuron');
        }

        const data = await response.json();
        const neuron = data.neuron;

        // Check if editable
        const isSystem = neuron.isSystem || neuron.userId === 'system';
        const canEdit = neuron.isOwned && !isSystem && !neuron.isImmutable;
        
        if (!canEdit) {
          setNotEditable(true);
          setError('This neuron is not editable. System and immutable neurons can be forked instead.');
        }

        // Populate form
        setName(neuron.name || '');
        setDescription(neuron.description || '');
        setProvider(neuron.provider || 'ollama');
        setModel(neuron.model || '');
        setEndpoint(neuron.endpoint || '');
        setRole(neuron.role || 'chat');
        setTemperature(neuron.temperature ?? 0.7);
        setMaxTokens(neuron.maxTokens ?? 4096);
        // Note: apiKey is not returned for security reasons

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load neuron');
      } finally {
        setLoading(false);
      }
    }

    loadNeuron();
  }, [neuronId]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!model.trim()) {
      setError('Model is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/v1/neurons/${neuronId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          temperature,
          maxTokens,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update neuron');
      }

      const result = await response.json();
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/studio/neurons');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save neuron');
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = PROVIDERS.find(p => p.id === provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-primary">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto mb-2" />
          <p className="text-sm text-text-secondary">Loading neuron...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-bg-primary overflow-hidden">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-primary/80 backdrop-blur-sm sticky top-0 z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Link 
            href="/studio/neurons"
            className="p-2 hover:bg-bg-secondary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-text-secondary" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Edit Neuron</h1>
            <p className="text-xs text-text-muted">Update neuron configuration</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || success || !name.trim() || !model.trim() || notEditable}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : success ? (
            <>
              <Check className="w-4 h-4" />
              Updated!
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
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
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Neuron Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={notEditable}
                  placeholder="e.g., Fast Chat Model"
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={true}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {ROLES.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} - {r.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={notEditable}
                placeholder="Describe what this neuron is for..."
                rows={2}
                className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </motion.section>

          {/* Provider Display (Read-only) */}
          <motion.section 
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-text-primary">Provider</h2>
            
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              {PROVIDERS.map((p) => {
                const Icon = p.icon;
                const isSelected = provider === p.id;
                return (
                  <div
                    key={p.id}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border ${
                      isSelected
                        ? 'bg-bg-primary border-accent'
                        : 'bg-bg-primary border-border opacity-50'
                    }`}
                  >
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${p.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>
                      {p.name}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-text-disabled flex items-center gap-1">
              <Info className="w-3 h-3" />
              Provider and model cannot be changed after creation
            </p>
          </motion.section>

          {/* Model Configuration (Read-only) */}
          <motion.section 
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-text-primary">Model Configuration</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Model <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={model}
                  disabled={true}
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Endpoint
                </label>
                <input
                  type="text"
                  value={endpoint}
                  disabled={true}
                  placeholder="Default endpoint"
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {provider !== 'ollama' && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value="••••••••••••••••"
                    disabled={true}
                    className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-text-disabled mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  API keys cannot be viewed or changed after creation
                </p>
              </div>
            )}
          </motion.section>

          {/* Parameters (Editable) */}
          <motion.section 
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-text-primary">Parameters</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  disabled={notEditable}
                  className="w-full accent-accent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-xs text-text-disabled mt-1">
                  <span>Precise (0)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                  disabled={notEditable}
                  min="256"
                  max="128000"
                  className="w-full bg-bg-primary border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[1024, 2048, 4096, 8192, 16384].map((t) => (
                    <button
                      key={t}
                      onClick={() => setMaxTokens(t)}
                      disabled={notEditable}
                      className="text-xs px-1.5 py-0.5 text-text-disabled hover:text-text-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t >= 1000 ? `${t/1000}k` : t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* Info Box */}
          <motion.div 
            className="flex items-start gap-3 bg-blue-900/10 border border-blue-500/20 rounded-lg px-4 py-3"
            variants={staggerItemVariants}
          >
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300/80">
              <p className="font-medium text-blue-300 mb-1">Editing limitations</p>
              <p>You can only edit the name, description, temperature, and max tokens. Provider, model, and API credentials cannot be changed after creation.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
