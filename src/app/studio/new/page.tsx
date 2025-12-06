'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useGraphStore } from '@/lib/stores/graphStore';
import StudioCanvas from '../components/Canvas';
import NodePalette from '../components/NodePalette';
import ConfigPanel from '../components/ConfigPanel';
import GraphHeader from '../components/GraphHeader';
import { pageVariants } from '@/lib/animations';

/**
 * New Graph Page
 * 
 * Creates a new empty graph for editing.
 * Users can drag nodes from the palette, connect them, and save.
 */
export default function NewGraphPage() {
  const { newGraph, isLoading, selectedNodeId } = useGraphStore();
  const [showPalette, setShowPalette] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Initialize new graph on mount
  useEffect(() => {
    newGraph();
  }, [newGraph]);

  // On mobile, open config panel when a node is selected
  const handleNodeSelectedOnMobile = useCallback(() => {
    if (isMobile && selectedNodeId && !['__start__', '__end__'].includes(selectedNodeId)) {
      setShowConfig(true);
    }
  }, [isMobile, selectedNodeId]);

  // Called when a node is added (from drop or tap)
  const handleNodeAdded = useCallback(() => {
    if (isMobile) {
      setShowConfig(true);
    }
  }, [isMobile]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <motion.div 
      className="flex h-full flex-col overflow-hidden"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Header - Fixed at top, never scrolls */}
      <div className="flex-shrink-0">
        <GraphHeader 
          onTogglePalette={() => setShowPalette(!showPalette)}
          onToggleConfig={() => setShowConfig(!showConfig)}
          showPalette={showPalette}
          showConfig={showConfig}
        />
      </div>
      
      {/* Main content area - Takes remaining space */}
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Left sidebar - Node palette */}
        <NodePalette 
          isOpen={showPalette} 
          onClose={() => setShowPalette(false)}
          onNodeAdded={handleNodeAdded}
        />
        
        {/* Center - Canvas */}
        <div className="flex-1 relative min-w-0 h-full">
          <StudioCanvas 
            onNodeAdded={handleNodeAdded}
            onNodeDoubleClick={handleNodeSelectedOnMobile}
          />
        </div>
        
        {/* Right sidebar - Config panel */}
        <ConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
      </div>
    </motion.div>
  );
}
