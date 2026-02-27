'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft,
    Search,
    Wrench,
    Globe,
    Database,
    MessageSquare,
    Terminal,
    ChevronDown,
    ChevronRight,
    Plus,
    Edit2,
    Trash2,
    Copy,
    Check,
    X,
    Loader2,
    AlertCircle,
    Sparkles,
    Package,
    FolderOpen,
    Info,
    Grid,
    List,
    Server,
    Zap,
    Star,
    Eye,
} from 'lucide-react';
import { useAvailableTools, type ToolInfo } from '@/hooks/useAvailableTools';
import { useToolSets, type ToolSet, type CreateToolSetData } from '@/hooks/useToolSets';
import { useFavoriteTools, getToolId } from '@/hooks/useFavoriteTools';
import { pageVariants, fadeUpVariants } from '@/lib/animations';
import { ConfirmModal } from '@/components/ui/Modal';

// Server icon mapping
const SERVER_ICONS: Record<string, React.ReactNode> = {
  web: <Globe className="w-5 h-5" />,
  context: <MessageSquare className="w-5 h-5" />,
  rag: <Database className="w-5 h-5" />,
  system: <Terminal className="w-5 h-5" />,
};

const SERVER_COLORS: Record<string, string> = {
  web: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  context: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  rag: 'bg-green-500/20 text-green-400 border-green-500/30',
  system: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

type ViewMode = 'grid' | 'list';
type Tab = 'browse' | 'sets';
type SourceFilter = 'all' | 'global' | 'custom' | 'favorites';

interface ToolCardProps {
  tool: ToolInfo;
  selected?: boolean;
  onSelect?: () => void;
  onViewDetails?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  viewMode: ViewMode;
  showSource?: boolean;
}

function ToolCard({ tool, selected, onSelect, onViewDetails, onToggleFavorite, isFavorite, viewMode, showSource = true }: ToolCardProps) {
  const [copied, setCopied] = useState(false);
  const isCustom = tool.source === 'custom';
  const serverColor = isCustom 
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : (SERVER_COLORS[tool.server] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');
  const ServerIcon = isCustom 
    ? <Server className="w-5 h-5" />
    : (SERVER_ICONS[tool.server] || <Wrench className="w-5 h-5" />);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(tool.name);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        variants={fadeUpVariants}
        className={`flex items-center gap-4 p-4 rounded-lg border transition-all cursor-pointer ${
          selected
            ? 'bg-accent/10 border-accent'
            : 'bg-bg-secondary border-border hover:border-border-hover hover:bg-bg-tertiary'
        }`}
        onClick={onSelect}
      >
        <div className={`p-2 rounded-lg border ${serverColor}`}>
          {ServerIcon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-accent-text">{tool.name}</span>
            <span className="px-2 py-0.5 text-xs rounded-full bg-bg-tertiary text-text-muted">
              {tool.server}
            </span>
            {showSource && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                isCustom 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}>
                {isCustom ? 'Custom' : 'Global'}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary mt-1 line-clamp-1">{tool.description}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
            className={`p-2 rounded-lg transition-colors ${
              isFavorite 
                ? 'text-yellow-400 hover:bg-yellow-500/20' 
                : 'text-text-muted hover:bg-bg-elevated hover:text-yellow-400'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 rounded-lg transition-colors text-accent border border-accent/30"
            title="View tool details"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Details</span>
          </button>
          <button
            onClick={handleCopy}
            className="p-2 hover:bg-bg-elevated rounded-lg transition-colors text-text-muted hover:text-text-primary"
            title="Copy tool name"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeUpVariants}
      className={`h-full flex flex-col p-4 rounded-xl border transition-all cursor-pointer ${
        selected
          ? 'bg-accent/10 border-accent'
          : 'bg-bg-secondary border-border hover:border-border-hover hover:bg-bg-tertiary'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg border ${serverColor}`}>
          {ServerIcon}
        </div>
        <div className="flex items-center gap-1">
          {showSource && (
            <span className={`px-1.5 py-0.5 text-[10px] rounded ${
              isCustom 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {isCustom ? 'Custom' : 'Global'}
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
            className={`p-1.5 rounded-lg transition-colors ${
              isFavorite 
                ? 'text-yellow-400 hover:bg-yellow-500/20' 
                : 'text-text-muted hover:bg-bg-elevated hover:text-yellow-400'
            }`}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
      <h3 className="font-mono text-sm text-accent-text mb-1 truncate">{tool.name}</h3>
      <p className="flex-1 text-xs text-text-secondary line-clamp-3 overflow-hidden">{tool.description}</p>
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
        <span className="px-2 py-0.5 text-xs rounded-full bg-bg-tertiary text-text-muted">
          {tool.server}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
          className="flex items-center gap-1 px-2 py-1 bg-accent/10 hover:bg-accent/20 rounded transition-colors text-accent text-xs border border-accent/30"
          title="View tool details"
        >
          <Eye className="w-3 h-3" />
          <span>Details</span>
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Tool Detail Modal - Shows full tool information including schema
 */
interface ToolDetailModalProps {
  tool: ToolInfo | null;
  isOpen: boolean;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

function ToolDetailModal({ tool, isOpen, onClose, isFavorite, onToggleFavorite }: ToolDetailModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !tool) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCustom = tool.source === 'custom';
  const serverColor = isCustom 
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : (SERVER_COLORS[tool.server] || 'bg-gray-500/20 text-gray-400 border-gray-500/30');
  const ServerIcon = isCustom 
    ? <Server className="w-6 h-6" />
    : (SERVER_ICONS[tool.server] || <Wrench className="w-6 h-6" />);

  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];
  const paramCount = Object.keys(properties).length;

  // Helper to render property type
  const renderType = (prop: any): string => {
    if (prop.type === 'array' && prop.items) {
      return `${prop.items.type}[]`;
    }
    if (prop.enum) {
      return prop.enum.map((v: any) => JSON.stringify(v)).join(' | ');
    }
    return prop.type || 'any';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl max-h-[85vh] bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl border ${serverColor}`}>
              {ServerIcon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-lg font-bold text-text-primary font-mono">{tool.name}</h2>
                <button
                  onClick={() => handleCopy(tool.name)}
                  className="p-1 hover:bg-bg-secondary rounded transition-colors text-text-muted hover:text-text-primary"
                  title="Copy tool name"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-bg-tertiary text-text-muted">
                  {tool.server}
                </span>
                <span className={`px-2 py-0.5 text-xs rounded-full ${
                  isCustom 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {isCustom ? 'Custom' : 'Global'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleFavorite}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
                isFavorite 
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30' 
                  : 'bg-bg-secondary text-text-muted border-border hover:bg-bg-tertiary hover:text-yellow-400'
              }`}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              <span className="text-sm">{isFavorite ? 'Favorited' : 'Favorite'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-2">Description</h3>
            <p className="text-text-primary">{tool.description}</p>
          </div>

          {/* Parameters */}
          <div>
            <h3 className="text-sm font-medium text-text-secondary mb-3">
              Parameters {paramCount > 0 && <span className="text-text-muted">({paramCount})</span>}
            </h3>
            
            {paramCount === 0 ? (
              <div className="text-text-muted text-sm italic p-4 bg-bg-secondary rounded-lg border border-border">
                This tool takes no parameters
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(properties).map(([key, prop]: [string, any]) => {
                  const isRequired = required.includes(key);
                  return (
                    <div
                      key={key}
                      className="p-4 bg-bg-secondary rounded-lg border border-border"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm text-accent-text">{key}</span>
                          {isRequired && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-red-500/20 text-red-400 border border-red-500/30">
                              required
                            </span>
                          )}
                        </div>
                        <span className="px-2 py-0.5 text-xs font-mono rounded bg-bg-tertiary text-text-muted">
                          {renderType(prop)}
                        </span>
                      </div>
                      {prop.description && (
                        <p className="text-sm text-text-secondary">{prop.description}</p>
                      )}
                      {prop.default !== undefined && (
                        <p className="text-xs text-text-muted mt-1">
                          Default: <code className="px-1 py-0.5 bg-bg-tertiary rounded">{JSON.stringify(prop.default)}</code>
                        </p>
                      )}
                      {prop.enum && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {prop.enum.map((v: any, i: number) => (
                            <span key={i} className="px-2 py-0.5 text-xs font-mono rounded bg-bg-tertiary text-text-muted">
                              {JSON.stringify(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Raw Schema (collapsible) */}
          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-2">
              <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
              Raw JSON Schema
            </summary>
            <pre className="mt-3 p-4 bg-bg-secondary rounded-lg border border-border text-xs font-mono text-text-muted overflow-x-auto">
              {JSON.stringify(tool.inputSchema, null, 2)}
            </pre>
          </details>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-bg-secondary/50">
          <div className="flex items-center justify-between">
            <p className="text-xs text-text-muted">
              {tool.connectionId && `Connection: ${tool.connectionId}`}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary text-text-primary rounded-lg transition-colors border border-border"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

interface ToolSetCardProps {
  toolset: ToolSet;
  onEdit: () => void;
  onDelete: () => void;
  tools: ToolInfo[];
}

function ToolSetCard({ toolset, onEdit, onDelete, tools }: ToolSetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    navigator.clipboard.writeText(toolset.toolSetId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toolDetails = toolset.tools.map(name => tools.find(t => t.name === name)).filter(Boolean);

  return (
    <motion.div
      variants={fadeUpVariants}
      className="bg-bg-secondary border border-border rounded-xl overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${toolset.color}20`, color: toolset.color }}
            >
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">{toolset.name}</h3>
              <p className="text-xs text-text-muted">{toolset.toolCount} tools</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {toolset.isSystem && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                System
              </span>
            )}
            {toolset.isPublic && !toolset.isSystem && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                Public
              </span>
            )}
          </div>
        </div>

        {toolset.description && (
          <p className="text-sm text-text-secondary mb-3">{toolset.description}</p>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-sm text-text-secondary"
          >
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>{expanded ? 'Hide' : 'Show'} Tools</span>
          </button>
          <button
            onClick={handleCopyId}
            className="p-2 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-text-muted"
            title="Copy toolset ID"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          {toolset.isOwned && !toolset.isSystem && (
            <>
              <button
                onClick={onEdit}
                className="p-2 bg-bg-primary border border-border rounded-lg hover:bg-bg-tertiary transition-colors text-text-muted"
                title="Edit"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                className="p-2 bg-bg-primary border border-border rounded-lg hover:bg-red-500/10 hover:border-red-500/30 transition-colors text-text-muted hover:text-red-400"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-4 bg-bg-primary space-y-2 max-h-64 overflow-y-auto">
              {toolDetails.length > 0 ? (
                toolDetails.map(tool => tool && (
                  <div
                    key={tool.name}
                    className="flex items-center gap-3 p-2 rounded-lg bg-bg-secondary"
                  >
                    <div className={`p-1.5 rounded border ${SERVER_COLORS[tool.server] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                      {SERVER_ICONS[tool.server] || <Wrench className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-mono text-xs text-accent-text">{tool.name}</span>
                      <p className="text-xs text-text-muted truncate">{tool.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-text-muted text-center py-4">No tools in this set</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface CreateSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateToolSetData) => Promise<void>;
  tools: ToolInfo[];
  editingSet?: ToolSet | null;
}

function CreateSetModal({ isOpen, onClose, onCreate, tools, editingSet }: CreateSetModalProps) {
  const [name, setName] = useState(editingSet?.name || '');
  const [description, setDescription] = useState(editingSet?.description || '');
  const [color, setColor] = useState(editingSet?.color || '#3B82F6');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set(editingSet?.tools || []));
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    if (!searchQuery) return tools;
    const query = searchQuery.toLowerCase();
    return tools.filter(t => 
      t.name.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query) ||
      t.server.toLowerCase().includes(query)
    );
  }, [tools, searchQuery]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (selectedTools.size === 0) {
      setError('Select at least one tool');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onCreate({
        name: name.trim(),
        description: description.trim(),
        color,
        tools: Array.from(selectedTools),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (toolName: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolName)) {
      newSelected.delete(toolName);
    } else {
      newSelected.add(toolName);
    }
    setSelectedTools(newSelected);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl max-h-[90vh] bg-bg-secondary border border-border rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">
              {editingSet ? 'Edit Toolkit' : 'Create Toolkit'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors text-text-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-200">{error}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Toolkit"
                className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Description (optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A collection of tools for..."
                className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-4 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-text-secondary">
                Select Tools ({selectedTools.size} selected)
              </label>
              <button
                onClick={() => setSelectedTools(new Set())}
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                Clear all
              </button>
            </div>
            
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tools..."
                className="w-full pl-10 pr-4 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <div className="max-h-64 overflow-y-auto border border-border rounded-lg bg-bg-primary">
              {filteredTools.map(tool => (
                <label
                  key={`${tool.server}:${tool.name}`}
                  className="flex items-center gap-3 p-3 hover:bg-bg-secondary cursor-pointer border-b border-border last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedTools.has(tool.name)}
                    onChange={() => toggleTool(tool.name)}
                    className="w-4 h-4 rounded border-border text-accent focus:ring-accent"
                  />
                  <div className={`p-1 rounded border ${SERVER_COLORS[tool.server]}`}>
                    {SERVER_ICONS[tool.server] || <Wrench className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-accent-text">{tool.name}</span>
                    <p className="text-xs text-text-muted truncate">{tool.description}</p>
                  </div>
                </label>
              ))}
              {filteredTools.length === 0 && (
                <p className="text-sm text-text-muted text-center py-8">No tools found</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-border flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{editingSet ? 'Save Changes' : 'Create Set'}</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Tools Page - Browse tools and manage tool sets
 */
export default function ToolsPage() {
  const { tools, toolsByServer, sources, loading: toolsLoading, error: toolsError } = useAvailableTools();
  const { 
    toolsets, 
    loading: setsLoading, 
    createToolSet, 
    updateToolSet, 
    deleteToolSet 
  } = useToolSets();
  const { favorites, toggleFavorite, isFavorite, favoritesCount } = useFavoriteTools();

  const [activeTab, setActiveTab] = useState<Tab>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSet, setEditingSet] = useState<ToolSet | null>(null);
  const [sortBy] = useState<'name' | 'server'>('server');
  const [detailTool, setDetailTool] = useState<ToolInfo | null>(null);
  const [deleteConfirmSet, setDeleteConfirmSet] = useState<ToolSet | null>(null);

  // Count tools by source
  const globalCount = tools.filter(t => t.source === 'global').length;
  const customCount = tools.filter(t => t.source === 'custom').length;

  const filteredTools = useMemo(() => {
    let result = [...tools];
    // Filter by source
    if (sourceFilter === 'global') {
      result = result.filter(t => t.source === 'global');
    } else if (sourceFilter === 'custom') {
      result = result.filter(t => t.source === 'custom');
    } else if (sourceFilter === 'favorites') {
      result = result.filter(t => isFavorite(getToolId(t.server, t.name)));
    }
    // Filter by server
    if (selectedServer) {
      result = result.filter(t => t.server === selectedServer);
    }
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return a.server.localeCompare(b.server) || a.name.localeCompare(b.name);
    });
    return result;
  }, [tools, selectedServer, sourceFilter, searchQuery, sortBy, isFavorite]);

  // Filter servers based on source filter
  const filteredServers = useMemo(() => {
    if (sourceFilter === 'all') return toolsByServer;
    return toolsByServer.filter(s => s.source === sourceFilter);
  }, [toolsByServer, sourceFilter]);

  const handleToggleSelect = (toolName: string) => {
    const newSelected = new Set(selectedTools);
    if (newSelected.has(toolName)) {
      newSelected.delete(toolName);
    } else {
      newSelected.add(toolName);
    }
    setSelectedTools(newSelected);
  };

  const handleCreateSet = async (data: CreateToolSetData) => {
    if (editingSet && editingSet.toolSetId) {
      await updateToolSet(editingSet.toolSetId, data);
    } else {
      await createToolSet(data);
    }
  };

  const handleEditSet = (toolset: ToolSet) => {
    setEditingSet(toolset);
    setShowCreateModal(true);
  };

  const handleDeleteSet = (toolset: ToolSet) => {
    setDeleteConfirmSet(toolset);
  };

  const confirmDeleteSet = async () => {
    if (deleteConfirmSet) {
      await deleteToolSet(deleteConfirmSet.toolSetId);
      setDeleteConfirmSet(null);
    }
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingSet(null);
  };

  const handleCreateFromSelection = () => {
    setEditingSet({
      toolSetId: '',
      name: '',
      description: '',
      icon: 'wrench',
      color: '#3B82F6',
      tools: Array.from(selectedTools),
      toolCount: selectedTools.size,
      isSystem: false,
      isPublic: false,
      isOwned: true,
      createdAt: '',
      updatedAt: '',
    });
    setShowCreateModal(true);
  };

  return (
    <div className="h-app bg-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-bg-elevated border-b border-border px-4 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/connections"
              className="p-2 hover:bg-bg-secondary rounded-lg transition-colors"
              title="Back to Connections"
            >
              <ArrowLeft className="w-5 h-5 text-text-secondary" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Tools</h1>
              <p className="text-sm text-text-muted">Browse MCP tools and manage toolkits</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'browse'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Browse Tools</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-black/20">
                {tools.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('sets')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === 'sets'
                  ? 'bg-accent text-white'
                  : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Toolkits</span>
              <span className="px-2 py-0.5 text-xs rounded-full bg-black/20">
                {toolsets.length}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            {activeTab === 'browse' ? (
              <motion.div
                key="browse"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Filters Bar */}
                <div className="flex flex-col gap-4">
                  {/* Source Filter */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-text-muted mr-1 sm:mr-2">Source:</span>
                    <button
                      onClick={() => { setSourceFilter('all'); setSelectedServer(null); }}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                        sourceFilter === 'all'
                          ? 'bg-accent text-white'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      <Zap className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      <span>All</span>
                      <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-black/20">{tools.length}</span>
                    </button>
                    <button
                      onClick={() => { setSourceFilter('global'); setSelectedServer(null); }}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                        sourceFilter === 'global'
                          ? 'bg-blue-500 text-white'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      <Globe className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      <span>Global</span>
                      <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-black/20">{globalCount}</span>
                    </button>
                    <button
                      onClick={() => { setSourceFilter('custom'); setSelectedServer(null); }}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                        sourceFilter === 'custom'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      <Server className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      <span>Custom</span>
                      <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-black/20">{customCount}</span>
                    </button>
                    <button
                      onClick={() => { setSourceFilter('favorites'); setSelectedServer(null); }}
                      className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm transition-colors ${
                        sourceFilter === 'favorites'
                          ? 'bg-yellow-500 text-white'
                          : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                      }`}
                    >
                      <Star className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                      <span>Favorites</span>
                      <span className="px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded bg-black/20">{favoritesCount}</span>
                    </button>
                  </div>

                  {/* Search and Server Filter */}
                  <div className="flex flex-col gap-3 sm:gap-4">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search tools..."
                          className="w-full pl-10 pr-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                        />
                      </div>
                      {sourceFilter === 'custom' && (
                        <Link
                          href="/connections/mcp-servers"
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 rounded-lg transition-colors text-sm whitespace-nowrap"
                        >
                          <Plus className="w-4 h-4" />
                          <span className="hidden sm:inline">Add</span>
                        </Link>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 overflow-x-auto pb-1 -mb-1">
                        <button
                          onClick={() => setSelectedServer(null)}
                          className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                            !selectedServer
                              ? 'bg-accent text-white'
                              : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                          }`}
                        >
                          All
                        </button>
                        {filteredServers.map(({ server, source }) => (
                          <button
                            key={server}
                            onClick={() => setSelectedServer(server === selectedServer ? null : server)}
                            className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors whitespace-nowrap ${
                              server === selectedServer
                                ? 'bg-accent text-white'
                                : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
                            }`}
                          >
                            {source === 'custom' ? <Server className="w-3 sm:w-4 h-3 sm:h-4" /> : SERVER_ICONS[server]}
                            <span className="capitalize truncate max-w-[80px] sm:max-w-none">{server}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1 flex-shrink-0">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`p-2 rounded transition-colors ${
                            viewMode === 'grid' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <Grid className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setViewMode('list')}
                          className={`p-2 rounded transition-colors ${
                            viewMode === 'list' ? 'bg-bg-tertiary text-text-primary' : 'text-text-muted hover:text-text-primary'
                          }`}
                        >
                          <List className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedTools.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-accent/10 border border-accent/30 rounded-lg"
                  >
                    <span className="text-xs sm:text-sm text-text-secondary">
                      {selectedTools.size} tool{selectedTools.size !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={handleCreateFromSelection}
                      className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors text-xs sm:text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Set from Selection</span>
                    </button>
                    <button
                      onClick={() => setSelectedTools(new Set())}
                      className="text-xs sm:text-sm text-text-muted hover:text-text-primary transition-colors"
                    >
                      Clear
                    </button>
                  </motion.div>
                )}

                {toolsLoading && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                    <p className="text-text-secondary">Loading tools...</p>
                  </div>
                )}

                {toolsError && (
                  <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-200">Failed to load tools</p>
                      <p className="text-sm text-red-300 mt-1">{toolsError}</p>
                    </div>
                  </div>
                )}

                {!toolsLoading && !toolsError && (
                  <>
                    {filteredTools.length === 0 ? (
                      <div className="text-center py-20">
                        <Sparkles className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                        <p className="text-text-secondary">No tools found matching your search</p>
                      </div>
                    ) : (
                      <motion.div
                        className={viewMode === 'grid' 
                          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max'
                          : 'space-y-3'
                        }
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                      >
                        {filteredTools.map(tool => {
                          const toolId = getToolId(tool.server, tool.name);
                          return (
                            <ToolCard
                              key={toolId}
                              tool={tool}
                              selected={selectedTools.has(tool.name)}
                              onSelect={() => handleToggleSelect(tool.name)}
                              onViewDetails={() => setDetailTool(tool)}
                              onToggleFavorite={() => toggleFavorite(toolId)}
                              isFavorite={isFavorite(toolId)}
                              viewMode={viewMode}
                            />
                          );
                        })}
                      </motion.div>
                    )}

                    <div className="text-center text-sm text-text-muted py-4">
                      Showing {filteredTools.length} of {tools.length} tools
                    </div>
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="sets"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">Toolkits</h2>
                    <p className="text-sm text-text-muted">Create reusable groups of tools for your nodes</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Toolkit</span>
                  </button>
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">How to use Toolkits</p>
                    <p className="text-blue-300">
                      Toolkits let you group tools together for easy reference. When creating or editing a node,
                      you can reference a toolkit ID instead of listing individual tools. This makes it easy to
                      update which tools are available across multiple nodes at once.
                    </p>
                  </div>
                </div>

                {setsLoading && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
                    <p className="text-text-secondary">Loading toolkits...</p>
                  </div>
                )}

                {!setsLoading && (
                  <>
                    {toolsets.length === 0 ? (
                      <div className="text-center py-20">
                        <FolderOpen className="w-12 h-12 text-text-disabled mx-auto mb-4" />
                        <p className="text-text-secondary mb-4">No toolkits yet</p>
                        <button
                          onClick={() => setShowCreateModal(true)}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Create your first toolkit</span>
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                      >
                        {toolsets.map(toolset => (
                          <ToolSetCard
                            key={toolset.toolSetId}
                            toolset={toolset}
                            onEdit={() => handleEditSet(toolset)}
                            onDelete={() => handleDeleteSet(toolset)}
                            tools={tools}
                          />
                        ))}
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <CreateSetModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        onCreate={handleCreateSet}
        tools={tools}
        editingSet={editingSet}
      />

      <AnimatePresence>
        {detailTool && (
          <ToolDetailModal
            tool={detailTool}
            isOpen={!!detailTool}
            onClose={() => setDetailTool(null)}
            isFavorite={isFavorite(getToolId(detailTool.server, detailTool.name))}
            onToggleFavorite={() => toggleFavorite(getToolId(detailTool.server, detailTool.name))}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!deleteConfirmSet}
        onClose={() => setDeleteConfirmSet(null)}
        onConfirm={confirmDeleteSet}
        title="Delete Toolkit"
        message={`Delete "${deleteConfirmSet?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
