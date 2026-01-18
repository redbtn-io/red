'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GraphRunState, GraphDefinition, NodeProgress } from '@/components/graph';

// Debug logging - set to true to enable verbose logs
const DEBUG = false;

// ============================================================================
// Types
// ============================================================================

export interface GraphEvent {
  type: 'graph_start' | 'graph_complete' | 'graph_error' | 'run_complete' | 'run_error' | 'node_start' | 'node_progress' | 'node_complete' | 'node_error';
  graphId?: string;
  graphName?: string;
  runId?: string;
  nodeId?: string;
  nodeType?: string;
  nodeName?: string;
  stepName?: string;
  stepIndex?: number;
  totalSteps?: number;
  timestamp?: number;
  duration?: number;
  error?: string;
  nodeCount?: number;
  entryNodeId?: string;
  exitNodeId?: string;
  nodesExecuted?: number;
  nextNodeId?: string;
  willRetry?: boolean;
}

interface UseGraphRunStateOptions {
  /** Current graph definition (loaded from API) */
  graphDefinition?: GraphDefinition | null;
}

interface UseGraphRunStateReturn {
  /** Current run state for the graph viewer */
  runState: GraphRunState | undefined;
  /** Whether a graph is currently running */
  isRunning: boolean;
  /** Whether the drawer should be shown */
  showDrawer: boolean;
  /** Open the drawer */
  openDrawer: () => void;
  /** Close the drawer */
  closeDrawer: () => void;
  /** Toggle the drawer */
  toggleDrawer: () => void;
  /** Process a graph event from SSE stream */
  processGraphEvent: (event: GraphEvent) => void;
  /** Reset run state (for new generation) */
  resetRunState: () => void;
  /** Start a new run (shows "starting" state before events arrive) */
  startRun: (graphId?: string) => void;
  /** Get current run state (closure-safe) */
  getRunState: () => GraphRunState | undefined;
  /** Initialize from an existing state (for SSE reconnection/late join)
   *  Returns any buffered events that are newer than the state timestamp for replay
   */
  initializeFromState: (runState: {
    runId?: string;
    graphId?: string;
    executionPath: string[];
    nodeProgress: Record<string, any>;
    startTime?: number;
    endTime?: number;
    status?: string;
    stateTimestamp?: number;
  }) => GraphEvent[];
  /** Load a historical run state (from saved graph runs) */
  loadRunState: (savedRun: {
    graphId?: string;
    status: 'running' | 'completed' | 'error';
    executionPath: string[];
    nodeProgress: Record<string, NodeProgress>;
    startTime?: number;
    endTime?: number;
    error?: string;
  }) => void;
  /** Current graph definition with enriched node data */
  graph: GraphDefinition | undefined;
}

// ============================================================================
// Hook
// ============================================================================

export function useGraphRunState({ 
  graphDefinition 
}: UseGraphRunStateOptions = {}): UseGraphRunStateReturn {
  const [runState, setRunState] = useState<GraphRunState | undefined>(undefined);
  const [showDrawer, setShowDrawer] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // Track current run ID to ignore stale events
  const currentRunIdRef = useRef<string | null>(null);
  
  // Event buffering: hold events until init arrives with state timestamp
  const eventBufferRef = useRef<GraphEvent[]>([]);
  const initReceivedRef = useRef<boolean>(false);
  const initTimestampRef = useRef<number>(0);
  
  // Track run state in ref for closure-safe access
  const runStateRef = useRef<GraphRunState | undefined>(undefined);
  
  // Keep ref in sync with state
  useEffect(() => {
    runStateRef.current = runState;
    if (DEBUG && runState) {
      console.log(`[useGraphRunState] State updated: currentNodeId=${runState.currentNodeId} status=${runState.status} path=[${runState.executionPath?.join(',')}]`);
    }
  }, [runState]);
  
  // Helper type for state updates
  type RunStateUpdater = (prev: GraphRunState | undefined) => GraphRunState | undefined;
  const updateRunState = useCallback((updater: RunStateUpdater) => {
    setRunState(updater);
  }, []);
  
  const openDrawer = useCallback(() => setShowDrawer(true), []);
  const closeDrawer = useCallback(() => setShowDrawer(false), []);
  const toggleDrawer = useCallback(() => setShowDrawer(prev => !prev), []);
  
  // Get current run state (closure-safe)
  const getRunState = useCallback(() => runStateRef.current, []);
  
  // Load a historical run state (from saved graph runs)
  const loadRunState = useCallback((savedRun: {
    graphId?: string;
    status: 'running' | 'completed' | 'error';
    executionPath: string[];
    nodeProgress: Record<string, NodeProgress>;
    startTime?: number;
    endTime?: number;
    error?: string;
  }) => {
    const loadedState: GraphRunState = {
      graphId: savedRun.graphId,
      status: savedRun.status === 'running' ? 'completed' : savedRun.status, // Treat saved running as completed
      currentNodeId: undefined,
      nodeProgress: savedRun.nodeProgress || {},
      executionPath: savedRun.executionPath || [],
      startTime: savedRun.startTime,
      endTime: savedRun.endTime,
      error: savedRun.error,
    };
    setRunState(loadedState);
    setIsRunning(false);
    setShowDrawer(true);
  }, []);
  
  // Initialize from existing run state (for SSE reconnection/late join)
  // Unlike loadRunState, this keeps the run in running state
  // After setting state, replays any buffered events that are newer than state timestamp
  const initializeFromState = useCallback((runState: {
    runId?: string;
    graphId?: string;
    executionPath: string[];
    nodeProgress: Record<string, any>;
    startTime?: number;
    endTime?: number;
    status?: string;
    stateTimestamp?: number; // When this state snapshot was taken
  }) => {
    if (DEBUG) {
      console.log('[useGraphRunState] Initializing from existing state:', {
        runId: runState.runId,
        nodeCount: Object.keys(runState.nodeProgress || {}).length,
        status: runState.status,
      });
    }
    
    // Set the run ID for tracking
    if (runState.runId) {
      currentRunIdRef.current = runState.runId;
    }
    
    // Convert nodeProgress to our format
    const nodeProgress: Record<string, NodeProgress> = {};
    for (const [nodeId, progress] of Object.entries(runState.nodeProgress || {})) {
      nodeProgress[nodeId] = {
        nodeId,
        status: progress.status || 'completed',
        stepName: progress.nodeName || nodeId,
        startTime: progress.startedAt,
        endTime: progress.completedAt,
      };
    }
    
    const executionPath = runState.executionPath || [];
    const isCompleted = runState.status === 'completed' || runState.status === 'error';
    
    // Find current running node (last in path that's still running)
    let runningNode: string | undefined = undefined;
    for (let i = executionPath.length - 1; i >= 0; i--) {
      const id = executionPath[i];
      if (nodeProgress[id]?.status === 'running') {
        runningNode = id;
        break;
      }
    }
    
    if (DEBUG) console.log('[useGraphRunState] Init runningNode:', runningNode);
    
    // Set state immediately from init payload
    setRunState({
      graphId: runState.graphId,
      runId: runState.runId,
      status: isCompleted ? (runState.status as 'completed' | 'error') : 'running',
      currentNodeId: runningNode,
      nodeProgress,
      executionPath,
      startTime: runState.startTime,
      endTime: runState.endTime,
    });
    
    setIsRunning(!isCompleted);
    
    // Mark init as received and store timestamp
    initReceivedRef.current = true;
    initTimestampRef.current = runState.stateTimestamp || Date.now();
    
    // Get buffered events that are newer than init state and return them for replay
    const bufferedEvents = eventBufferRef.current;
    eventBufferRef.current = []; // Clear buffer
    
    const eventsToReplay = bufferedEvents.filter(e => 
      e.timestamp && e.timestamp > initTimestampRef.current
    );
    
    if (DEBUG && eventsToReplay.length > 0) {
      console.log(`[useGraphRunState] ${eventsToReplay.length} buffered events to replay`);
    }
    
    return eventsToReplay;
  }, []);
  
  const resetRunState = useCallback(() => {
    if (DEBUG) console.log('[useGraphRunState] Resetting run state');
    setRunState(undefined);
    setIsRunning(false);
    currentRunIdRef.current = null;
    // Reset buffering state for next run
    eventBufferRef.current = [];
    initReceivedRef.current = false;
    initTimestampRef.current = 0;
  }, []);
  
  // Start a new run immediately (before SSE connects)
  // This shows the graph in "starting" state with entry node pending
  const startRun = useCallback((graphId?: string) => {
    if (DEBUG) console.log('[useGraphRunState] Starting new run');
    // Reset buffering state for new run
    eventBufferRef.current = [];
    // Mark init as received so events are processed immediately
    // The startRun call IS our initialization - we don't need to wait for an init event
    initReceivedRef.current = true;
    initTimestampRef.current = 0; // Accept all events
    
    const entryNodeId = graphDefinition?.entryNodeId || graphDefinition?.nodes?.[0]?.id;
    const newRunId = `run_${Date.now()}`;
    currentRunIdRef.current = newRunId;
    setRunState({
      graphId: graphId || graphDefinition?.id,
      runId: newRunId,
      status: 'running',
      currentNodeId: entryNodeId,
      nodeProgress: entryNodeId ? {
        [entryNodeId]: {
          nodeId: entryNodeId,
          status: 'running',
          stepName: 'Starting...',
          startTime: Date.now(),
        }
      } : {},
      executionPath: entryNodeId ? [entryNodeId] : [],
      startTime: Date.now(),
    });
    setIsRunning(true);
    setShowDrawer(true);
  }, [graphDefinition]);
  
  const processGraphEvent = useCallback((event: GraphEvent) => {
    const now = Date.now();
    const eventTs = event.timestamp;
    const delta = eventTs ? now - eventTs : undefined;
    
    // If init hasn't been received yet, buffer the event for later replay
    if (!initReceivedRef.current) {
      eventBufferRef.current.push(event);
      if (DEBUG) console.log(`[useGraphRunState][BUFFERED] type=${event.type} nodeId=${event.nodeId||'n/a'} bufferSize=${eventBufferRef.current.length}`);
      return;
    }
    
    // Skip events that are older than the init state (already reflected in state)
    if (eventTs && eventTs <= initTimestampRef.current) {
      if (DEBUG) console.log(`[useGraphRunState][SKIPPED] type=${event.type} nodeId=${event.nodeId||'n/a'}`);
      return;
    }
    
    if (DEBUG) console.log(`[useGraphRunState] event=${event.type} node=${event.nodeId||'n/a'}`);
    
    // Handle graph start - initialize run state
    if (event.type === 'graph_start') {
      currentRunIdRef.current = event.runId || null;
      setIsRunning(true);
      setRunState({
        graphId: event.graphId || 'unknown',
        runId: event.runId,
        status: 'running',
        currentNodeId: event.entryNodeId,
        nodeProgress: {},
        executionPath: event.entryNodeId ? [event.entryNodeId] : [],
        startTime: event.timestamp || Date.now(),
      });
      // Don't auto-open drawer - let user click the graph button
      return;
    }
    
    // If we receive node events but haven't initialized yet (missed graph_start), initialize now
    // This handles cases where SSE connects late or graph_start was missed
    if (!currentRunIdRef.current && event.runId && 
        (event.type === 'node_start' || event.type === 'node_progress' || event.type === 'node_complete')) {
      currentRunIdRef.current = event.runId;
      setIsRunning(event.type !== 'node_complete'); // If first event is complete, we might be done
      const initialProgress: Record<string, NodeProgress> = {};
      if (event.nodeId) {
        initialProgress[event.nodeId] = {
          nodeId: event.nodeId,
          status: event.type === 'node_complete' ? 'completed' : 'running',
          startTime: event.timestamp || Date.now(),
          ...(event.type === 'node_complete' ? { endTime: event.timestamp || Date.now() } : {}),
        };
      }
      setRunState({
        graphId: event.graphId || 'unknown',
        runId: event.runId,
        status: 'running',
        currentNodeId: event.type === 'node_complete' ? undefined : event.nodeId,
        nodeProgress: initialProgress,
        executionPath: event.nodeId ? [event.nodeId] : [],
        startTime: event.timestamp || Date.now(),
      });
      // Don't auto-open drawer - let user click the graph button
      // If this was node_complete, we've already set the progress, so return
      if (event.type === 'node_complete') {
        return;
      }
      // Continue processing for node_start/node_progress below
    }
    
    // Ignore events from stale runs
    if (event.runId && currentRunIdRef.current && event.runId !== currentRunIdRef.current) {
      return;
    }
    
    // Handle graph complete OR run complete (server sends run_complete)
    if (event.type === 'graph_complete' || event.type === 'run_complete') {
      setIsRunning(false);
      updateRunState((prev) => prev ? {
        ...prev,
        status: 'completed',
        currentNodeId: undefined,
        endTime: event.timestamp || Date.now(),
      } : prev);
      return;
    }
    
    // Handle graph error OR run error (server sends run_error)
    if (event.type === 'graph_error' || event.type === 'run_error') {
      setIsRunning(false);
      updateRunState((prev) => prev ? {
        ...prev,
        status: 'error',
        error: event.error,
        endTime: event.timestamp || Date.now(),
      } : prev);
      return;
    }
    
    // Handle node start
    if (event.type === 'node_start' && event.nodeId) {
      updateRunState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentNodeId: event.nodeId,
          executionPath: [...prev.executionPath, event.nodeId!],
          nodeProgress: {
            ...prev.nodeProgress,
            [event.nodeId!]: {
              nodeId: event.nodeId!,
              status: 'running',
              stepName: 'Initializing...',
              startTime: event.timestamp || Date.now(),
            },
          },
        };
      });
      return;
    }
    
    // Handle node progress
    if (event.type === 'node_progress' && event.nodeId) {
      updateRunState((prev) => {
        if (!prev) return prev;
        const existing = prev.nodeProgress[event.nodeId!] || { nodeId: event.nodeId!, status: 'running' };
        return {
          ...prev,
          nodeProgress: {
            ...prev.nodeProgress,
            [event.nodeId!]: {
              ...existing,
              nodeId: event.nodeId!,
              status: 'running',
              stepName: event.stepName,
              currentStep: event.stepIndex,
              totalSteps: event.totalSteps,
            } as NodeProgress,
          },
        };
      });
      return;
    }
    
    // Handle node complete
    if (event.type === 'node_complete' && event.nodeId) {
      updateRunState((prev) => {
        if (!prev) return prev;
        const existing = prev.nodeProgress[event.nodeId!] || { nodeId: event.nodeId! };
        const newCurrentNode = prev.currentNodeId === event.nodeId ? undefined : prev.currentNodeId;
        return {
          ...prev,
          currentNodeId: newCurrentNode,
          nodeProgress: {
            ...prev.nodeProgress,
            [event.nodeId!]: {
              ...existing,
              nodeId: event.nodeId!,
              status: 'completed',
              endTime: event.timestamp || Date.now(),
            } as NodeProgress,
          },
        };
      });
      return;
    }
    
    // Handle node error
    if (event.type === 'node_error' && event.nodeId) {
      updateRunState((prev) => {
        if (!prev) return prev;
        const existing = prev.nodeProgress[event.nodeId!] || { nodeId: event.nodeId! };
        return {
          ...prev,
          nodeProgress: {
            ...prev.nodeProgress,
            [event.nodeId!]: {
              ...existing,
              nodeId: event.nodeId!,
              status: 'error',
              error: event.error,
              endTime: event.timestamp || Date.now(),
            } as NodeProgress,
          },
        };
      });
      return;
    }
  }, []);
  
  return {
    runState,
    isRunning,
    showDrawer,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    processGraphEvent,
    resetRunState,
    startRun,
    getRunState,
    initializeFromState,
    loadRunState,
    graph: graphDefinition || undefined,
  };
}

export default useGraphRunState;
