'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { GraphRunViewer, GraphDefinition, GraphRunState } from './GraphRunViewer';

// ============================================================================
// Types
// ============================================================================

interface GraphRunDrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Called when drawer is closed */
  onClose: () => void;
  /** Graph definition to display */
  graph?: GraphDefinition | null;
  /** Current run state (optional) */
  runState?: GraphRunState;
  /** Called when a node is clicked */
  onNodeClick?: (nodeId: string) => void;
  /** Called when reset button is clicked */
  onReset?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_HEIGHT = 200;
const PEEK_HEIGHT = 80;
const MAX_HEIGHT_PERCENT = 0.93; // 93% of viewport

// ============================================================================
// Component
// ============================================================================

export function GraphRunDrawer({
  isOpen,
  onClose,
  graph,
  runState,
  onNodeClick,
  onReset
}: GraphRunDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [maxHeight, setMaxHeight] = useState(500);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Calculate max height based on viewport
  useEffect(() => {
    const updateMaxHeight = () => {
      setMaxHeight(window.innerHeight * MAX_HEIGHT_PERCENT);
    };
    
    updateMaxHeight();
    window.addEventListener('resize', updateMaxHeight);
    return () => window.removeEventListener('resize', updateMaxHeight);
  }, []);
  
  // Auto-expand when graph starts running
  useEffect(() => {
    if (runState?.status === 'running') {
      setIsExpanded(true);
    }
  }, [runState?.status]);
  
  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Velocity-based detection (flicks)
    if (velocity > 400) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        onClose();
      }
      return;
    }
    if (velocity < -400) {
      setIsExpanded(true);
      return;
    }

    // Position-based fallback
    if (offset > 100) {
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        onClose();
      }
    } else if (offset < -50) {
      setIsExpanded(true);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  if (!isOpen || !graph) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="graph-drawer"
        initial={{ y: '100%' }}
        animate={{ 
          y: 0,
          height: isExpanded ? maxHeight : PEEK_HEIGHT
        }}
        exit={{ y: '100%' }}
        transition={{ 
          type: 'spring', 
          damping: 30, 
          stiffness: 300,
          height: { duration: 0.2 }
        }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-bg-primary border-t border-border rounded-t-2xl shadow-2xl"
        style={{ maxHeight }}
        ref={containerRef}
      >
        {/* Drag Handle */}
        <motion.div
          className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragStart={() => setIsDragging(true)}
          onDragEnd={handleDragEnd}
          onClick={() => !isDragging && toggleExpanded()}
        >
          <div className="w-10 h-1 bg-border-hover rounded-full" />
        </motion.div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-text-primary">
              {graph.name}
            </span>
            {runState && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs font-medium
                ${runState.status === 'running' ? 'bg-accent/20 text-accent animate-pulse' : ''}
                ${runState.status === 'completed' ? 'bg-green-500/20 text-green-500' : ''}
                ${runState.status === 'error' ? 'bg-red-500/20 text-red-500' : ''}
                ${runState.status === 'idle' ? 'bg-bg-tertiary text-text-muted' : ''}
              `}>
                {runState.status === 'running' && 'Live'}
                {runState.status === 'completed' && 'Done'}
                {runState.status === 'error' && 'Error'}
                {runState.status === 'idle' && 'Ready'}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Reset button - show when not running and has run state */}
            {onReset && runState && runState.status !== 'running' && runState.status !== 'idle' && (
              <button
                onClick={onReset}
                className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
                aria-label="Reset graph"
                title="Reset graph progress"
              >
                <RotateCcw className="w-4 h-4 text-text-muted" />
              </button>
            )}
            <button
              onClick={toggleExpanded}
              className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              aria-label={isExpanded ? 'Minimize' : 'Expand'}
            >
              {isExpanded ? (
                <Minimize2 className="w-4 h-4 text-text-muted" />
              ) : (
                <Maximize2 className="w-4 h-4 text-text-muted" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-bg-secondary transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full overflow-y-auto"
              style={{ maxHeight: maxHeight - 100 }}
            >
              <GraphRunViewer
                graph={graph}
                runState={runState}
                onNodeClick={onNodeClick}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed Peek Content */}
        {!isExpanded && runState?.status === 'running' && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <span className="text-text-muted">
                Running: <span className="text-text-primary font-medium">{runState.currentNodeId}</span>
              </span>
              {runState.nodeProgress[runState.currentNodeId || '']?.stepName && (
                <span className="text-text-muted truncate">
                  → {runState.nodeProgress[runState.currentNodeId || ''].stepName}
                </span>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Backdrop */}
      <motion.div
        key="graph-drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-40"
        onClick={onClose}
      />
    </AnimatePresence>
  );
}

export default GraphRunDrawer;
