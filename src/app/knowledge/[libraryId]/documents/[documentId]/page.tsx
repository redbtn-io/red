'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Loader2, 
  AlertCircle,
  FileText,
  Download,
  Maximize2,
  Minimize2,
  Clock,
  Copy,
  Check,
  ExternalLink,
  X,
  File,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { pageVariants } from '@/lib/animations';

interface FullDocument {
  documentId: string;
  title: string;
  content: string;
  format: 'markdown' | 'text' | 'pdf' | 'docx' | 'image' | 'csv' | 'excel';
  sourceType: string;
  source?: string;
  mimeType?: string;
  fileSize?: number;
  charCount: number;
  chunkCount: number;
  addedAt: string;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
  metadata: {
    libraryId: string;
    libraryOverlap: number;
    chunksProcessed: number;
    mergedLength: number;
  };
}

type ViewMode = 'native' | 'text';

export default function FullDocumentPage() {
  const params = useParams();
  const router = useRouter();
  const libraryId = params.libraryId as string;
  const documentId = params.documentId as string;

  const [document, setDocument] = useState<FullDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Original file availability
  const [hasOriginalFile, setHasOriginalFile] = useState(false);
  const [checkingOriginal, setCheckingOriginal] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('native');
  const [originalMarkdown, setOriginalMarkdown] = useState<string | null>(null);

  // Check if original file is available
  const checkOriginalFile = useCallback(async () => {
    try {
      setCheckingOriginal(true);
      const response = await fetch(
        `/api/v1/libraries/${libraryId}/documents/${documentId}/file`,
        { method: 'HEAD' }
      );
      setHasOriginalFile(response.ok);
    } catch {
      setHasOriginalFile(false);
    } finally {
      setCheckingOriginal(false);
    }
  }, [libraryId, documentId]);

  // Fetch original markdown content when document is loaded and has original file
  const fetchOriginalMarkdown = useCallback(async () => {
    if (!document || !hasOriginalFile) return;
    
    // For markdown/text files, fetch the original for proper formatting
    if (document.format === 'markdown' || document.format === 'text') {
      try {
        const fileResponse = await fetch(
          `/api/v1/libraries/${libraryId}/documents/${documentId}/file`
        );
        if (fileResponse.ok) {
          const text = await fileResponse.text();
          setOriginalMarkdown(text);
        }
      } catch {
        // Fallback to chunk-reconstructed content
      }
    }
  }, [document, hasOriginalFile, libraryId, documentId]);

  // Trigger markdown fetch when document and original file status are known
  useEffect(() => {
    if (document && hasOriginalFile && !checkingOriginal) {
      fetchOriginalMarkdown();
    }
  }, [document, hasOriginalFile, checkingOriginal, fetchOriginalMarkdown]);

  const fetchDocument = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/v1/libraries/${libraryId}/documents/${documentId}/full`
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load document');
      }

      setDocument(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setLoading(false);
    }
  }, [libraryId, documentId]);

  useEffect(() => {
    fetchDocument();
    checkOriginalFile();
  }, [fetchDocument, checkOriginalFile]);

  // Poll for processing status updates
  useEffect(() => {
    if (!document) return;
    if (document.processingStatus !== 'pending' && document.processingStatus !== 'processing') return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `/api/v1/libraries/${libraryId}/documents/${documentId}/process`
        );
        if (response.ok) {
          const status = await response.json();
          if (status.processingStatus !== document.processingStatus) {
            fetchDocument(); // Refresh when status changes
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [document, libraryId, documentId, fetchDocument]);

  const handleCopy = async () => {
    if (!document) return;
    
    try {
      // Use original markdown if available, otherwise use reconstructed content
      const contentToCopy = originalMarkdown || document.content;
      await navigator.clipboard.writeText(contentToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownload = () => {
    if (!document) return;

    // If original file is available, download it directly
    if (hasOriginalFile) {
      const link = window.document.createElement('a');
      link.href = `/api/v1/libraries/${libraryId}/documents/${documentId}/file?download=true`;
      link.download = document.source || document.title;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      return;
    }

    // Fallback: download reconstructed text
    const extension = document.format === 'markdown' ? 'md' : 'txt';
    const mimeType = document.format === 'markdown' ? 'text/markdown' : 'text/plain';
    
    const blob = new Blob([document.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${document.title}.${extension}`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleFullscreen = () => {
    // Check if we're on mobile (no fullscreen API support or touch device)
    const isMobile = window.matchMedia('(max-width: 768px)').matches || 
                     !window.document.fullscreenEnabled ||
                     'ontouchstart' in window;
    
    if (isMobile) {
      // Use focus mode on mobile
      setIsFocusMode(prev => !prev);
    } else {
      // Use native fullscreen on desktop
      if (!window.document.fullscreenElement) {
        window.document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        window.document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const exitFocusMode = () => {
    setIsFocusMode(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="flex items-center gap-3 text-text-secondary">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span>Loading document...</span>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-text-primary mb-2">Failed to Load Document</h2>
          <p className="text-text-secondary mb-4">{error || 'Document not found'}</p>
          <Link
            href={`/knowledge/${libraryId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-bg-primary"
      initial="initial"
      animate="animate"
      variants={pageVariants}
    >
      {/* Header - hidden in focus mode on mobile */}
      <header className={`sticky top-0 z-40 bg-bg-primary/95 backdrop-blur-sm border-b border-border transition-all duration-300 ${isFocusMode ? 'md:block hidden' : ''}`}>
        <div className="max-w-6xl mx-auto px-4 py-3 md:py-4">
          {/* Mobile: Stack layout */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <Link
                  href={`/knowledge/${libraryId}`}
                  className="p-2 hover:bg-bg-secondary rounded-lg transition-colors flex-shrink-0"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h1 className="text-base font-semibold text-text-primary truncate">{document.title}</h1>
              </div>
              <button
                onClick={toggleFullscreen}
                className="p-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors flex-shrink-0"
              >
                {isFocusMode ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
                {document.processingStatus === 'pending' || document.processingStatus === 'processing' ? (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Processing OCR...
                  </span>
                ) : document.processingStatus === 'failed' ? (
                  <span className="flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="w-3 h-3" />
                    Processing failed
                  </span>
                ) : (
                  <>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {document.format.toUpperCase()}
                    </span>
                    <span>{document.charCount.toLocaleString()} chars</span>
                    <span>{document.chunkCount} chunks</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCopy}
                  className="p-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  title="Copy"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleDownload}
                  className="p-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Desktop: Original layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/knowledge/${libraryId}`}
                className="p-2 hover:bg-bg-secondary rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-text-primary">{document.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-text-muted">
                  {document.processingStatus === 'pending' || document.processingStatus === 'processing' ? (
                    <span className="flex items-center gap-2 text-amber-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing OCR - extracting text from image...
                    </span>
                  ) : document.processingStatus === 'failed' ? (
                    <span className="flex items-center gap-2 text-red-400">
                      <AlertCircle className="w-4 h-4" />
                      Processing failed - {document.processingError || 'unknown error'}
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {document.format.toUpperCase()}
                      </span>
                      <span>{document.charCount.toLocaleString()} characters</span>
                      <span>{document.chunkCount} chunks merged</span>
                      {document.fileSize && (
                        <span>{formatFileSize(document.fileSize)}</span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors text-sm"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
              
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download
              </button>

              <button
                onClick={toggleFullscreen}
                className="p-2 bg-bg-secondary hover:bg-bg-tertiary rounded-lg transition-colors"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-5 h-5" />
                ) : (
                  <Maximize2 className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Floating exit button for focus mode */}
      <AnimatePresence>
        {isFocusMode && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={exitFocusMode}
            className="fixed top-4 right-4 z-50 p-3 bg-bg-secondary/90 backdrop-blur-sm border border-border rounded-full shadow-lg md:hidden"
          >
            <X className="w-5 h-5 text-text-primary" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Document Content */}
      <main className={`max-w-4xl mx-auto py-6 md:py-8 transition-all duration-300 ${isFocusMode ? 'px-2' : 'px-4'}`}>
        {/* View Mode Toggle - Only show if original file exists and is PDF/DOCX/Image/Excel */}
        {hasOriginalFile && ['pdf', 'docx', 'image', 'excel'].includes(document.format) && (
          <div className="mb-4 flex items-center gap-2 p-2 bg-bg-elevated border border-border rounded-lg">
            <span className="text-xs text-text-muted mr-2">View:</span>
            <button
              onClick={() => setViewMode('native')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'native' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              <File className="w-3.5 h-3.5" />
              Original
            </button>
            <button
              onClick={() => setViewMode('text')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                viewMode === 'text' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Text
            </button>
          </div>
        )}

        {/* Native Viewer (PDF/Image/Excel) */}
        {hasOriginalFile && viewMode === 'native' && ['pdf', 'docx', 'image', 'excel'].includes(document.format) && (
          <div className="mb-4 md:mb-6">
            {document.format === 'pdf' && (
              <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
                <iframe
                  src={`/api/v1/libraries/${libraryId}/documents/${documentId}/file#toolbar=1&navpanes=0`}
                  className="w-full h-[70vh] md:h-[80vh]"
                  title={document.title}
                />
              </div>
            )}
            {document.format === 'image' && (
              <div className="bg-bg-elevated border border-border rounded-xl p-4 flex items-center justify-center">
                { }
                <img
                  src={`/api/v1/libraries/${libraryId}/documents/${documentId}/file`}
                  alt={document.title}
                  className="max-w-full max-h-[80vh] rounded-lg object-contain"
                />
              </div>
            )}
            {document.format === 'docx' && (
              <div className="bg-bg-elevated border border-border rounded-xl p-6 text-center">
                <FileText className="w-16 h-16 text-blue-400 mx-auto mb-4" />
                <p className="text-text-secondary mb-4">
                  Word documents cannot be previewed directly in the browser.
                </p>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-text-primary rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download to View
                </button>
              </div>
            )}
            {document.format === 'excel' && (
              <div className="bg-bg-elevated border border-border rounded-xl p-6 text-center">
                <FileText className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <p className="text-text-secondary mb-4">
                  Excel files cannot be previewed directly in the browser.
                </p>
                <button
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-text-primary rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download to View
                </button>
              </div>
            )}
          </div>
        )}

        {/* Text View Banner */}
        {(viewMode === 'text' || !hasOriginalFile || !['pdf', 'docx', 'image', 'excel'].includes(document.format)) && (
          <>
            {/* Preview Badge */}
            <div className="mb-4 md:mb-6 p-2.5 md:p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-blue-400 text-xs md:text-sm">
                <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                <span>
                  {hasOriginalFile ? 'Extracted Text View' : 'Full Document View'} - Reconstructed from {document.metadata.chunksProcessed} chunks
                </span>
              </div>
              {document.sourceType === 'url' && document.source && (
                <a
                  href={document.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs md:text-sm flex-shrink-0"
                >
                  View Original
                  <ExternalLink className="w-3 h-3 md:w-3.5 md:h-3.5" />
                </a>
              )}
              {document.sourceType === 'file' && document.source && (
                <span className="text-blue-400/70 text-xs md:text-sm truncate">
                  Source: {document.source}
                </span>
              )}
            </div>

            {/* Image OCR Notice */}
            {document.format === 'image' && (
              <div className="mb-4 md:mb-6 p-2.5 md:p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-start gap-2 text-purple-400 text-xs md:text-sm">
                  <FileText className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    This document was created from an image using OCR (Optical Character Recognition). 
                    The text below was extracted from the original image.
                  </span>
                </div>
              </div>
            )}

            {/* Rendered Content */}
            <article className="bg-bg-elevated border border-border rounded-xl p-8">
              {(document.format === 'markdown' || document.format === 'text') ? (
                <div className="prose prose-invert prose-lg max-w-none prose-headings:text-text-primary prose-p:text-text-secondary prose-a:text-blue-400 prose-code:text-pink-400 prose-pre:bg-bg-primary prose-blockquote:border-l-blue-500 prose-img:rounded-lg prose-img:mx-auto">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      img: ({ src, alt, ...props }) => (
                         
                        <img
                          src={src}
                          alt={alt || 'Document image'}
                          className="rounded-lg mx-auto max-w-full"
                          loading="lazy"
                          onError={(e) => {
                            // Handle broken images gracefully
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                          {...props}
                        />
                      ),
                    }}
                  >
                    {originalMarkdown || document.content}
                  </ReactMarkdown>
                </div>
              ) : document.format === 'image' ? (
                <div>
                  <div className="text-center text-text-secondary text-sm mb-4 pb-4 border-b border-border">
                    Extracted Text from Image
                  </div>
                  <div className="text-text-secondary whitespace-pre-wrap font-mono text-sm leading-relaxed">
                    {document.content || 'No text could be extracted from this image.'}
                  </div>
                </div>
              ) : (
                <div className="text-text-secondary whitespace-pre-wrap font-mono text-sm leading-relaxed">
                  {document.content}
                </div>
              )}
            </article>
          </>
        )}

        {/* Metadata Footer */}
        <footer className="mt-4 md:mt-6 p-3 md:p-4 bg-bg-elevated border border-border rounded-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs md:text-sm text-text-muted">
            <div className="flex flex-wrap items-center gap-2 md:gap-4">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                {formatDate(document.addedAt)}
              </span>
              <span>Source: {document.sourceType}</span>
              {document.mimeType && (
                <span className="hidden md:inline">Type: {document.mimeType}</span>
              )}
            </div>
            <div className="text-text-disabled">
              {document.charCount.toLocaleString()} → {document.metadata.mergedLength.toLocaleString()} chars
            </div>
          </div>
        </footer>
      </main>
    </motion.div>
  );
}
