'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save,
  Undo2,
  Redo2,
  Play,
  Settings,
  Share2,
  Download,
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  MoreHorizontal,
  GitFork,
  Trash2,
  Eye,
  EyeOff,
  PanelLeft,
  PanelRight,
  Blocks,
  Plus,
  MessageSquare,
  Workflow,
  Database,
} from 'lucide-react';
import { useGraphStore } from '@/lib/stores/graphStore';
import { ConfirmModal } from '@/components/ui/Modal';

interface GraphHeaderProps {
  onTogglePalette?: () => void;
  onToggleConfig?: () => void;
  onToggleStateManager?: () => void;
  showPalette?: boolean;
  showConfig?: boolean;
  showStateManager?: boolean;
}

/**
 * GraphHeader Component
 * 
 * Header toolbar for the graph editor.
 * Contains graph name, save button, undo/redo, validation status, etc.
 */
export default function GraphHeader({ onTogglePalette, onToggleConfig, onToggleStateManager, showPalette, showConfig, showStateManager }: GraphHeaderProps) {
  const router = useRouter();
  const {
    metadata,
    updateMetadata,
    isDirty,
    isSaving,
    isLoading,
    isValid,
    validationErrors,
    saveGraph,
    newGraph,
    undo,
    redo,
    history,
  } = useGraphStore();

  const [showMenu, setShowMenu] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);

  const handleSave = useCallback(async () => {
    setSaveError(null);
    try {
      const graphId = await saveGraph();
      // Update URL if this is a new graph
      if (!metadata.graphId && graphId) {
        router.replace(`/studio/${graphId}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
    }
  }, [saveGraph, metadata.graphId, router]);

  const handleNewClick = useCallback(() => {
    if (isDirty) {
      setShowUnsavedConfirm(true);
    } else {
      newGraph();
      router.replace('/studio');
    }
  }, [isDirty, newGraph, router]);

  const handleNewConfirm = useCallback(() => {
    newGraph();
    router.replace('/studio');
    setShowUnsavedConfirm(false);
  }, [newGraph, router]);

  const handleExport = useCallback(() => {
    const { nodes, edges, metadata } = useGraphStore.getState();
    const exportData = {
      name: metadata.name,
      description: metadata.description,
      nodes: nodes.filter((n: { id: string }) => !['__start__', '__end__'].includes(n.id)),
      edges,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metadata.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return (
    <motion.header 
      className="h-14 bg-bg-elevated border-b border-border flex items-center px-3 lg:px-4 gap-2 lg:gap-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Mobile: Nodes palette toggle */}
      {onTogglePalette && (
        <button
          onClick={onTogglePalette}
          className={`lg:hidden p-2 rounded-lg transition-colors ${
            showPalette ? 'bg-red-500/20 text-red-400' : 'text-text-secondary hover:bg-bg-secondary'
          }`}
          title="Toggle nodes palette"
        >
          <Blocks className="w-5 h-5" />
        </button>
      )}

      {/* Back to Chat / Logo */}
      <div className="hidden lg:flex items-center gap-3">
        <Link 
          href="/"
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
          title="Back to Chat"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
            <Image 
              src="/logo.png" 
              alt="Red" 
              width={32} 
              height={32}
              className="w-full h-full object-cover"
            />
          </div>
        </Link>
        <div className="w-px h-6 bg-bg-tertiary" />
      </div>

      {/* Graph Name */}
      <div className="flex items-center gap-2 lg:gap-3 flex-1 min-w-0">
        {isEditingName ? (
          <input
            type="text"
            value={metadata.name}
            onChange={(e) => updateMetadata({ name: e.target.value })}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            autoFocus
            className="bg-bg-secondary border border-border-hover text-sm lg:text-lg font-medium text-text-primary focus:outline-none focus:ring-2 focus:ring-red-500/50 rounded px-2 py-1 max-w-[200px] lg:max-w-[300px] w-full"
            placeholder="Untitled Graph"
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-sm lg:text-lg font-medium text-text-primary hover:text-text-primary truncate max-w-[120px] sm:max-w-[160px] lg:max-w-[300px] text-left"
            title="Click to edit name"
          >
            {metadata.name || 'Untitled Graph'}
          </button>
        )}
        
        {/* Graph Type Toggle */}
        <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5 border border-border">
          <button
            onClick={() => updateMetadata({ graphType: 'agent' })}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              metadata.graphType === 'agent'
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            title="Agent: Interactive chat graph that requires user input"
          >
            <MessageSquare className="w-3 h-3" />
            <span className="hidden md:inline">Agent</span>
          </button>
          <button
            onClick={() => updateMetadata({ graphType: 'workflow' })}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              metadata.graphType === 'workflow'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-text-muted hover:text-text-secondary'
            }`}
            title="Workflow: Automated graph for automations (no input required)"
          >
            <Workflow className="w-3 h-3" />
            <span className="hidden md:inline">Workflow</span>
          </button>
        </div>
        
        {/* Status indicators - hide on very small screens */}
        <div className="hidden sm:flex items-center gap-2">
          {isDirty && !isSaving && (
            <span className="text-xs text-amber-500 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="hidden md:inline">Unsaved</span>
            </span>
          )}
          {isSaving && (
            <span className="text-xs text-blue-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden md:inline">Saving...</span>
            </span>
          )}
          {!isDirty && !isSaving && metadata.graphId && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              <span className="hidden md:inline">Saved</span>
            </span>
          )}
        </div>
      </div>

      {/* Validation Status - hidden on mobile */}
      {!isValid && validationErrors.length > 0 && (
        <div className="relative group hidden md:block">
          <button className="flex items-center gap-1.5 text-amber-500 hover:text-amber-400 transition-colors">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{validationErrors.length} issues</span>
          </button>
          
          {/* Tooltip with errors */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-bg-secondary border border-border rounded-lg shadow-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
            <div className="text-xs font-medium text-text-secondary mb-2">Validation Issues:</div>
            <ul className="space-y-1">
              {validationErrors.map((error: string, i: number) => (
                <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1 lg:gap-2">
        {/* Undo/Redo - hidden on small mobile */}
        <div className="hidden sm:flex items-center border-r border-border pr-2 mr-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-2 rounded transition-colors ${
              canUndo
                ? 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                : 'text-text-disabled cursor-not-allowed'
            }`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-2 rounded transition-colors ${
              canRedo
                ? 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                : 'text-text-disabled cursor-not-allowed'
            }`}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* State Manager Toggle */}
        {onToggleStateManager && (
          <button
            onClick={onToggleStateManager}
            className={`p-2 rounded transition-colors ${
              showStateManager ? 'bg-cyan-500/20 text-cyan-400' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
            }`}
            title="Toggle State Manager"
          >
            <Database className="w-4 h-4" />
          </button>
        )}

        {/* More Menu - visible on all screen sizes */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-bg-secondary border border-border rounded-lg shadow-lg py-1 z-50">
                {/* View Options */}
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">View</div>
                <button
                  onClick={() => { updateMetadata({ isPublic: !metadata.isPublic }); setShowMenu(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    metadata.isPublic ? 'text-green-400' : 'text-text-secondary hover:bg-bg-tertiary'
                  }`}
                >
                  {metadata.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  {metadata.isPublic ? 'Public' : 'Private'}
                </button>
                
                <hr className="my-1 border-border" />
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wide">Actions</div>
                
                {/* Test Graph */}
                <button
                  onClick={() => setShowMenu(false)}
                  disabled={!isValid || !metadata.graphId}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    isValid && metadata.graphId
                      ? 'text-green-400 hover:bg-bg-tertiary'
                      : 'text-text-muted cursor-not-allowed'
                  }`}
                  title={!metadata.graphId ? 'Save graph first' : !isValid ? 'Fix validation errors first' : 'Test graph'}
                >
                  <Play className="w-4 h-4" />
                  Test Graph
                </button>
                
                <button
                  onClick={() => { handleNewClick(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  New Graph
                </button>
                <Link
                  href="/studio/create-node"
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Node
                </Link>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => { handleExport(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export JSON
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Import JSON
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
                {metadata.graphId && (
                  <button
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
                  >
                    <GitFork className="w-4 h-4" />
                    Fork Graph
                  </button>
                )}
                {metadata.graphId && (
                  <>
                    <hr className="my-1 border-border" />
                    <button
                      onClick={() => setShowMenu(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Graph
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isSaving || isLoading || !isDirty}
          className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
            isDirty && !isSaving
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-bg-secondary text-text-muted cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Save</span>
        </button>

        {/* Mobile: Config panel toggle */}
        {onToggleConfig && (
          <button
            onClick={onToggleConfig}
            className={`lg:hidden p-2 rounded-lg transition-colors ${
              showConfig ? 'bg-red-500/20 text-red-400' : 'text-text-secondary hover:bg-bg-secondary'
            }`}
            title="Toggle config panel"
          >
            <PanelRight className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Save Error Toast */}
      {saveError && (
        <div className="fixed bottom-4 right-4 bg-red-900/90 border border-red-700 text-red-200 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
          <AlertCircle className="w-5 h-5" />
          <span>{saveError}</span>
          <button
            onClick={() => setSaveError(null)}
            className="text-red-300 hover:text-text-primary"
          >
            ×
          </button>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      <ConfirmModal
        isOpen={showUnsavedConfirm}
        onClose={() => setShowUnsavedConfirm(false)}
        onConfirm={handleNewConfirm}
        title="Unsaved Changes"
        message="You have unsaved changes. Create a new graph anyway?"
        confirmText="Create New"
        cancelText="Cancel"
        variant="warning"
      />
    </motion.header>
  );
}
