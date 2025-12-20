'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';

interface BottomSheetProps {
  /** Whether the sheet has content (controls visibility) */
  hasContent: boolean;
  /** Increment this to force expand (e.g., when same item is tapped again) */
  expandTrigger?: number;
  /** Called when user dismisses the sheet completely */
  onDismiss: () => void;
  children: React.ReactNode;
  /** Content to show when collapsed (peek state) */
  peekContent?: React.ReactNode;
  /** Height when peeking (default: 72px) */
  peekHeight?: number;
}

/**
 * Mobile bottom sheet component with drag-to-expand functionality.
 */
export function BottomSheet({
  hasContent,
  expandTrigger = 0,
  onDismiss,
  children,
  peekContent,
  peekHeight = 72,
}: BottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef(expandTrigger);

  // Expand when trigger changes (including on same-item re-selection)
  useEffect(() => {
    if (hasContent && expandTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = expandTrigger;
      setIsExpanded(true);
    }
  }, [hasContent, expandTrigger]);

  // Auto-expand on first content
  useEffect(() => {
    if (hasContent) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [hasContent]);

  const collapse = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const expand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    // Velocity-based detection (flicks)
    if (velocity > 400) {
      collapse();
      return;
    }
    if (velocity < -400) {
      expand();
      return;
    }

    // Position-based fallback
    if (offset > 80) {
      collapse();
    } else if (offset < -40) {
      expand();
    }
    // Otherwise snap back to current state (handled by animate prop)
  };

  const handleTap = () => {
    if (!isDragging) {
      if (isExpanded) {
        collapse();
      } else {
        expand();
      }
    }
  };

  // Don't render anything on desktop or when no content
  if (!hasContent) return null;

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="backdrop"
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={collapse}
          />
        )}
      </AnimatePresence>

      {/* Sheet */}
      <motion.div
        ref={sheetRef}
        className="fixed left-0 right-0 bottom-0 z-50 lg:hidden"
        style={{ 
          height: '80vh',
          touchAction: 'none',
        }}
        initial={false}
        animate={{ 
          y: isExpanded ? 0 : `calc(80vh - ${peekHeight}px)`,
        }}
        transition={{
          type: 'spring',
          damping: 30,
          stiffness: 300,
        }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
      >
        <div className="h-full bg-[#0f0f0f] rounded-t-2xl border-t border-x border-[#2a2a2a] shadow-2xl flex flex-col">
          {/* Handle + Header - fixed at top */}
          <div className="flex-shrink-0 bg-[#0f0f0f] rounded-t-2xl">
            {/* Handle */}
            <div 
              className="py-3 cursor-grab active:cursor-grabbing"
              onClick={handleTap}
            >
              <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto" />
            </div>

            {/* Peek Content - shown when collapsed */}
            <motion.div 
              className="px-4 overflow-hidden"
              animate={{ 
                opacity: isExpanded ? 0 : 1, 
                height: isExpanded ? 0 : 'auto',
                paddingBottom: isExpanded ? 0 : 8,
              }}
              transition={{ duration: 0.2 }}
            >
              <div onClick={() => !isDragging && !isExpanded && expand()}>
                {peekContent}
              </div>
            </motion.div>

            {/* Header with collapse - shown when expanded */}
            <motion.div 
              className="px-4 py-2 flex items-center justify-between border-b border-[#2a2a2a] overflow-hidden"
              animate={{ 
                opacity: isExpanded ? 1 : 0,
                height: isExpanded ? 'auto' : 0,
              }}
              transition={{ duration: 0.15 }}
            >
              <button
                onClick={collapse}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
              >
                <ChevronDown className="w-4 h-4" />
                <span>Collapse</span>
              </button>
              <button
                onClick={collapse}
                className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>

          {/* Main Content - scrollable */}
          <motion.div 
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
            animate={{ opacity: isExpanded ? 1 : 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="px-4 py-4">
              {children}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  );
}
