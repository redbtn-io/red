'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Brain, 
  Loader2, 
  AlertCircle,
  Plus,
  Server,
  Zap,
  MessageSquare,
  Wrench,
  Star,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Settings,
  LucideProps,
} from 'lucide-react';
import { pageVariants, staggerContainerVariants, staggerItemVariants, scaleVariants } from '@/lib/animations';

interface NeuronInfo {
  neuronId: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  role: string;
  tier: number;
  isSystem: boolean;
  isDefault: boolean;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  0: { label: 'Admin', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  1: { label: 'Ultimate', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  2: { label: 'Advanced', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  3: { label: 'Basic', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  4: { label: 'Free', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const PROVIDER_INFO: Record<string, { label: string; color: string; icon: React.ComponentType<LucideProps> }> = {
  ollama: { label: 'Ollama', color: '#10B981', icon: Server },
  openai: { label: 'OpenAI', color: '#10A37F', icon: Zap },
  anthropic: { label: 'Anthropic', color: '#D97706', icon: Brain },
  google: { label: 'Google', color: '#4285F4', icon: Zap },
  custom: { label: 'Custom', color: '#8B5CF6', icon: Settings },
};

const ROLE_INFO: Record<string, { label: string; description: string; icon: React.ComponentType<LucideProps> }> = {
  chat: { label: 'Chat', description: 'Conversational AI for user interactions', icon: MessageSquare },
  worker: { label: 'Worker', description: 'Background processing and analysis', icon: Zap },
  specialist: { label: 'Specialist', description: 'Domain-specific expertise', icon: Wrench },
};

export default function NeuronsPage() {
  const [neurons, setNeurons] = useState<NeuronInfo[]>([]);
  const [grouped, setGrouped] = useState<Record<string, NeuronInfo[]>>({});
  const [defaults, setDefaults] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [selectedNeuron, setSelectedNeuron] = useState<NeuronInfo | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNeurons() {
      try {
        const response = await fetch('/api/v1/neurons');
        if (!response.ok) throw new Error('Failed to fetch neurons');
        const data = await response.json();
        setNeurons(data.neurons || []);
        setGrouped(data.grouped || {});
        setDefaults(data.defaults || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load neurons');
      } finally {
        setLoading(false);
      }
    }
    fetchNeurons();
  }, []);

  // Filter neurons
  const filteredNeurons = neurons.filter((n) => {
    if (roleFilter && n.role !== roleFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      n.name.toLowerCase().includes(query) ||
      n.description?.toLowerCase().includes(query) ||
      n.model.toLowerCase().includes(query) ||
      n.provider.toLowerCase().includes(query)
    );
  });

  // Group by role
  const displayGroups = roleFilter 
    ? { [roleFilter]: filteredNeurons }
    : Object.entries(grouped).reduce((acc, [role, roleNeurons]) => {
        const filtered = roleNeurons.filter(n => 
          !searchQuery || 
          n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.model.toLowerCase().includes(searchQuery.toLowerCase())
        );
        if (filtered.length > 0) acc[role] = filtered;
        return acc;
      }, {} as Record<string, NeuronInfo[]>);

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
      {/* Neuron List */}
      <div className="flex-1 space-y-6">
        {/* Header */}
        <motion.div 
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          variants={staggerItemVariants}
        >
          <div>
            <h2 className="text-2xl font-bold text-white">Neurons</h2>
            <p className="text-gray-400 text-sm mt-1">
              AI models that power your workflows
            </p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors font-medium text-sm">
            <Plus className="w-4 h-4" />
            Add Neuron
          </button>
        </motion.div>

        {/* Search & Filter */}
        <motion.div className="flex flex-col sm:flex-row gap-3" variants={staggerItemVariants}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search neurons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ef4444]"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setRoleFilter(null)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !roleFilter
                  ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30'
                  : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a]'
              }`}
            >
              All
            </button>
            {Object.entries(ROLE_INFO).map(([role, info]) => (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? null : role)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  roleFilter === role
                    ? 'bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/30'
                    : 'bg-[#1a1a1a] text-gray-400 border border-[#2a2a2a] hover:text-white hover:border-[#3a3a3a]'
                }`}
              >
                {info.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Groups */}
        <motion.div 
          className="space-y-6"
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
        >
          {Object.entries(displayGroups).map(([role, roleNeurons]) => {
            const roleInfo = ROLE_INFO[role] || { label: role, description: '', icon: Brain };
            const RoleIcon = roleInfo.icon;
            const defaultNeuronId = defaults[role];

            return (
              <motion.section key={role} variants={staggerItemVariants}>
                <div className="flex items-center gap-3 mb-4">
                  <RoleIcon className="w-5 h-5 text-[#ef4444]" />
                  <div>
                    <h3 className="font-semibold text-white">{roleInfo.label}</h3>
                    <p className="text-xs text-gray-500">{roleInfo.description}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {roleNeurons.map((neuron) => (
                    <NeuronCard
                      key={neuron.neuronId}
                      neuron={neuron}
                      isDefault={neuron.neuronId === defaultNeuronId}
                      isSelected={selectedNeuron?.neuronId === neuron.neuronId}
                      onSelect={() => setSelectedNeuron(neuron)}
                      openMenuId={openMenuId}
                      onMenuToggle={setOpenMenuId}
                    />
                  ))}
                </div>
              </motion.section>
            );
          })}
        </motion.div>

        {/* Empty State */}
        {Object.keys(displayGroups).length === 0 && (
          <motion.div 
            className="flex flex-col items-center justify-center py-16 text-center"
            variants={scaleVariants}
          >
            <Brain className="w-16 h-16 text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No neurons found</h3>
            <p className="text-gray-500 text-sm">
              {searchQuery ? 'Try a different search term' : 'Add your first custom neuron'}
            </p>
          </motion.div>
        )}
      </div>

      {/* Detail Panel */}
      <AnimatePresence mode="wait">
        <motion.div 
          key={selectedNeuron?.neuronId || 'empty'}
          className="lg:w-80 xl:w-96"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
        >
          {selectedNeuron ? (
            <NeuronDetail neuron={selectedNeuron} onClose={() => setSelectedNeuron(null)} />
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-center sticky top-20">
              <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a neuron to view details</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

function NeuronCard({ 
  neuron, 
  isDefault,
  isSelected,
  onSelect,
  openMenuId,
  onMenuToggle,
}: { 
  neuron: NeuronInfo;
  isDefault: boolean;
  isSelected: boolean;
  onSelect: () => void;
  openMenuId: string | null;
  onMenuToggle: (id: string | null) => void;
}) {
  const providerInfo = PROVIDER_INFO[neuron.provider] || PROVIDER_INFO.custom;
  const ProviderIcon = providerInfo.icon;
  const tierInfo = TIER_LABELS[neuron.tier] || TIER_LABELS[4];
  const isMenuOpen = openMenuId === neuron.neuronId;

  return (
    <div 
      onClick={onSelect}
      className={`bg-[#1a1a1a] border rounded-xl p-4 cursor-pointer transition-all ${
        isSelected 
          ? 'border-[#ef4444] ring-1 ring-[#ef4444]/30' 
          : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${providerInfo.color}20` }}
          >
            <ProviderIcon className="w-5 h-5" color={providerInfo.color} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-white">{neuron.name}</h4>
              {isDefault && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
            </div>
            <p className="text-xs text-gray-500">{providerInfo.label}</p>
          </div>
        </div>

        {/* Menu */}
        {!neuron.isSystem && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMenuToggle(isMenuOpen ? null : neuron.neuronId);
              }}
              className="p-1.5 rounded-lg hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={(e) => { e.stopPropagation(); onMenuToggle(null); }} 
                />
                <div className="absolute right-0 top-full mt-1 w-40 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 py-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white">
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white">
                    <Copy className="w-4 h-4" />
                    Duplicate
                  </button>
                  <hr className="my-1 border-[#2a2a2a]" />
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Model */}
      <div className="mb-3">
        <code className="text-xs bg-[#2a2a2a] text-gray-300 px-2 py-1 rounded font-mono">
          {neuron.model}
        </code>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${tierInfo.color}`}>
          {tierInfo.label}
        </span>
        {neuron.isSystem && (
          <span className="text-[10px] text-gray-500">System</span>
        )}
      </div>
    </div>
  );
}

function NeuronDetail({ neuron, onClose }: { neuron: NeuronInfo; onClose: () => void }) {
  const providerInfo = PROVIDER_INFO[neuron.provider] || PROVIDER_INFO.custom;
  const ProviderIcon = providerInfo.icon;
  const roleInfo = ROLE_INFO[neuron.role] || ROLE_INFO.chat;
  const tierInfo = TIER_LABELS[neuron.tier] || TIER_LABELS[4];

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden sticky top-20">
      {/* Header */}
      <div 
        className="p-6 border-b border-[#2a2a2a]"
        style={{ backgroundColor: `${providerInfo.color}10` }}
      >
        <div className="flex items-start justify-between">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${providerInfo.color}20` }}
          >
            <ProviderIcon className="w-7 h-7" color={providerInfo.color} />
          </div>
          <span className={`text-xs font-medium px-2 py-1 rounded border ${tierInfo.color}`}>
            {tierInfo.label}
          </span>
        </div>
        <h3 className="text-xl font-bold text-white mt-4">{neuron.name}</h3>
        <p className="text-sm text-gray-400 mt-1">{providerInfo.label} • {roleInfo.label}</p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-5">
        {/* Description */}
        {neuron.description && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Description
            </h4>
            <p className="text-sm text-gray-300">{neuron.description}</p>
          </div>
        )}

        {/* Model */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Model
          </h4>
          <code className="text-sm bg-[#2a2a2a] text-gray-300 px-3 py-2 rounded-lg font-mono block">
            {neuron.model}
          </code>
        </div>

        {/* Provider */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Provider
          </h4>
          <div className="flex items-center gap-2">
            <ProviderIcon className="w-4 h-4" color={providerInfo.color} />
            <span className="text-sm text-gray-300">{providerInfo.label}</span>
          </div>
        </div>

        {/* Role */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Role
          </h4>
          <div>
            <span className="text-sm text-gray-300">{roleInfo.label}</span>
            <p className="text-xs text-gray-500 mt-1">{roleInfo.description}</p>
          </div>
        </div>

        {/* Neuron ID */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Neuron ID
          </h4>
          <code className="text-xs bg-[#2a2a2a] text-gray-300 px-2 py-1 rounded font-mono break-all">
            {neuron.neuronId}
          </code>
        </div>

        {/* System Badge */}
        {neuron.isSystem && (
          <div className="pt-4 border-t border-[#2a2a2a]">
            <span className="text-xs text-gray-500 bg-[#2a2a2a] px-2 py-1 rounded">
              System Neuron — Cannot be modified
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
