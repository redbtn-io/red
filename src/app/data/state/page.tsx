'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Search, 
  Globe,
  Loader2, 
  AlertCircle,
  Plus,
  Database,
  MoreVertical,
  Clock,
  X,
  Trash2,
  ExternalLink,
  Key,
} from 'lucide-react';
import { pageVariants, staggerContainerVariants, staggerItemVariants, scaleVariants } from '@/lib/animations';

interface NamespaceInfo {
  namespace: string;
  description?: string;
  keyCount: number;
  lastUpdated: string;
  createdAt: string;
  isArchived: boolean;
}

type SortOption = 'name' | 'updated' | 'keys';
type FilterOption = 'all' | 'active' | 'archived';

export default function GlobalStatePage() {
  const router = useRouter();
  const [namespaces, setNamespaces] = useState<NamespaceInfo[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<NamespaceInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [filterBy, setFilterBy] = useState<FilterOption>('active');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    namespace: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const resetCreateForm = () => {
    setCreateForm({ namespace: '', description: '' });
    setCreateError(null);
  };

  const handleCreateNamespace = async () => {
    if (!createForm.namespace.trim()) {
      setCreateError('Namespace name is required');
      return;
    }

    // Validate namespace format
    const namespaceRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!namespaceRegex.test(createForm.namespace)) {
      setCreateError('Namespace must start with a letter and contain only letters, numbers, hyphens, and underscores');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const response = await fetch('/api/v1/state/namespaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create namespace');
      }

      // Success - close modal and refresh
      setShowCreateModal(false);
      resetCreateForm();
      fetchNamespaces();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const fetchNamespaces = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/state/namespaces?includeArchived=true');
      if (!response.ok) {
        throw new Error('Failed to fetch namespaces');
      }
      const data = await response.json();
      setNamespaces(data.namespaces || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openMenuId]);

  // Delete namespace handler
  const handleDeleteNamespace = async (ns: NamespaceInfo) => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/v1/state/namespaces/${ns.namespace}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete namespace');
      }
      setDeleteConfirm(null);
      fetchNamespaces();
    } catch (err) {
      console.error('Delete namespace error:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Listen for create namespace event from sidebar
  useEffect(() => {
    const handleOpenCreate = () => setShowCreateModal(true);
    window.addEventListener('openCreateNamespace', handleOpenCreate);
    return () => window.removeEventListener('openCreateNamespace', handleOpenCreate);
  }, []);

  // Filter and sort namespaces
  const filteredNamespaces = namespaces
    .filter(ns => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!ns.namespace.toLowerCase().includes(query) && 
            !ns.description?.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Archive filter
      if (filterBy === 'active') return !ns.isArchived;
      if (filterBy === 'archived') return ns.isArchived;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.namespace.localeCompare(b.namespace);
        case 'keys':
          return b.keyCount - a.keyCount;
        case 'updated':
        default:
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      }
    });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <motion.div
      className="min-h-full bg-bg-primary text-text-primary"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Filters Bar */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <p className="text-text-secondary text-sm mb-4">
            Manage persistent key-value state accessible by all your workflows
          </p>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search namespaces..."
                className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-red-500/50"
              >
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-red-500/50"
              >
                <option value="updated">Recently Updated</option>
                <option value="name">Name</option>
                <option value="keys">Most Keys</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={fetchNamespaces}
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredNamespaces.length === 0 ? (
          <motion.div 
            className="flex flex-col items-center justify-center py-20 text-center"
            variants={scaleVariants}
            initial="initial"
            animate="animate"
          >
            <Globe className="w-16 h-16 text-text-disabled mb-4" />
            <h3 className="text-xl font-semibold mb-2">No namespaces yet</h3>
            <p className="text-text-secondary mb-6 max-w-md">
              Create your first namespace to store persistent key-value state that can be accessed by all your workflows.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Plus size={20} />
              <span>Create Your First Namespace</span>
            </button>
          </motion.div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainerVariants}
            initial="initial"
            animate="animate"
          >
            {filteredNamespaces.map((ns) => (
              <Link
                key={ns.namespace}
                href={`/data/state/${ns.namespace}`}
              >
                <motion.div
                  variants={staggerItemVariants}
                  className="group relative bg-bg-elevated border border-border rounded-xl p-5 hover:border-border transition-all cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/20"
                    >
                      <Database size={20} className="text-blue-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      {ns.isArchived && (
                        <span className="text-xs px-2 py-0.5 bg-gray-500/20 text-text-secondary rounded">
                          Archived
                        </span>
                      )}
                      <div className="relative" ref={openMenuId === ns.namespace ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === ns.namespace ? null : ns.namespace);
                          }}
                          className="p-1 hover:bg-bg-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical size={16} className="text-text-secondary" />
                        </button>
                        {openMenuId === ns.namespace && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-bg-secondary border border-border rounded-lg shadow-xl z-20 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                                router.push(`/data/state/${ns.namespace}`);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                            >
                              <ExternalLink size={14} />
                              Open
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setDeleteConfirm(ns);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-semibold text-text-primary mb-1 truncate font-mono">
                    {ns.namespace}
                  </h3>
                  {ns.description && (
                    <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                      {ns.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col items-center p-2 bg-bg-primary rounded-lg">
                      <Key size={14} className="text-text-muted mb-1" />
                      <span className="font-medium">{ns.keyCount}</span>
                      <span className="text-text-muted">keys</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-bg-primary rounded-lg">
                      <Clock size={14} className="text-text-muted mb-1" />
                      <span className="font-medium">{formatDate(ns.lastUpdated)}</span>
                      <span className="text-text-muted">updated</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <span className="text-xs text-text-muted">
                      Created {formatDate(ns.createdAt)}
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        )}
      </div>

      {/* Create Namespace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            className="bg-bg-elevated border border-border rounded-xl w-full max-w-md overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Create Namespace</h2>
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5">
              {/* Error Display */}
              {createError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {createError}
                </div>
              )}

              {/* Namespace Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Namespace Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.namespace}
                  onChange={(e) => setCreateForm(f => ({ ...f, namespace: e.target.value }))}
                  placeholder="my-workflow-state"
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 font-mono"
                  maxLength={100}
                  autoFocus
                />
                <p className="text-xs text-text-muted mt-1">
                  Use letters, numbers, hyphens, and underscores. Must start with a letter.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What kind of state will this namespace store?"
                  rows={3}
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>

              {/* Usage Hint */}
              <div className="p-4 bg-bg-primary rounded-lg border border-border">
                <p className="text-xs text-text-secondary mb-2">
                  Access this state in your workflows using:
                </p>
                <code className="text-xs text-blue-400 font-mono">
                  {'{{globalState.'}{createForm.namespace || 'namespace'}{'.keyName}}'}
                </code>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                disabled={creating}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNamespace}
                disabled={creating || !createForm.namespace.trim()}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Create Namespace
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
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
                <h2 className="text-xl font-bold">Delete Namespace</h2>
              </div>
              <p className="text-text-secondary mb-2">
                Are you sure you want to delete <span className="text-text-primary font-medium font-mono">{deleteConfirm.namespace}</span>?
              </p>
              <p className="text-sm text-text-muted mb-6">
                This will permanently delete all {deleteConfirm.keyCount} keys and their values. This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2.5 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteNamespace(deleteConfirm)}
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
                      Delete Namespace
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-safe right-6 z-40 md:hidden p-4 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg shadow-red-500/25 transition-colors"
        aria-label="Create Namespace"
      >
        <Plus size={24} />
      </button>
    </motion.div>
  );
}
