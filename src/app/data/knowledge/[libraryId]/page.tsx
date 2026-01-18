'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Search, 
  Loader2, 
  AlertCircle,
  Plus,
  FileText,
  Globe,
  Upload,
  Trash2,
  Lock,
  Users,
  Eye,
  FolderOpen,
  Settings,
  Archive,
  X,
  File,
  Link as LinkIcon,
  Type,
  Download,
  ExternalLink,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { pageVariants, staggerContainerVariants, staggerItemVariants } from '@/lib/animations';

interface DocumentInfo {
  documentId: string;
  title: string;
  sourceType: 'file' | 'url' | 'text' | 'api' | 'conversation';
  source?: string;
  mimeType?: string;
  fileSize?: number;
  chunkCount: number;
  charCount: number;
  addedAt: string;
  addedBy?: string;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
}

interface LibraryDetails {
  libraryId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  access: 'private' | 'shared' | 'public';
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  documents: DocumentInfo[];
  documentCount: number;
  totalChunks: number;
  totalSize: number;
  searchCount: number;
  lastSearchAt?: string;
  lastUpdatedAt: string;
  createdAt: string;
  isOwned: boolean;
  canWrite: boolean;
}

interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata?: {
    documentId?: string;
    title?: string;
    chunkIndex?: number;
    totalChunks?: number;
    [key: string]: unknown;
  };
}

type AddDocumentMode = 'text' | 'url' | 'file';

export default function LibraryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const libraryId = params.libraryId as string;

  const [library, setLibrary] = useState<LibraryDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);

  // Add document state
  const [showAddDocument, setShowAddDocument] = useState(false);
  const [addMode, setAddMode] = useState<AddDocumentMode>('text');
  const [addForm, setAddForm] = useState({
    title: '',
    content: '',
    url: '',
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // File upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);

  // Delete state
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<DocumentInfo | null>(null);

  // Document viewer state
  const [selectedDocument, setSelectedDocument] = useState<DocumentInfo | null>(null);
  const [documentChunks, setDocumentChunks] = useState<Array<{ id: string; text: string; chunkIndex: number }>>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  // Library settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({ name: '', description: '', access: 'private' as 'private' | 'shared' | 'public' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Library delete state
  const [showDeleteLibrary, setShowDeleteLibrary] = useState(false);
  const [deletingLibrary, setDeletingLibrary] = useState(false);

  // Document clone state
  const [cloneDoc, setCloneDoc] = useState<DocumentInfo | null>(null);
  const [availableLibraries, setAvailableLibraries] = useState<Array<{ libraryId: string; name: string }>>([]);
  const [cloneTargetLibrary, setCloneTargetLibrary] = useState<string>('');
  const [cloning, setCloning] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const documentsPerPage = 12;

  const fetchLibrary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/libraries/${libraryId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Library not found');
        }
        throw new Error('Failed to fetch library');
      }
      const data = await response.json();
      setLibrary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  // Check for settings query parameter to open settings modal
  useEffect(() => {
    if (searchParams.get('settings') === 'true' && library) {
      setSettingsForm({
        name: library.name,
        description: library.description || '',
        access: library.access,
      });
      setShowSettings(true);
      // Clear the query param from URL without triggering a reload
      router.replace(`/knowledge/${libraryId}`, { scroll: false });
    }
  }, [searchParams, library, libraryId, router]);

  // Poll for processing status updates on pending/processing documents
  useEffect(() => {
    if (!library) return;
    
    const processingDocs = library.documents.filter(
      doc => doc.processingStatus === 'pending' || doc.processingStatus === 'processing'
    );
    
    if (processingDocs.length === 0) return;

    const pollInterval = setInterval(async () => {
      let hasUpdates = false;
      
      for (const doc of processingDocs) {
        try {
          const response = await fetch(
            `/api/v1/libraries/${libraryId}/documents/${doc.documentId}/process`
          );
          if (response.ok) {
            const status = await response.json();
            if (status.processingStatus !== doc.processingStatus) {
              hasUpdates = true;
            }
          }
        } catch {
          // Ignore polling errors
        }
      }
      
      if (hasUpdates) {
        fetchLibrary(); // Refresh to get updated statuses
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [library, libraryId, fetchLibrary]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setSearching(true);
      const response = await fetch(`/api/v1/libraries/${libraryId}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          limit: 10,
          threshold: 0.5,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      // Map API response to SearchResult interface
      const mappedResults: SearchResult[] = (data.results || []).map((r: any) => ({
        documentId: r.metadata?.documentId || r.id,
        title: r.metadata?.title || 'Unknown',
        content: r.text || '',
        score: r.score,
        metadata: r.metadata,
      }));
      setSearchResults(mappedResults);
      setSearchTime(data.searchTime);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const fetchDocumentChunks = async (doc: DocumentInfo) => {
    try {
      setSelectedDocument(doc);
      setLoadingChunks(true);
      setDocumentChunks([]);

      const response = await fetch(
        `/api/v1/libraries/${libraryId}/documents/${doc.documentId}/chunks`
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch chunks');
      }

      setDocumentChunks(data.chunks || []);
    } catch (err) {
      console.error('Failed to fetch document chunks:', err);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleAddDocument = async () => {
    if (!addForm.title.trim()) {
      setAddError('Title is required');
      return;
    }

    let content = '';
    const sourceType: 'text' | 'url' | 'file' = addMode;
    let source: string | undefined;

    if (addMode === 'text') {
      if (!addForm.content.trim()) {
        setAddError('Content is required');
        return;
      }
      content = addForm.content;
    } else if (addMode === 'url') {
      if (!addForm.url.trim()) {
        setAddError('URL is required');
        return;
      }
      // Fetch URL content
      try {
        setAdding(true);
        setAddError(null);
        
        const fetchResponse = await fetch('/api/v1/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: addForm.url }),
        });
        
        if (!fetchResponse.ok) {
          throw new Error('Failed to fetch URL content');
        }
        
        const fetchData = await fetchResponse.json();
        content = fetchData.content;
        source = addForm.url;
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Failed to fetch URL');
        setAdding(false);
        return;
      }
    }

    try {
      setAdding(true);
      setAddError(null);

      const response = await fetch(`/api/v1/libraries/${libraryId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: addForm.title,
          content,
          sourceType,
          source,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add document');
      }

      // Success - close modal and refresh
      setShowAddDocument(false);
      setAddForm({ title: '', content: '', url: '' });
      fetchLibrary();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setAdding(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFile(file);
    setAddForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/, '') }));

    try {
      setAdding(true);
      setAddError(null);

      // Upload file to server for parsing
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/v1/libraries/${libraryId}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload file');
      }

      setShowAddDocument(false);
      setUploadingFile(null);
      fetchLibrary();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      setDeleteConfirmDoc(null);
      setDeletingDocId(documentId);
      const response = await fetch(
        `/api/v1/libraries/${libraryId}/documents?documentId=${documentId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      fetchLibrary();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingDocId(null);
    }
  };

  // Settings handlers
  const openSettings = () => {
    if (library) {
      setSettingsForm({
        name: library.name,
        description: library.description || '',
        access: library.access,
      });
      setShowSettings(true);
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsForm.name.trim()) return;

    try {
      setSavingSettings(true);
      const response = await fetch(`/api/v1/libraries/${libraryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settingsForm.name,
          description: settingsForm.description,
          access: settingsForm.access,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update library');
      }

      setShowSettings(false);
      fetchLibrary();
    } catch (err) {
      console.error('Settings save error:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete library handler
  const handleDeleteLibrary = async () => {
    try {
      setDeletingLibrary(true);
      const response = await fetch(`/api/v1/libraries/${libraryId}?permanent=true`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete library');
      }

      router.push('/data/knowledge');
    } catch (err) {
      console.error('Delete library error:', err);
      setDeletingLibrary(false);
    }
  };

  // Export library handler
  const handleExportLibrary = async () => {
    if (!library) return;
    
    try {
      const exportData = {
        library: {
          name: library.name,
          description: library.description,
          access: library.access,
          exportedAt: new Date().toISOString(),
        },
        documents: library.documents.map(doc => ({
          title: doc.title,
          sourceType: doc.sourceType,
          source: doc.source,
          addedAt: doc.addedAt,
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${library.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Export document handler - downloads original file if available
  const handleExportDocument = async (doc: DocumentInfo) => {
    try {
      // First, check if original file exists in GridFS
      const fileCheck = await fetch(
        `/api/v1/libraries/${libraryId}/documents/${doc.documentId}/file`,
        { method: 'HEAD' }
      );

      if (fileCheck.ok) {
        // Original file available - download it directly
        const link = window.document.createElement('a');
        link.href = `/api/v1/libraries/${libraryId}/documents/${doc.documentId}/file?download=true`;
        link.download = doc.source || doc.title;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        return;
      }

      // Fallback: Export as JSON with merged content
      const fullResponse = await fetch(
        `/api/v1/libraries/${libraryId}/documents/${doc.documentId}/full`
      );
      const fullData = await fullResponse.json();
      
      const exportData = {
        title: doc.title,
        sourceType: doc.sourceType,
        source: doc.source,
        addedAt: doc.addedAt,
        content: fullData.content || '',
        format: fullData.format || 'text',
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${doc.title.replace(/[^a-z0-9]/gi, '_')}.json`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export document error:', err);
    }
  };

  // Clone document handler
  const openCloneModal = async (doc: DocumentInfo) => {
    setCloneDoc(doc);
    setCloneTargetLibrary('');
    
    // Fetch available libraries
    try {
      const response = await fetch('/api/v1/libraries');
      const data = await response.json();
      // Filter out current library
      setAvailableLibraries(
        (data.libraries || [])
          .filter((lib: any) => lib.libraryId !== libraryId)
          .map((lib: any) => ({ libraryId: lib.libraryId, name: lib.name }))
      );
    } catch (err) {
      console.error('Failed to fetch libraries:', err);
    }
  };

  const handleCloneDocument = async () => {
    if (!cloneDoc || !cloneTargetLibrary) return;

    try {
      setCloning(true);
      
      // Fetch the original document's chunks
      const chunksResponse = await fetch(
        `/api/v1/libraries/${libraryId}/documents/${cloneDoc.documentId}/chunks`
      );
      const chunksData = await chunksResponse.json();
      const content = (chunksData.chunks || []).map((c: any) => c.text).join('\n\n');

      // Create new document in target library
      const response = await fetch(`/api/v1/libraries/${cloneTargetLibrary}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${cloneDoc.title} (Copy)`,
          content,
          sourceType: cloneDoc.sourceType,
          source: cloneDoc.source,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to clone document');
      }

      setCloneDoc(null);
    } catch (err) {
      console.error('Clone error:', err);
    } finally {
      setCloning(false);
    }
  };

  // Bulk file upload handler
  const handleBulkFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAdding(true);
    setAddError(null);

    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/v1/libraries/${libraryId}/upload`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        failCount++;
      }
    }

    setAdding(false);
    setShowAddDocument(false);
    fetchLibrary();
    
    if (failCount > 0) {
      console.log(`Uploaded ${successCount} files, ${failCount} failed`);
    }
  };

  // Pagination
  const totalPages = Math.ceil((library?.documents?.length || 0) / documentsPerPage);
  const paginatedDocuments = library?.documents?.slice(
    (currentPage - 1) * documentsPerPage,
    currentPage * documentsPerPage
  ) || [];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case 'file': return File;
      case 'url': return Globe;
      case 'text': return Type;
      case 'api': return LinkIcon;
      default: return FileText;
    }
  };

  if (loading) {
    return (
      <div className="min-h-full bg-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (error || !library) {
    return (
      <div className="min-h-full bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-text-primary mb-2">
            {error || 'Library not found'}
          </h2>
          <Link
            href="/data/knowledge"
            className="text-red-500 hover:text-red-400 transition-colors"
          >
            ← Back to Libraries
          </Link>
        </div>
      </div>
    );
  }

  const AccessIcon = library.access === 'private' ? Lock : library.access === 'shared' ? Users : Eye;

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
          {/* Top row: Back button, library info, action buttons */}
          <div className="flex flex-col gap-3 mb-4">
            {/* Mobile: stacked layout, Desktop: single row */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/data/knowledge"
                className="p-2 hover:bg-bg-secondary rounded-lg transition-colors shrink-0"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: library.color || '#ef4444' }}
                >
                  <FolderOpen size={20} className="text-text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold truncate">{library.name}</h1>
                  <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-text-secondary flex-wrap">
                    <AccessIcon size={14} className="shrink-0" />
                    <span className="capitalize">{library.access}</span>
                    <span className="hidden md:inline">•</span>
                    <span className="md:hidden">/</span>
                    <span>{library.documentCount} docs</span>
                    <span className="hidden md:inline">•</span>
                    <span className="md:hidden">/</span>
                    <span>{library.totalChunks} chunks</span>
                  </div>
                </div>
              </div>
              {/* Desktop action buttons */}
              {library.canWrite && (
                <div className="hidden md:flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleExportLibrary}
                    className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                    title="Export Library"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={openSettings}
                    className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                    title="Library Settings"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => setShowDeleteLibrary(true)}
                    className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary hover:text-red-500"
                    title="Delete Library"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    onClick={() => setShowAddDocument(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                  >
                    <Plus size={18} />
                    Add Document
                  </button>
                </div>
              )}
            </div>
            {/* Mobile action buttons row */}
            {library.canWrite && (
              <div className="flex md:hidden items-center gap-2">
                <button
                  onClick={handleExportLibrary}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                  title="Export Library"
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={openSettings}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                  title="Library Settings"
                >
                  <Settings size={18} />
                </button>
                <button
                  onClick={() => setShowDeleteLibrary(true)}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary hover:text-red-500"
                  title="Delete Library"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  onClick={() => setShowAddDocument(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors ml-auto"
                >
                  <Plus size={18} />
                  <span>Add</span>
                </button>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div className="flex gap-2 md:gap-3">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 text-sm md:text-base"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
              className="px-3 md:px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              <span className="hidden md:inline">Search</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search Results */}
        <AnimatePresence>
          {searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-text-secondary">
                  {searchResults.length} results {searchTime && `(${searchTime}ms)`}
                </h3>
                <button
                  onClick={() => { setSearchResults([]); setSearchQuery(''); }}
                  className="text-xs text-text-muted hover:text-text-primary"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-3">
                {searchResults.map((result, idx) => (
                  <div
                    key={`${result.id}-${idx}`}
                    className="p-4 bg-bg-elevated border border-border rounded-lg hover:border-border-hover transition-colors cursor-pointer"
                    onClick={() => {
                      // Find and view the source document
                      const doc = library.documents.find(d => d.documentId === result.metadata?.documentId);
                      if (doc) {
                        fetchDocumentChunks(doc);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{result.metadata?.title || 'Unknown Document'}</span>
                        {result.metadata?.chunkIndex !== undefined && result.metadata?.totalChunks && (
                          <span className="text-xs text-text-disabled">
                            (chunk {result.metadata.chunkIndex + 1}/{result.metadata.totalChunks})
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-text-muted">
                        {(result.score * 100).toFixed(1)}% match
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary line-clamp-3">{result.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Documents Grid */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-text-secondary mb-3">
            Documents ({library.documents.length})
          </h3>
        </div>

        {library.documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-text-disabled mx-auto mb-4" />
            <h3 className="text-lg font-medium text-text-secondary mb-2">No documents yet</h3>
            <p className="text-text-muted text-sm mb-4">
              Add documents to start building your knowledge base
            </p>
            {library.canWrite && (
              <button
                onClick={() => setShowAddDocument(true)}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                Add Your First Document
              </button>
            )}
          </div>
        ) : (
          <>
            <motion.div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={staggerContainerVariants}
              initial="initial"
              animate="animate"
            >
              {paginatedDocuments.map((doc) => {
                const SourceIcon = getSourceIcon(doc.sourceType);
                return (
                  <motion.div
                    key={doc.documentId}
                    className="p-3 md:p-4 bg-bg-elevated border border-border rounded-lg hover:border-red-500/50 transition-colors group cursor-pointer"
                    variants={staggerItemVariants}
                    onClick={() => fetchDocumentChunks(doc)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5 md:mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                          doc.processingStatus === 'pending' || doc.processingStatus === 'processing'
                            ? 'bg-amber-500/10'
                            : doc.processingStatus === 'failed'
                            ? 'bg-red-500/10'
                            : 'bg-bg-secondary group-hover:bg-red-500/10'
                        }`}>
                          {doc.processingStatus === 'pending' || doc.processingStatus === 'processing' ? (
                            <Loader2 size={16} className="text-amber-400 animate-spin" />
                          ) : doc.processingStatus === 'failed' ? (
                            <AlertCircle size={16} className="text-red-400" />
                          ) : (
                            <SourceIcon size={16} className="text-text-secondary group-hover:text-red-400 transition-colors" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-medium text-sm md:text-base truncate group-hover:text-red-400 transition-colors">{doc.title}</h4>
                          <p className="text-xs text-text-muted">
                            {doc.processingStatus === 'pending' || doc.processingStatus === 'processing' ? (
                              <span className="text-amber-400">Processing OCR...</span>
                            ) : doc.processingStatus === 'failed' ? (
                              <span className="text-red-400">Processing failed</span>
                            ) : (
                              formatDate(doc.addedAt)
                            )}
                          </p>
                        </div>
                      </div>
                      {library.canWrite && (
                        <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExportDocument(doc); }}
                            className="p-1.5 hover:bg-bg-tertiary rounded transition-all text-text-secondary hover:text-blue-400"
                            title="Export Document"
                          >
                            <Download size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); openCloneModal(doc); }}
                            className="p-1.5 hover:bg-bg-tertiary rounded transition-all text-text-secondary hover:text-green-400"
                            title="Clone to Library"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmDoc(doc); }}
                            disabled={deletingDocId === doc.documentId}
                            className="p-1.5 hover:bg-bg-tertiary rounded transition-all text-text-secondary hover:text-red-500"
                            title="Delete Document"
                          >
                            {deletingDocId === doc.documentId ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 md:gap-4 text-xs text-text-muted">
                      {doc.processingStatus === 'pending' || doc.processingStatus === 'processing' ? (
                        <span className="text-amber-400/70">Extracting text from image...</span>
                      ) : (
                        <>
                          <span>{doc.chunkCount} chunks</span>
                          <span>{doc.charCount.toLocaleString()} chars</span>
                          {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                        </>
                      )}
                    </div>
                    {doc.source && (
                      <p className="mt-1 md:mt-2 text-xs text-text-disabled truncate">{doc.source}</p>
                    )}
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg transition-colors ${
                        currentPage === page
                          ? 'bg-red-500 text-white'
                          : 'hover:bg-bg-secondary text-text-secondary'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Document Modal */}
      <AnimatePresence>
        {showAddDocument && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              className="bg-bg-elevated border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-xl font-bold">Add Document</h2>
                <button
                  onClick={() => { setShowAddDocument(false); setAddError(null); }}
                  className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mode Tabs */}
              <div className="flex border-b border-border">
                {[
                  { mode: 'text' as const, label: 'Text', icon: Type },
                  { mode: 'url' as const, label: 'URL', icon: Globe },
                  { mode: 'file' as const, label: 'File', icon: Upload },
                ].map(({ mode, label, icon: Icon }) => (
                  <button
                    key={mode}
                    onClick={() => setAddMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm transition-colors ${
                      addMode === mode
                        ? 'text-red-500 border-b-2 border-red-500'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </div>

              {/* Form */}
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                {addError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    <AlertCircle size={16} />
                    {addError}
                  </div>
                )}

                {/* Title (for text and url modes) */}
                {addMode !== 'file' && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Document Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={addForm.title}
                      onChange={(e) => setAddForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Enter document title"
                      className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
                    />
                  </div>
                )}

                {/* Text Mode */}
                {addMode === 'text' && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Content <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={addForm.content}
                      onChange={(e) => setAddForm(f => ({ ...f, content: e.target.value }))}
                      placeholder="Paste or type your content here..."
                      rows={10}
                      className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50 resize-none font-mono text-sm"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      {addForm.content.length.toLocaleString()} characters
                    </p>
                  </div>
                )}

                {/* URL Mode */}
                {addMode === 'url' && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={addForm.url}
                      onChange={(e) => setAddForm(f => ({ ...f, url: e.target.value }))}
                      placeholder="https://example.com/article"
                      className="w-full px-4 py-3 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-red-500/50"
                    />
                    <p className="text-xs text-text-muted mt-1">
                      We&apos;ll fetch and extract text content from this URL
                    </p>
                  </div>
                )}

                {/* File Mode */}
                {addMode === 'file' && (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.md,.pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <input
                      type="file"
                      accept=".txt,.md,.pdf,.doc,.docx,.jpg,.jpeg,.png"
                      multiple
                      onChange={handleBulkFileSelect}
                      className="hidden"
                      id="bulk-file-input"
                    />
                    <div className="space-y-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={adding}
                        className="w-full p-8 border-2 border-dashed border-border rounded-lg hover:border-red-500/50 transition-colors flex flex-col items-center gap-3"
                      >
                        {adding ? (
                          <>
                            <Loader2 size={32} className="text-text-secondary animate-spin" />
                            <span className="text-text-secondary">Processing {uploadingFile?.name}...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={32} className="text-text-secondary" />
                            <span className="text-text-secondary">Click to select a file</span>
                            <span className="text-xs text-text-disabled">
                              Supports TXT, MD, PDF, DOC, DOCX, JPG, PNG
                            </span>
                          </>
                        )}
                      </button>
                      <div className="text-center text-sm text-text-muted">or</div>
                      <button
                        onClick={() => document.getElementById('bulk-file-input')?.click()}
                        disabled={adding}
                        className="w-full p-4 bg-bg-secondary border border-border rounded-lg hover:border-green-500/50 hover:bg-green-500/5 transition-colors flex items-center justify-center gap-2 text-text-secondary hover:text-green-400"
                      >
                        <Plus size={18} />
                        Bulk Upload Multiple Files
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {addMode !== 'file' && (
                <div className="p-6 border-t border-border flex gap-3">
                  <button
                    onClick={() => { setShowAddDocument(false); setAddError(null); }}
                    className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                    disabled={adding}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDocument}
                    disabled={adding}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {adding ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        Add Document
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Document Viewer Modal */}
      <AnimatePresence>
        {selectedDocument && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setSelectedDocument(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bg-primary border border-border rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Preview Badge */}
              <div className="px-6 pt-4">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-400 text-xs">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Chunk Preview - Showing raw chunks without merge</span>
                  </div>
                  <Link
                    href={`/data/knowledge/${libraryId}/documents/${selectedDocument.documentId}`}
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 text-xs font-medium"
                  >
                    View Full Document
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Header */}
              <div className="p-6 pb-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-4">
                    <h2 className="text-xl font-semibold truncate text-center">{selectedDocument.title}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="p-2 hover:bg-bg-tertiary rounded-lg transition-colors flex-shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-4 text-sm text-text-muted">
                  {selectedDocument.processingStatus === 'pending' || selectedDocument.processingStatus === 'processing' ? (
                    <span className="flex items-center gap-2 text-amber-400">
                      <Loader2 size={14} className="animate-spin" />
                      Processing OCR...
                    </span>
                  ) : selectedDocument.processingStatus === 'failed' ? (
                    <span className="flex items-center gap-2 text-red-400">
                      <AlertCircle size={14} />
                      Processing failed
                    </span>
                  ) : (
                    <>
                      <span>{selectedDocument.chunkCount} chunks</span>
                      <span>{selectedDocument.charCount.toLocaleString()} characters</span>
                    </>
                  )}
                  {selectedDocument.source && (
                    <span className="truncate max-w-xs">{selectedDocument.source}</span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {loadingChunks ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
                    <span className="ml-3 text-text-muted">Loading document chunks...</span>
                  </div>
                ) : documentChunks.length === 0 ? (
                  <div className="text-center py-12 text-text-muted">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No chunks found for this document</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documentChunks.map((chunk, idx) => (
                      <div
                        key={chunk.id}
                        className="p-4 bg-bg-elevated border border-border rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-text-muted">
                            Chunk {chunk.chunkIndex + 1} of {documentChunks.length}
                          </span>
                          <span className="text-xs text-text-disabled">
                            {chunk.text.length.toLocaleString()} chars
                          </span>
                        </div>
                        <p className="text-sm text-text-secondary whitespace-pre-wrap">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border flex items-center justify-between text-sm text-text-muted">
                <span>Added {formatDate(selectedDocument.addedAt)}</span>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/data/knowledge/${libraryId}/documents/${selectedDocument.documentId}`}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors font-medium"
                  >
                    View
                  </Link>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setDeleteConfirmDoc(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bg-primary border border-border rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <Trash2 className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Delete Document</h3>
                    <p className="text-sm text-text-muted">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-text-secondary mb-6">
                  Are you sure you want to delete <span className="text-text-primary font-medium">{deleteConfirmDoc.title}</span>?
                  This will remove all {deleteConfirmDoc.chunkCount} chunks from the vector store.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmDoc(null)}
                    className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(deleteConfirmDoc.documentId)}
                    disabled={deletingDocId === deleteConfirmDoc.documentId}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingDocId === deleteConfirmDoc.documentId ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setShowSettings(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bg-primary border border-border rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Library Settings</h3>
                <p className="text-sm text-text-muted">Update library name, description, and access</p>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Name</label>
                  <input
                    type="text"
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg focus:outline-none focus:border-red-500 transition-colors"
                    placeholder="Library name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Description</label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg focus:outline-none focus:border-red-500 transition-colors resize-none"
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">Access Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'private' as const, label: 'Private', icon: Lock },
                      { value: 'shared' as const, label: 'Shared', icon: Users },
                      { value: 'public' as const, label: 'Public', icon: Eye },
                    ]).map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setSettingsForm(f => ({ ...f, access: value }))}
                        className={`p-3 rounded-lg border transition-colors flex flex-col items-center gap-2 ${
                          settingsForm.access === value
                            ? 'border-red-500 bg-red-500/10 text-red-400'
                            : 'border-border hover:border-border-hover text-text-secondary'
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings || !settingsForm.name.trim()}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Library Modal */}
      <AnimatePresence>
        {showDeleteLibrary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setShowDeleteLibrary(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bg-primary border border-red-500/50 rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <Archive className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-400">Delete Library</h3>
                    <p className="text-sm text-text-muted">This action is permanent</p>
                  </div>
                </div>
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg mb-4">
                  <p className="text-sm text-red-300">
                    You are about to permanently delete <span className="font-bold">{library.name}</span> and all its content:
                  </p>
                  <ul className="mt-2 text-sm text-red-400 list-disc list-inside">
                    <li>{library.documentCount} documents</li>
                    <li>{library.totalChunks} vector chunks</li>
                  </ul>
                </div>
                <p className="text-text-secondary text-sm mb-6">
                  This will remove all documents and their vectors from the database. This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteLibrary(false)}
                    className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteLibrary}
                    disabled={deletingLibrary}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {deletingLibrary ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={18} />
                        Delete Forever
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clone Document Modal */}
      <AnimatePresence>
        {cloneDoc && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setCloneDoc(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-bg-primary border border-border rounded-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold">Clone Document</h3>
                <p className="text-sm text-text-muted">Copy "{cloneDoc.title}" to another library</p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-text-secondary mb-2">Target Library</label>
                {availableLibraries.length === 0 ? (
                  <p className="text-sm text-text-muted p-4 bg-bg-elevated rounded-lg text-center">
                    No other libraries available
                  </p>
                ) : (
                  <select
                    value={cloneTargetLibrary}
                    onChange={(e) => setCloneTargetLibrary(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg focus:outline-none focus:border-red-500 transition-colors"
                  >
                    <option value="">Select a library...</option>
                    {availableLibraries.map((lib) => (
                      <option key={lib.libraryId} value={lib.libraryId}>
                        {lib.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="p-6 border-t border-border flex gap-3">
                <button
                  onClick={() => setCloneDoc(null)}
                  className="flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloneDocument}
                  disabled={cloning || !cloneTargetLibrary}
                  className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {cloning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Cloning...
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      Clone Document
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
