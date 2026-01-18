/**
 * GraphRunContext - Shared context for graph run state
 *
 * Provides graph run state and visualization data to any component
 * that needs to display the running graph.
 */

'use client';

import React, { createContext, useContext, useCallback, useState, ReactNode } from 'react';
import { useGraphRun, GraphRunState, StartRunOptions } from './useGraphRun';

// =============================================================================
// Types
// =============================================================================

export interface GraphVisualizationState {
  graphId: string | null;
  graphName: string | null;
  isRunning: boolean;
  currentNodeId: string | null;
  nodeStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
  executionPath: string[];
}

export interface GraphRunContextValue {
  // Run state
  runState: GraphRunState;
  isRunning: boolean;

  // Visualization state (derived, for graph viewer)
  visualization: GraphVisualizationState;

  // Actions
  startRun: (options: StartRunOptions) => Promise<void>;
  cancelRun: () => void;
  reset: () => void;

  // For graph viewer initialization from historical data
  initializeFromHistory: (data: {
    graphId: string;
    graphName: string;
    executionPath: string[];
    nodeProgress: Record<string, { status: string; nodeName?: string }>;
  }) => void;
}

// =============================================================================
// Context
// =============================================================================

const GraphRunContext = createContext<GraphRunContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

export function GraphRunProvider({ children }: { children: ReactNode }) {
  const graphRun = useGraphRun();

  // Historical/static visualization state (for viewing past runs)
  const [historicalState, setHistoricalState] = useState<{
    graphId: string | null;
    graphName: string | null;
    executionPath: string[];
    nodeStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'>;
  } | null>(null);

  // Derive visualization state from either live run or historical data
  const visualization: GraphVisualizationState = graphRun.isRunning || graphRun.state.status === 'completed'
    ? {
        graphId: graphRun.state.graphId,
        graphName: graphRun.state.graphName,
        isRunning: graphRun.isRunning,
        currentNodeId: graphRun.state.currentNodeId,
        nodeStatuses: Object.fromEntries(
          Object.entries(graphRun.state.nodes).map(([id, node]) => [id, node.status])
        ),
        executionPath: graphRun.state.executionPath,
      }
    : historicalState
      ? {
          graphId: historicalState.graphId,
          graphName: historicalState.graphName,
          isRunning: false,
          currentNodeId: null,
          nodeStatuses: historicalState.nodeStatuses,
          executionPath: historicalState.executionPath,
        }
      : {
          graphId: null,
          graphName: null,
          isRunning: false,
          currentNodeId: null,
          nodeStatuses: {},
          executionPath: [],
        };

  const initializeFromHistory = useCallback((data: {
    graphId: string;
    graphName: string;
    executionPath: string[];
    nodeProgress: Record<string, { status: string; nodeName?: string }>;
  }) => {
    const nodeStatuses: Record<string, 'pending' | 'running' | 'completed' | 'error'> = {};
    for (const [nodeId, progress] of Object.entries(data.nodeProgress)) {
      nodeStatuses[nodeId] = progress.status as 'pending' | 'running' | 'completed' | 'error';
    }
    setHistoricalState({
      graphId: data.graphId,
      graphName: data.graphName,
      executionPath: data.executionPath,
      nodeStatuses,
    });
  }, []);

  const reset = useCallback(() => {
    graphRun.reset();
    setHistoricalState(null);
  }, [graphRun]);

  const value: GraphRunContextValue = {
    runState: graphRun.state,
    isRunning: graphRun.isRunning,
    visualization,
    startRun: graphRun.startRun,
    cancelRun: graphRun.cancelRun,
    reset,
    initializeFromHistory,
  };

  return (
    <GraphRunContext.Provider value={value}>
      {children}
    </GraphRunContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useGraphRunContext(): GraphRunContextValue {
  const context = useContext(GraphRunContext);
  if (!context) {
    throw new Error('useGraphRunContext must be used within a GraphRunProvider');
  }
  return context;
}

export default GraphRunContext;
