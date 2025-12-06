'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useGraphStore } from '@/lib/stores/graphStore';
import Canvas from '../components/Canvas';
import NodePalette from '../components/NodePalette';
import ConfigPanel from '../components/ConfigPanel';
import GraphHeader from '../components/GraphHeader';
import { Loader2, AlertCircle } from 'lucide-react';
import { pageVariants } from '@/lib/animations';

/**
 * Graph Editor Page
 * 
 * Loads and edits an existing graph by ID.
 * Path: /studio/[graphId]
 */
export default function GraphEditorPage() {
  const params = useParams();
  const graphId = params.graphId as string;
  
  const { loadGraph, isLoading, reset, selectedNodeId } = useGraphStore();
  const [error, setError] = useState<string | null>(null);
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

  // Load graph on mount
  useEffect(() => {
    if (!graphId) return;

    async function load() {
      setError(null);
      try {
        await loadGraph(graphId);
      } catch (err) {
        console.error('Failed to load graph:', err);
        setError(err instanceof Error ? err.message : 'Failed to load graph');
      }
    }

    load();

    // Cleanup on unmount
    return () => {
      reset();
    };
  }, [graphId, loadGraph, reset]);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
          <p className="text-gray-400">Loading graph...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-semibold text-gray-200">Failed to load graph</h2>
          <p className="text-gray-400">{error}</p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#1a1a1a] text-gray-200 rounded-lg hover:bg-[#2a2a2a] transition-colors"
            >
              Retry
            </button>
            <Link
              href="/studio"
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              New Graph
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="h-screen bg-[#0a0a0a] flex flex-col"
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
    >
      <GraphHeader 
        onTogglePalette={() => setShowPalette(!showPalette)}
        onToggleConfig={() => setShowConfig(!showConfig)}
        showPalette={showPalette}
        showConfig={showConfig}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <NodePalette 
          isOpen={showPalette} 
          onClose={() => setShowPalette(false)}
          onNodeAdded={handleNodeAdded}
        />
        <Canvas 
          onNodeAdded={handleNodeAdded}
          onNodeDoubleClick={handleNodeSelectedOnMobile}
        />
        <ConfigPanel isOpen={showConfig} onClose={() => setShowConfig(false)} />
      </div>
    </motion.div>
  );
}
