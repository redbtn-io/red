'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGraphStore } from '@/lib/stores/graphStore';
import StudioCanvas from '../components/Canvas';
import NodePalette from '../components/NodePalette';
import ConfigPanel from '../components/ConfigPanel';
import GraphHeader from '../components/GraphHeader';
import StateManager from '../components/StateManager';
import { pageVariants } from '@/lib/animations';
import { MessageSquare, Workflow } from 'lucide-react';

/**
 * New Graph Page
 * 
 * Creates a new empty graph for editing.
 * Users can drag nodes from the palette, connect them, and save.
 */
export default function NewGraphPage() {
  const { newGraph, metadata, updateMetadata, isLoading, selectedNodeId } = useGraphStore();
  const [showPalette, setShowPalette] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showStateManager, setShowStateManager] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showGraphTypeModal, setShowGraphTypeModal] = useState(true);
  const [hasSelectedType, setHasSelectedType] = useState(false);

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

  // Handle graph type selection
  const handleSelectGraphType = useCallback((type: 'agent' | 'workflow') => {
    updateMetadata({ graphType: type });
    setHasSelectedType(true);
    setShowGraphTypeModal(false);
  }, [updateMetadata]);

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
      <div className="flex h-screen bg-bg-primary items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <motion.div 
      className="flex h-screen bg-bg-primary flex-col overflow-hidden"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      {/* Graph Type Selection Modal */}
      <AnimatePresence mode="wait">
        {showGraphTypeModal && !hasSelectedType && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-[9998]"
              onClick={() => {
                // Don't close on backdrop click - user must choose
              }}
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            >
              <div className="bg-bg-secondary border border-border rounded-xl shadow-2xl max-w-md w-full p-8">
                <h2 className="text-2xl font-semibold text-text-primary mb-2">Create New Graph</h2>
                <p className="text-text-muted mb-6">Select the type of graph you want to create:</p>
                
                <div className="space-y-3">
                  {/* Agent Button */}
                  <button
                    onClick={() => handleSelectGraphType('agent')}
                    className="w-full group relative overflow-hidden rounded-lg border border-border hover:border-purple-500/50 transition-all hover:bg-purple-500/5 p-4 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                          <MessageSquare className="w-6 h-6 text-purple-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-text-primary group-hover:text-purple-400 transition-colors">Agent</h3>
                        <p className="text-sm text-text-muted mt-1">Interactive chat graph that requires user input. Use in conversations.</p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Workflow Button */}
                  <button
                    onClick={() => handleSelectGraphType('workflow')}
                    className="w-full group relative overflow-hidden rounded-lg border border-border hover:border-cyan-500/50 transition-all hover:bg-cyan-500/5 p-4 text-left"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
                          <Workflow className="w-6 h-6 text-cyan-400" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-text-primary group-hover:text-cyan-400 transition-colors">Workflow</h3>
                        <p className="text-sm text-text-muted mt-1">Automated graph for automations. Runs without user input.</p>
                      </div>
                    </div>
                  </button>
                </div>
                
                <p className="text-xs text-text-muted mt-6 text-center">You can change the graph type anytime in the header.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header - Fixed at top, never scrolls */}
      <div className="flex-shrink-0">
        <GraphHeader 
          onTogglePalette={() => setShowPalette(!showPalette)}
          onToggleConfig={() => setShowConfig(!showConfig)}
          onToggleStateManager={() => setShowStateManager(!showStateManager)}
          showPalette={showPalette}
          showConfig={showConfig}
          showStateManager={showStateManager}
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
          
          {/* State Manager overlay */}
          <StateManager 
            isOpen={showStateManager} 
            onClose={() => setShowStateManager(false)} 
          />
        </div>
        
        {/* Right sidebar - Config panel */}
        <ConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
      </div>
    </motion.div>
  );
}
