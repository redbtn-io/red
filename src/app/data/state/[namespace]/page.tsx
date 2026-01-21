'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Search, 
  Loader2, 
  AlertCircle,
  Plus,
  Trash2,
  X,
  Key,
  Copy,
  Check,
  Edit2,
  Save,
  ChevronDown,
  ChevronRight,
  Code,
} from 'lucide-react';
import { pageVariants } from '@/lib/animations';

interface StateEntry {
  key: string;
  value: any;
  valueType: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  description?: string;
  lastModifiedAt: string;
  lastModifiedBy?: string;
  expiresAt?: string;
  accessCount: number;
  lastAccessedAt?: string;
}

interface NamespaceDetails {
  namespace: string;
  description?: string;
  entries: StateEntry[];
  keyCount: number;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
}

export default function NamespaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const namespace = params.namespace as string;

  const [details, setDetails] = useState<NamespaceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Add entry state
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [addForm, setAddForm] = useState({
    key: '',
    value: '',
    valueType: 'string' as 'string' | 'number' | 'boolean' | 'object' | 'array',
    description: '',
    ttlSeconds: '',
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit entry state
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Expanded entries (for viewing object/array values)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchNamespace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/state/namespaces/${namespace}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Namespace not found');
        }
        throw new Error('Failed to fetch namespace');
      }
      const data = await response.json();
      setDetails(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [namespace]);

  useEffect(() => {
    fetchNamespace();
  }, [fetchNamespace]);

  const handleAddEntry = async () => {
    if (!addForm.key.trim()) {
      setAddError('Key is required');
      return;
    }

    // Validate key format
    const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!keyRegex.test(addForm.key)) {
      setAddError('Key must start with a letter or underscore and contain only letters, numbers, and underscores');
      return;
    }

    // Parse value based on type
    let parsedValue: any;
    try {
      switch (addForm.valueType) {
        case 'number':
          parsedValue = Number(addForm.value);
          if (isNaN(parsedValue)) throw new Error('Invalid number');
          break;
        case 'boolean':
          parsedValue = addForm.value.toLowerCase() === 'true';
          break;
        case 'object':
        case 'array':
          parsedValue = JSON.parse(addForm.value);
          break;
        default:
          parsedValue = addForm.value;
      }
    } catch (e) {
      setAddError(`Invalid ${addForm.valueType} value`);
      return;
    }

    try {
      setAdding(true);
      setAddError(null);

      const response = await fetch(`/api/v1/state/namespaces/${namespace}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: addForm.key,
          value: parsedValue,
          description: addForm.description || undefined,
          ttlSeconds: addForm.ttlSeconds ? Number(addForm.ttlSeconds) : undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add entry');
      }

      // Success - close modal and refresh
      setShowAddEntry(false);
      setAddForm({ key: '', value: '', valueType: 'string', description: '', ttlSeconds: '' });
      fetchNamespace();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateEntry = async (key: string) => {
    try {
      setSaving(true);

      // Try to parse as JSON first, otherwise keep as string
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        parsedValue = editValue;
      }

      const response = await fetch(`/api/v1/state/namespaces/${namespace}/values/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsedValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update entry');
      }

      setEditingKey(null);
      fetchNamespace();
    } catch (err) {
      console.error('Update error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async (key: string) => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/v1/state/namespaces/${namespace}/values/${key}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      setDeleteConfirmKey(null);
      fetchNamespace();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const copyReference = (key: string) => {
    const ref = `{{globalState.${namespace}.${key}}}`;
    navigator.clipboard.writeText(ref);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpand = (key: string) => {
    const newExpanded = new Set(expandedKeys);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedKeys(newExpanded);
  };

  const formatValue = (value: any, type: string): string => {
    if (type === 'object' || type === 'array') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'string': return 'text-green-400';
      case 'number': return 'text-blue-400';
      case 'boolean': return 'text-yellow-400';
      case 'object': return 'text-purple-400';
      case 'array': return 'text-orange-400';
      case 'null': return 'text-text-secondary';
      default: return 'text-text-secondary';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Filter entries
  const filteredEntries = (details?.entries || []).filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return entry.key.toLowerCase().includes(query) ||
           entry.description?.toLowerCase().includes(query);
  });

  if (loading) {
    return (
      <div className="min-h-full bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (error || !details) {
    return (
      <motion.div
        className="min-h-full bg-bg-primary text-text-primary"
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <div className="max-w-7xl mx-auto px-4 py-6 pb-scroll-safe">
            className="inline-flex items-center gap-2 text-text-secondary hover:text-text-primary mb-6"
          >
            <ArrowLeft size={16} />
            Back to Namespaces
          </Link>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-text-secondary mb-4">{error || 'Namespace not found'}</p>
            <Link
              href="/data/state"
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              Back to Namespaces
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="min-h-full bg-bg-primary text-text-primary"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link
                href="/data/state"
                className="p-2 hover:bg-bg-secondary rounded-lg text-text-secondary hover:text-text-primary"
              >
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-xl font-bold font-mono">{details.namespace}</h1>
                {details.description && (
                  <p className="text-sm text-text-secondary">{details.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowAddEntry(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Plus size={18} />
              Add Entry
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keys..."
              className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-scroll-safe">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Key className="w-16 h-16 text-text-disabled mb-4" />
            <h3 className="text-xl font-semibold mb-2">No entries yet</h3>
            <p className="text-text-secondary mb-6 max-w-md">
              Add key-value pairs to this namespace that can be accessed by your workflows.
            </p>
            <button
              onClick={() => setShowAddEntry(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Plus size={20} />
              Add Your First Entry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEntries.map((entry) => (
              <motion.div
                key={entry.key}
                layout
                className="bg-bg-elevated border border-border rounded-xl overflow-hidden"
              >
                {/* Entry Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(entry.key)}
                      className="p-1 hover:bg-bg-secondary rounded"
                    >
                      {expandedKeys.has(entry.key) ? (
                        <ChevronDown size={16} className="text-text-secondary" />
                      ) : (
                        <ChevronRight size={16} className="text-text-secondary" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">{entry.key}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${getTypeColor(entry.valueType)} bg-current/10`}>
                          {entry.valueType}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="text-xs text-text-muted mt-0.5">{entry.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyReference(entry.key)}
                      className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
                      title="Copy reference"
                    >
                      {copiedKey === entry.key ? (
                        <Check size={14} className="text-green-400" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingKey(entry.key);
                        setEditValue(formatValue(entry.value, entry.valueType));
                      }}
                      className="p-1.5 hover:bg-bg-secondary rounded text-text-secondary hover:text-text-primary"
                      title="Edit value"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmKey(entry.key)}
                      className="p-1.5 hover:bg-red-500/10 rounded text-text-secondary hover:text-red-400"
                      title="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Entry Content (when expanded) */}
                <AnimatePresence>
                  {expandedKeys.has(entry.key) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border"
                    >
                      <div className="p-4">
                        {editingKey === entry.key ? (
                          <div className="space-y-3">
                            <textarea
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              rows={entry.valueType === 'object' || entry.valueType === 'array' ? 8 : 3}
                              className="w-full px-3 py-2 bg-bg-primary border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-red-500/50 resize-y"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingKey(null)}
                                className="px-3 py-1.5 bg-bg-secondary hover:bg-bg-tertiary rounded-lg text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleUpdateEntry(entry.key)}
                                disabled={saving}
                                className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm flex items-center gap-2 disabled:opacity-50"
                              >
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap break-words bg-bg-primary p-3 rounded-lg overflow-x-auto">
                            {formatValue(entry.value, entry.valueType)}
                          </pre>
                        )}

                        {/* Metadata */}
                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-text-muted">
                          <span>Modified: {formatDate(entry.lastModifiedAt)}</span>
                          {entry.lastModifiedBy && (
                            <span>By: {entry.lastModifiedBy}</span>
                          )}
                          <span>Accessed: {entry.accessCount} times</span>
                          {entry.expiresAt && (
                            <span className="text-yellow-500">Expires: {formatDate(entry.expiresAt)}</span>
                          )}
                        </div>

                        {/* Usage Reference */}
                        <div className="mt-3 p-2 bg-bg-primary rounded-lg flex items-center gap-2">
                          <Code size={14} className="text-text-muted" />
                          <code className="text-xs text-blue-400 font-mono">
                            {'{{globalState.'}{namespace}.{entry.key}{'}}'}
                          </code>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            className="bg-bg-elevated border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Add Entry</h2>
              <button
                onClick={() => { setShowAddEntry(false); setAddError(null); }}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {addError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {addError}
                </div>
              )}

              {/* Key */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.key}
                  onChange={(e) => setAddForm(f => ({ ...f, key: e.target.value }))}
                  placeholder="my_variable"
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 font-mono"
                  maxLength={100}
                  autoFocus
                />
                <p className="text-xs text-text-muted mt-1">
                  Use letters, numbers, and underscores. Must start with a letter or underscore.
                </p>
              </div>

              {/* Value Type */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Value Type
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {(['string', 'number', 'boolean', 'object', 'array'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddForm(f => ({ ...f, valueType: type }))}
                      className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                        addForm.valueType === type
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-border bg-bg-primary hover:border-border-hover'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Value <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={addForm.value}
                  onChange={(e) => setAddForm(f => ({ ...f, value: e.target.value }))}
                  placeholder={
                    addForm.valueType === 'object' ? '{"key": "value"}' :
                    addForm.valueType === 'array' ? '["item1", "item2"]' :
                    addForm.valueType === 'boolean' ? 'true or false' :
                    addForm.valueType === 'number' ? '42' :
                    'Enter value...'
                  }
                  rows={addForm.valueType === 'object' || addForm.valueType === 'array' ? 6 : 3}
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 font-mono resize-y"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What is this value for?"
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
                />
              </div>

              {/* TTL */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  TTL in seconds (optional)
                </label>
                <input
                  type="number"
                  value={addForm.ttlSeconds}
                  onChange={(e) => setAddForm(f => ({ ...f, ttlSeconds: e.target.value }))}
                  placeholder="Leave empty for no expiration"
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
                />
                <p className="text-xs text-text-muted mt-1">
                  Value will be automatically deleted after this time. Leave empty for permanent storage.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => { setShowAddEntry(false); setAddError(null); }}
                className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                disabled={adding}
              >
                Cancel
              </button>
              <button
                onClick={handleAddEntry}
                disabled={adding || !addForm.key.trim() || !addForm.value.trim()}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {adding ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Add Entry
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div
            className="bg-bg-elevated border border-border rounded-xl w-full max-w-md overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={20} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold">Delete Entry</h2>
              </div>
              <p className="text-text-secondary mb-2">
                Are you sure you want to delete <span className="text-text-primary font-medium font-mono">{deleteConfirmKey}</span>?
              </p>
              <p className="text-sm text-text-muted mb-6">
                This action cannot be undone. Any workflows using this value will receive undefined.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmKey(null)}
                  className="flex-1 py-2.5 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteEntry(deleteConfirmKey)}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Entry
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
