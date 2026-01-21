'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Search, 
  Library,
  Loader2, 
  AlertCircle,
  Plus,
  FileText,
  Lock,
  Users,
  Eye,
  MoreVertical,
  HardDrive,
  TrendingUp,
  Settings,
  X,
  BookOpen,
  Database,
  Globe,
  Sparkles,
  Check,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { pageVariants, staggerContainerVariants, staggerItemVariants, scaleVariants } from '@/lib/animations';

interface LibraryInfo {
  libraryId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  access: 'private' | 'shared' | 'public';
  documentCount: number;
  totalChunks: number;
  totalSize: number;
  searchCount: number;
  lastSearchAt?: string;
  lastUpdatedAt: string;
  createdAt: string;
  isArchived: boolean;
  isOwned: boolean;
}

type SortOption = 'name' | 'updated' | 'documents' | 'searches';
type FilterOption = 'all' | 'owned' | 'shared' | 'public';

export default function KnowledgePage() {
  const router = useRouter();
  const [libraries, setLibraries] = useState<LibraryInfo[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<LibraryInfo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    icon: 'Library',
    color: '#ef4444',
    access: 'private' as 'private' | 'shared' | 'public',
    chunkSize: 2000,
    chunkOverlap: 200,
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const resetCreateForm = () => {
    setCreateForm({
      name: '',
      description: '',
      icon: 'Library',
      color: '#ef4444',
      access: 'private',
      chunkSize: 2000,
      chunkOverlap: 200,
    });
    setCreateError(null);
    setShowAdvanced(false);
  };

  const handleCreateLibrary = async () => {
    if (!createForm.name.trim()) {
      setCreateError('Name is required');
      return;
    }

    try {
      setCreating(true);
      setCreateError(null);

      const response = await fetch('/api/v1/libraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create library');
      }

      // Success - close modal and refresh
      setShowCreateModal(false);
      resetCreateForm();
      fetchLibraries();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCreating(false);
    }
  };

  const fetchLibraries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/v1/libraries');
      if (!response.ok) {
        throw new Error('Failed to fetch libraries');
      }
      const data = await response.json();
      setLibraries(data.libraries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLibraries();
  }, [fetchLibraries]);

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

  // Delete library handler
  const handleDeleteLibrary = async (library: LibraryInfo) => {
    try {
      setDeleting(true);
      const response = await fetch(`/api/v1/libraries/${library.libraryId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete library');
      }
      setDeleteConfirm(null);
      fetchLibraries();
    } catch (err) {
      console.error('Delete library error:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Listen for create library event from sidebar
  useEffect(() => {
    const handleOpenCreate = () => setShowCreateModal(true);
    window.addEventListener('openCreateLibrary', handleOpenCreate);
    return () => window.removeEventListener('openCreateLibrary', handleOpenCreate);
  }, []);

  // Filter and sort libraries
  const filteredLibraries = libraries
    .filter(lib => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!lib.name.toLowerCase().includes(query) && 
            !lib.description?.toLowerCase().includes(query)) {
          return false;
        }
      }
      // Access filter
      if (filterBy === 'owned') return lib.isOwned;
      if (filterBy === 'shared') return !lib.isOwned && lib.access !== 'public';
      if (filterBy === 'public') return lib.access === 'public';
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'documents':
          return b.documentCount - a.documentCount;
        case 'searches':
          return b.searchCount - a.searchCount;
        case 'updated':
        default:
          return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime();
      }
    });

  const getAccessIcon = (access: string) => {
    switch (access) {
      case 'private': return Lock;
      case 'shared': return Users;
      case 'public': return Eye;
      default: return Lock;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
            Manage your document libraries for AI-powered search
          </p>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search libraries..."
                className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterOption)}
                className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-red-500/50"
              >
                <option value="all">All Libraries</option>
                <option value="owned">My Libraries</option>
                <option value="shared">Shared with Me</option>
                <option value="public">Public</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary focus:outline-none focus:border-red-500/50"
              >
                <option value="updated">Recently Updated</option>
                <option value="name">Name</option>
                <option value="documents">Most Documents</option>
                <option value="searches">Most Searched</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-scroll-safe">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-text-secondary mb-4">{error}</p>
            <button
              onClick={fetchLibraries}
              className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredLibraries.length === 0 ? (
          <motion.div 
            className="flex flex-col items-center justify-center py-20 text-center"
            variants={scaleVariants}
            initial="initial"
            animate="animate"
          >
            <Library className="w-16 h-16 text-text-disabled mb-4" />
            <h3 className="text-xl font-semibold mb-2">No libraries yet</h3>
            <p className="text-text-secondary mb-6 max-w-md">
              Create your first knowledge library to store documents and enable AI-powered semantic search.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
            >
              <Plus size={20} />
              <span>Create Your First Library</span>
            </button>
          </motion.div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainerVariants}
            initial="initial"
            animate="animate"
          >
            {filteredLibraries.map((library) => {
              const AccessIcon = getAccessIcon(library.access);
              return (
                <Link
                  key={library.libraryId}
                  href={`/data/knowledge/${library.libraryId}`}
                >
                <motion.div
                  variants={staggerItemVariants}
                  className="group relative bg-bg-elevated border border-border rounded-xl p-5 hover:border-border transition-all cursor-pointer"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${library.color || '#ef4444'}20` }}
                    >
                      <Library 
                        size={20} 
                        style={{ color: library.color || '#ef4444' }} 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <AccessIcon size={14} className="text-text-muted" />
                      <div className="relative" ref={openMenuId === library.libraryId ? menuRef : null}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === library.libraryId ? null : library.libraryId);
                          }}
                          className="p-1 hover:bg-bg-secondary rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical size={16} className="text-text-secondary" />
                        </button>
                        {openMenuId === library.libraryId && (
                          <div className="absolute right-0 top-full mt-1 w-40 bg-bg-secondary border border-border rounded-lg shadow-xl z-20 overflow-hidden">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                                router.push(`/data/knowledge/${library.libraryId}`);
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
                                router.push(`/data/knowledge/${library.libraryId}?settings=true`);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                            >
                              <Settings size={14} />
                              Settings
                            </button>
                            {library.isOwned && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setDeleteConfirm(library);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-semibold text-text-primary mb-1 truncate">
                    {library.name}
                  </h3>
                  {library.description && (
                    <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                      {library.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col items-center p-2 bg-bg-primary rounded-lg">
                      <FileText size={14} className="text-text-muted mb-1" />
                      <span className="font-medium">{library.documentCount}</span>
                      <span className="text-text-muted">docs</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-bg-primary rounded-lg">
                      <HardDrive size={14} className="text-text-muted mb-1" />
                      <span className="font-medium">{formatSize(library.totalSize)}</span>
                      <span className="text-text-muted">size</span>
                    </div>
                    <div className="flex flex-col items-center p-2 bg-bg-primary rounded-lg">
                      <TrendingUp size={14} className="text-text-muted mb-1" />
                      <span className="font-medium">{library.searchCount}</span>
                      <span className="text-text-muted">searches</span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <span className="text-xs text-text-muted">
                      Updated {formatDate(library.lastUpdatedAt)}
                    </span>
                    {!library.isOwned && (
                      <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded">
                        Shared
                      </span>
                    )}
                  </div>
                </motion.div>
                </Link>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Create Library Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <motion.div 
            className="bg-bg-elevated border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Create New Library</h2>
              <button
                onClick={() => { setShowCreateModal(false); resetCreateForm(); }}
                className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Error Display */}
              {createError && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {createError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Library Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My Knowledge Base"
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
                  maxLength={100}
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Description
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What kind of documents will this library contain?"
                  rows={3}
                  className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 resize-none"
                />
              </div>

              {/* Icon & Color */}
              <div className="grid grid-cols-2 gap-4">
                {/* Icon Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: 'Library', Icon: Library },
                      { name: 'BookOpen', Icon: BookOpen },
                      { name: 'Database', Icon: Database },
                      { name: 'FileText', Icon: FileText },
                      { name: 'Globe', Icon: Globe },
                      { name: 'Sparkles', Icon: Sparkles },
                    ].map(({ name, Icon }) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setCreateForm(f => ({ ...f, icon: name }))}
                        className={`p-2.5 rounded-lg border transition-colors ${
                          createForm.icon === name
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-border bg-bg-primary hover:border-border-hover'
                        }`}
                      >
                        <Icon size={18} style={{ color: createForm.color }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCreateForm(f => ({ ...f, color }))}
                        className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                          createForm.color === color
                            ? 'border-white scale-110'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {createForm.color === color && (
                          <Check size={16} className="mx-auto text-text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Access Level */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Access Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'private', label: 'Private', Icon: Lock, desc: 'Only you' },
                    { value: 'shared', label: 'Shared', Icon: Users, desc: 'Invite others' },
                    { value: 'public', label: 'Public', Icon: Eye, desc: 'Anyone can view' },
                  ].map(({ value, label, Icon, desc }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCreateForm(f => ({ ...f, access: value as 'private' | 'shared' | 'public' }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        createForm.access === value
                          ? 'border-red-500 bg-red-500/10'
                          : 'border-border bg-bg-primary hover:border-border-hover'
                      }`}
                    >
                      <Icon size={18} className="mb-1" />
                      <div className="text-sm font-medium">{label}</div>
                      <div className="text-xs text-text-muted">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                <Settings size={14} />
                Advanced Settings
                <span className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>▼</span>
              </button>

              {/* Advanced Settings */}
              {showAdvanced && (
                <div className="space-y-4 p-4 bg-bg-primary rounded-lg border border-border">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Chunk Size: {createForm.chunkSize} characters
                    </label>
                    <input
                      type="range"
                      min={500}
                      max={4000}
                      step={100}
                      value={createForm.chunkSize}
                      onChange={(e) => setCreateForm(f => ({ ...f, chunkSize: parseInt(e.target.value) }))}
                      className="w-full accent-red-500"
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-1">
                      <span>500</span>
                      <span>4000</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Chunk Overlap: {createForm.chunkOverlap} characters
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={500}
                      step={50}
                      value={createForm.chunkOverlap}
                      onChange={(e) => setCreateForm(f => ({ ...f, chunkOverlap: parseInt(e.target.value) }))}
                      className="w-full accent-red-500"
                    />
                    <div className="flex justify-between text-xs text-text-muted mt-1">
                      <span>0</span>
                      <span>500</span>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted">
                    Larger chunks retain more context but use more memory. Overlap helps maintain continuity between chunks.
                  </p>
                </div>
              )}
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
                onClick={handleCreateLibrary}
                disabled={creating || !createForm.name.trim()}
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
                    Create Library
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
                <h2 className="text-xl font-bold">Delete Library</h2>
              </div>
              <p className="text-text-secondary mb-2">
                Are you sure you want to delete <span className="text-text-primary font-medium">{deleteConfirm.name}</span>?
              </p>
              <p className="text-sm text-text-muted mb-6">
                This will permanently delete all {deleteConfirm.documentCount} documents and their embeddings. This action cannot be undone.
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
                  onClick={() => handleDeleteLibrary(deleteConfirm)}
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
                      Delete Library
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
        aria-label="Create Library"
      >
        <Plus size={24} />
      </button>
    </motion.div>
  );
}
