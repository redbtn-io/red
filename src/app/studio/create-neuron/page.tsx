'use client';

import { useState } from 'react';
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
  Check,
  Eye,
  EyeOff,
  Info,
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

export default function CreateNeuronPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

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
      const response = await fetch('/api/v1/neurons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          provider,
          model: model.trim(),
          endpoint: endpoint.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          role,
          temperature,
          maxTokens,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create neuron');
      }

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

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3">
          <Link 
            href="/studio/neurons"
            className="p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-white">Create Neuron</h1>
            <p className="text-xs text-gray-500">Configure a new AI model</p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || success || !name.trim() || !model.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              Save Neuron
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
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-white">Basic Information</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Neuron Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Fast Chat Model"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
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
              <label className="block text-sm font-medium text-gray-400 mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this neuron is for..."
                rows={2}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444] resize-none"
              />
            </div>
          </motion.section>

          {/* Provider Selection */}
          <motion.section 
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-white">Provider</h2>
            
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              {PROVIDERS.map((p) => {
                const Icon = p.icon;
                const isSelected = provider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProvider(p.id);
                      setModel(''); // Reset model when changing provider
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#0a0a0a] border-[#ef4444]'
                        : 'bg-[#0a0a0a] border-[#2a2a2a] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${p.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: p.color }} />
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                      {p.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* Model Configuration */}
          <motion.section 
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-white">Model Configuration</h2>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Model <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === 'ollama' ? 'llama3.3:70b' : 'Model name'}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
                />
                {MODEL_SUGGESTIONS[provider]?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {MODEL_SUGGESTIONS[provider].slice(0, 4).map((m) => (
                      <button
                        key={m}
                        onClick={() => setModel(m)}
                        className="text-xs px-1.5 py-0.5 text-gray-600 hover:text-gray-400"
                      >
                        +{m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Endpoint {provider === 'ollama' && <span className="text-gray-600">(optional)</span>}
                </label>
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder={provider === 'ollama' ? 'http://localhost:11434' : 'API endpoint URL'}
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
                />
              </div>
            </div>

            {provider !== 'ollama' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 pr-10 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Leave blank to use system default key
                </p>
              </div>
            )}
          </motion.section>

          {/* Parameters */}
          <motion.section 
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4"
            variants={staggerItemVariants}
          >
            <h2 className="text-lg font-semibold text-white">Parameters</h2>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Temperature: {temperature}
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[#ef4444]"
                />
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>Precise (0)</span>
                  <span>Creative (2)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1.5">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 4096)}
                  min="256"
                  max="128000"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-[#ef4444]"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[1024, 2048, 4096, 8192, 16384].map((t) => (
                    <button
                      key={t}
                      onClick={() => setMaxTokens(t)}
                      className="text-xs px-1.5 py-0.5 text-gray-600 hover:text-gray-400"
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
              <p className="font-medium text-blue-300 mb-1">Custom neurons are private</p>
              <p>Only you can use this neuron. You can create up to 20 custom neurons. To share neurons, contact support.</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
