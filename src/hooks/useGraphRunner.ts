/**
 * GraphRunner - Unified component for running graphs with real-time visualization
 *
 * This is a self-contained module that handles:
 * 1. Triggering graph runs via API
 * 2. SSE streaming with automatic reconnection and event replay
 * 3. Graph state management (node status, execution path)
 * 4. Content/thinking accumulation
 *
 * Usage:
 * ```tsx
 * const runner = useGraphRunner();
 *
 * // Start a run
 * await runner.run({
 *   endpoint: '/api/v1/chat/completions',
 *   body: { message: 'hello' },
 *   onChunk: (chunk, isThinking) => { ... },
 * });
 *
 * // Access state
 * runner.graphState.currentNodeId
 * runner.graphState.nodes
 * runner.content
 * ```
 */

import { useCallback, useRef, useState, useMemo } from 'react';

// =============================================================================
// Types
// =============================================================================

export type NodeStatus = 'pending' | 'running' | 'completed' | 'error';
export type RunStatus = 'idle' | 'connecting' | 'running' | 'completed' | 'error';

export interface NodeState {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: NodeStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface GraphState {
  graphId: string | null;
  graphName: string | null;
  currentNodeId: string | null;
  nodes: Record<string, NodeState>;
  executionPath: string[];
}

export interface RunnerState {
  runId: string | null;
  status: RunStatus;
  error: string | null;
  content: string;
  thinking: string;
  startedAt: number | null;
  completedAt: number | null;
}

export interface RunOptions {
  /** API endpoint to trigger the run */
  endpoint: string;
  /** Request body (will be JSON stringified) */
  body: Record<string, unknown>;
  /** Pre-generated runId (optional, will generate if not provided) */
  runId?: string;
  /** Called for each content chunk */
  onChunk?: (chunk: string, isThinking: boolean) => void;
  /** Called when a node starts executing */
  onNodeStart?: (nodeId: string, nodeName: string, nodeType: string) => void;
  /** Called when a node completes */
  onNodeComplete?: (nodeId: string, nextNodeId: string | null) => void;
  /** Called on any event (for debugging/custom handling) */
  onEvent?: (event: SSEEvent) => void;
  /** Called when run completes successfully */
  onComplete?: (content: string, thinking: string) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

export interface SSEEvent {
  type: string;
  timestamp?: number;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  nextNodeId?: string;
  chunk?: string;
  content?: string;
  error?: string;
  graphId?: string;
  graphName?: string;
  runId?: string;
  state?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UseGraphRunnerReturn {
  /** Current run state */
  runState: RunnerState;
  /** Current graph visualization state */
  graphState: GraphState;
  /** Whether a run is in progress */
  isRunning: boolean;
  /** Accumulated content */
  content: string;
  /** Accumulated thinking */
  thinking: string;
  /** Start a new run */
  run: (options: RunOptions) => Promise<void>;
  /** Cancel the current run */
  cancel: () => void;
  /** Reset all state */
  reset: () => void;
  /** Load historical state (for viewing past runs) */
  loadHistoricalState: (data: {
    graphId: string;
    graphName: string;
    executionPath: string[];
    nodeProgress: Record<string, { status: string; nodeName?: string; nodeType?: string }>;
  }) => void;
}

// =============================================================================
// Initial States
// =============================================================================

const createInitialRunnerState = (): RunnerState => ({
  runId: null,
  status: 'idle',
  error: null,
  content: '',
  thinking: '',
  startedAt: null,
  completedAt: null,
});

const createInitialGraphState = (): GraphState => ({
  graphId: null,
  graphName: null,
  currentNodeId: null,
  nodes: {},
  executionPath: [],
});

// =============================================================================
// Hook
// =============================================================================

export function useGraphRunner(): UseGraphRunnerReturn {
  const [runState, setRunState] = useState<RunnerState>(createInitialRunnerState);
  const [graphState, setGraphState] = useState<GraphState>(createInitialGraphState);

  // Refs for cleanup
  const abortRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Mutable accumulators (avoid state batching issues)
  const accumulatorRef = useRef({ content: '', thinking: '' });

  const reset = useCallback(() => {
    setRunState(createInitialRunnerState());
    setGraphState(createInitialGraphState());
    accumulatorRef.current = { content: '', thinking: '' };
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
  }, []);

  const loadHistoricalState = useCallback((data: {
    graphId: string;
    graphName: string;
    executionPath: string[];
    nodeProgress: Record<string, { status: string; nodeName?: string; nodeType?: string }>;
  }) => {
    const nodes: Record<string, NodeState> = {};
    for (const [nodeId, progress] of Object.entries(data.nodeProgress)) {
      nodes[nodeId] = {
        nodeId,
        nodeName: progress.nodeName || nodeId,
        nodeType: progress.nodeType || 'unknown',
        status: progress.status as NodeStatus,
      };
    }
    setGraphState({
      graphId: data.graphId,
      graphName: data.graphName,
      currentNodeId: null,
      nodes,
      executionPath: data.executionPath,
    });
  }, []);

  const run = useCallback(async (options: RunOptions) => {
    const {
      endpoint,
      body,
      runId: providedRunId,
      onChunk,
      onNodeStart,
      onNodeComplete,
      onEvent,
      onComplete,
      onError,
    } = options;

    // Cancel any existing run
    cancel();

    // Generate runId if not provided
    const runId = providedRunId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Reset accumulators
    accumulatorRef.current = { content: '', thinking: '' };

    // Initialize state
    setRunState({
      runId,
      status: 'connecting',
      error: null,
      content: '',
      thinking: '',
      startedAt: Date.now(),
      completedAt: null,
    });
    setGraphState(createInitialGraphState());

    // Create abort controller
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    try {
      // Step 1: Connect to SSE stream FIRST
      const streamUrl = `/api/v1/runs/${runId}/stream`;
      console.log(`[GraphRunner] Step 1: Connecting to SSE: ${streamUrl}`);

      const sseResponse = await fetch(streamUrl, {
        method: 'GET',
        credentials: 'include',
        signal,
      });
      
      console.log(`[GraphRunner] SSE fetch returned with status ${sseResponse.status}`);

      if (!sseResponse.ok) {
        throw new Error(`SSE connection failed: ${sseResponse.status}`);
      }

      const reader = sseResponse.body?.getReader();
      if (!reader) throw new Error('No response body');
      readerRef.current = reader;

      console.log(`[GraphRunner] Step 2: SSE connected, triggering run via ${endpoint}`);

      // Step 2: Trigger the run (fire and forget - don't await)
      console.log(`[GraphRunner] Firing POST to ${endpoint} with runId=${runId}`);
      const triggerPromise = fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({ ...body, runId, stream: true }),
      }).then(res => {
        console.log(`[GraphRunner] POST response: ${res.status}`);
        return res;
      }).catch(err => {
        console.error(`[GraphRunner] POST error:`, err);
        throw err;
      });
      console.log(`[GraphRunner] POST fired, starting read loop`);

      // Update status
      setRunState(prev => ({ ...prev, status: 'running' }));

      // Step 3: Process SSE events
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvent = (event: SSEEvent) => {
        onEvent?.(event);

        switch (event.type) {
          case 'run_start':
            setGraphState(prev => ({
              ...prev,
              graphId: event.graphId || prev.graphId,
              graphName: event.graphName || prev.graphName,
            }));
            break;

          case 'node_start': {
            const { nodeId, nodeName, nodeType } = event;
            if (!nodeId) break;

            const node: NodeState = {
              nodeId,
              nodeName: nodeName || nodeId,
              nodeType: nodeType || 'unknown',
              status: 'running',
              startedAt: event.timestamp || Date.now(),
            };

            setGraphState(prev => ({
              ...prev,
              currentNodeId: nodeId,
              executionPath: prev.executionPath.includes(nodeId)
                ? prev.executionPath
                : [...prev.executionPath, nodeId],
              nodes: { ...prev.nodes, [nodeId]: node },
            }));

            onNodeStart?.(nodeId, nodeName || nodeId, nodeType || 'unknown');
            break;
          }

          case 'node_complete': {
            const { nodeId, nextNodeId } = event;
            if (!nodeId) break;

            setGraphState(prev => ({
              ...prev,
              currentNodeId: nextNodeId || null,
              nodes: {
                ...prev.nodes,
                [nodeId]: {
                  ...prev.nodes[nodeId],
                  status: 'completed',
                  completedAt: event.timestamp || Date.now(),
                },
              },
            }));

            onNodeComplete?.(nodeId, nextNodeId || null);
            break;
          }

          case 'node_error': {
            const { nodeId, error } = event;
            if (!nodeId) break;

            setGraphState(prev => ({
              ...prev,
              nodes: {
                ...prev.nodes,
                [nodeId]: {
                  ...prev.nodes[nodeId],
                  status: 'error',
                  error: error,
                  completedAt: event.timestamp || Date.now(),
                },
              },
            }));
            break;
          }

          case 'chunk': {
            if (!event.chunk) break;
            accumulatorRef.current.content += event.chunk;
            setRunState(prev => ({ ...prev, content: accumulatorRef.current.content }));
            onChunk?.(event.chunk, false);
            break;
          }

          case 'thinking_chunk': {
            if (!event.chunk) break;
            accumulatorRef.current.thinking += event.chunk;
            setRunState(prev => ({ ...prev, thinking: accumulatorRef.current.thinking }));
            onChunk?.(event.chunk, true);
            break;
          }

          case 'run_complete':
            setRunState(prev => ({
              ...prev,
              status: 'completed',
              completedAt: Date.now(),
            }));
            onComplete?.(accumulatorRef.current.content, accumulatorRef.current.thinking);
            break;

          case 'run_error':
            setRunState(prev => ({
              ...prev,
              status: 'error',
              error: event.error || 'Unknown error',
              completedAt: Date.now(),
            }));
            onError?.(event.error || 'Unknown error');
            break;

          // Handle init event for state recovery
          case 'init':
            if (event.state) {
              const state = event.state as Record<string, unknown>;
              if (state.graph) {
                const graph = state.graph as Record<string, unknown>;
                setGraphState(prev => ({
                  ...prev,
                  graphId: (graph.graphId as string) || prev.graphId,
                  graphName: (graph.graphName as string) || prev.graphName,
                  currentNodeId: (graph.currentNodeId as string) || prev.currentNodeId,
                  executionPath: (graph.executionPath as string[]) || prev.executionPath,
                }));
              }
            }
            break;
        }
      };

      // Read SSE stream
      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log(`[GraphRunner] Stream complete`);
              break readLoop;
            }
            try {
              const event = JSON.parse(data) as SSEEvent;
              processEvent(event);
            } catch (e) {
              // Ignore parse errors (comments, etc.)
            }
          }
        }
      }

      // Wait for trigger response to check for errors
      try {
        const triggerRes = await triggerPromise;
        if (!triggerRes.ok) {
          const errText = await triggerRes.text();
          console.error('[GraphRunner] Trigger error:', errText);
          // Only set error if not already completed
          setRunState(prev => {
            if (prev.status === 'completed') return prev;
            return { ...prev, status: 'error', error: `Trigger failed: ${errText}` };
          });
        }
      } catch (e) {
        // Trigger might fail if aborted, that's ok
        if (!signal.aborted) console.error('[GraphRunner] Trigger error:', e);
      }

    } catch (error) {
      if (signal.aborted) {
        console.log('[GraphRunner] Run cancelled');
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[GraphRunner] Error:', errorMessage);
      setRunState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        completedAt: Date.now(),
      }));
      onError?.(errorMessage);
    } finally {
      readerRef.current = null;
      abortRef.current = null;
    }
  }, [cancel]);

  // Derived values
  const isRunning = runState.status === 'connecting' || runState.status === 'running';

  return useMemo(() => ({
    runState,
    graphState,
    isRunning,
    content: runState.content,
    thinking: runState.thinking,
    run,
    cancel,
    reset,
    loadHistoricalState,
  }), [runState, graphState, isRunning, run, cancel, reset, loadHistoricalState]);
}

export default useGraphRunner;
