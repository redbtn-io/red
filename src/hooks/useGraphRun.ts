/**
 * useGraphRun - Unified hook for running graphs
 *
 * This hook provides a clean interface for:
 * 1. Starting a graph run
 * 2. Receiving real-time events via SSE
 * 3. Tracking graph node execution state
 * 4. Accumulating content and thinking output
 *
 * Used by both Chat and Automations pages.
 */

import { useCallback, useRef, useState } from 'react';

// =============================================================================
// Types
// =============================================================================

export type NodeStatus = 'pending' | 'running' | 'completed' | 'error';
export type RunStatus = 'idle' | 'starting' | 'running' | 'completed' | 'error';

export interface NodeState {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: NodeStatus;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface GraphRunState {
  runId: string | null;
  graphId: string | null;
  graphName: string | null;
  status: RunStatus;
  currentNodeId: string | null;
  executionPath: string[];
  nodes: Record<string, NodeState>;
  content: string;
  thinking: string;
  error: string | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface RunEvent {
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
  [key: string]: unknown;
}

export interface StartRunOptions {
  message: string;
  conversationId?: string;
  graphId?: string;
  userMessageId?: string;
  onEvent?: (event: RunEvent) => void;
  onNodeStart?: (nodeId: string, nodeName: string) => void;
  onNodeComplete?: (nodeId: string, nextNodeId: string | null) => void;
  onChunk?: (chunk: string, isThinking: boolean) => void;
  onComplete?: (content: string, thinking: string) => void;
  onError?: (error: string) => void;
}

export interface UseGraphRunReturn {
  state: GraphRunState;
  isRunning: boolean;
  startRun: (options: StartRunOptions) => Promise<void>;
  cancelRun: () => void;
  reset: () => void;
}

// =============================================================================
// Initial State
// =============================================================================

const createInitialState = (): GraphRunState => ({
  runId: null,
  graphId: null,
  graphName: null,
  status: 'idle',
  currentNodeId: null,
  executionPath: [],
  nodes: {},
  content: '',
  thinking: '',
  error: null,
  startedAt: null,
  completedAt: null,
});

// =============================================================================
// Hook Implementation
// =============================================================================

export function useGraphRun(): UseGraphRunReturn {
  const [state, setState] = useState<GraphRunState>(createInitialState());
  const abortControllerRef = useRef<AbortController | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const reset = useCallback(() => {
    setState(createInitialState());
  }, []);

  const cancelRun = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (readerRef.current) {
      readerRef.current.cancel().catch(() => {});
      readerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      status: prev.status === 'running' ? 'error' : prev.status,
      error: prev.status === 'running' ? 'Cancelled' : prev.error,
    }));
  }, []);

  const startRun = useCallback(async (options: StartRunOptions) => {
    const {
      message,
      conversationId,
      graphId,
      userMessageId,
      onEvent,
      onNodeStart,
      onNodeComplete,
      onChunk,
      onComplete,
      onError,
    } = options;

    // Cancel any existing run
    cancelRun();

    // Generate IDs
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const msgId = userMessageId || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Initialize state
    setState({
      ...createInitialState(),
      runId,
      status: 'starting',
      startedAt: Date.now(),
    });

    // Create abort controller
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    // Accumulate content locally for callbacks
    let accumulatedContent = '';
    let accumulatedThinking = '';

    try {
      // 1. Connect to SSE stream FIRST (before triggering run)
      const streamUrl = `/api/v1/runs/${runId}/stream`;
      console.log(`[GraphRun] Connecting to SSE: ${streamUrl}`);

      const sseResponse = await fetch(streamUrl, {
        method: 'GET',
        credentials: 'include',
        signal,
      });

      if (!sseResponse.ok) {
        throw new Error(`SSE connection failed: ${sseResponse.status}`);
      }

      const reader = sseResponse.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      readerRef.current = reader;

      console.log(`[GraphRun] SSE connected, triggering run`);

      // 2. Trigger the run via POST (don't await - let it run in background)
      const triggerPromise = fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({
          model: 'Red',
          messages: [{ role: 'user', content: message }],
          stream: true,
          conversationId,
          graphId,
          userMessageId: msgId,
          runId,
        }),
      });

      // Update status to running
      setState(prev => ({ ...prev, status: 'running' }));

      // 3. Process SSE events
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvent = (event: RunEvent) => {
        onEvent?.(event);

        switch (event.type) {
          case 'run_start':
            setState(prev => ({
              ...prev,
              graphId: event.graphId || prev.graphId,
              graphName: event.graphName || prev.graphName,
            }));
            break;

          case 'node_start':
            if (event.nodeId) {
              const nodeState: NodeState = {
                nodeId: event.nodeId,
                nodeName: event.nodeName || event.nodeId,
                nodeType: event.nodeType || 'unknown',
                status: 'running',
                startedAt: event.timestamp || Date.now(),
              };
              setState(prev => ({
                ...prev,
                currentNodeId: event.nodeId!,
                executionPath: [...prev.executionPath.filter(id => id !== event.nodeId), event.nodeId!],
                nodes: { ...prev.nodes, [event.nodeId!]: nodeState },
              }));
              onNodeStart?.(event.nodeId, event.nodeName || event.nodeId);
            }
            break;

          case 'node_complete':
            if (event.nodeId) {
              setState(prev => {
                const existingNode = prev.nodes[event.nodeId!];
                return {
                  ...prev,
                  currentNodeId: event.nextNodeId || null,
                  nodes: {
                    ...prev.nodes,
                    [event.nodeId!]: {
                      ...existingNode,
                      status: 'completed',
                      completedAt: event.timestamp || Date.now(),
                    },
                  },
                };
              });
              onNodeComplete?.(event.nodeId, event.nextNodeId || null);
            }
            break;

          case 'node_error':
            if (event.nodeId) {
              setState(prev => {
                const existingNode = prev.nodes[event.nodeId!];
                return {
                  ...prev,
                  nodes: {
                    ...prev.nodes,
                    [event.nodeId!]: {
                      ...existingNode,
                      status: 'error',
                      error: event.error,
                      completedAt: event.timestamp || Date.now(),
                    },
                  },
                };
              });
            }
            break;

          case 'chunk':
            if (event.chunk) {
              accumulatedContent += event.chunk;
              setState(prev => ({
                ...prev,
                content: prev.content + event.chunk,
              }));
              onChunk?.(event.chunk, false);
            }
            break;

          case 'thinking_chunk':
            if (event.chunk) {
              accumulatedThinking += event.chunk;
              setState(prev => ({
                ...prev,
                thinking: prev.thinking + event.chunk,
              }));
              onChunk?.(event.chunk, true);
            }
            break;

          case 'run_complete':
            setState(prev => ({
              ...prev,
              status: 'completed',
              completedAt: Date.now(),
            }));
            onComplete?.(accumulatedContent, accumulatedThinking);
            break;

          case 'run_error':
            setState(prev => ({
              ...prev,
              status: 'error',
              error: event.error || 'Unknown error',
              completedAt: Date.now(),
            }));
            onError?.(event.error || 'Unknown error');
            break;
        }
      };

      // Read SSE stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') {
              console.log(`[GraphRun] Stream complete`);
              break;
            }
            try {
              const event = JSON.parse(data) as RunEvent;
              processEvent(event);
            } catch (e) {
              console.warn('[GraphRun] Failed to parse event:', data);
            }
          }
        }
      }

      // Wait for trigger to complete (in case of errors)
      const triggerResponse = await triggerPromise;
      if (!triggerResponse.ok) {
        const errorText = await triggerResponse.text();
        console.error('[GraphRun] Trigger failed:', errorText);
        // Only update error if we're not already completed
        setState(prev => {
          if (prev.status === 'completed') return prev;
          return {
            ...prev,
            status: 'error',
            error: `Trigger failed: ${triggerResponse.status}`,
          };
        });
      }

    } catch (error) {
      if (signal.aborted) {
        console.log('[GraphRun] Run cancelled');
        return;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[GraphRun] Error:', errorMessage);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
        completedAt: Date.now(),
      }));
      onError?.(errorMessage);
    } finally {
      readerRef.current = null;
      abortControllerRef.current = null;
    }
  }, [cancelRun]);

  return {
    state,
    isRunning: state.status === 'starting' || state.status === 'running',
    startRun,
    cancelRun,
    reset,
  };
}

export default useGraphRun;
