/**
 * useRunStream Hook
 *
 * Connects to the new SSE endpoint at /api/v1/runs/[runId]/stream
 * for receiving run events. Works with the v2 completions API.
 *
 * @module hooks/useRunStream
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// =============================================================================
// Types
// =============================================================================

export type RunStatus = 'pending' | 'running' | 'completed' | 'error';

export interface RunEvent {
  type: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface NodeProgress {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  nodeName?: string;
  nodeType?: string;
  stepName?: string;
  currentStep?: number;
  totalSteps?: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface ToolProgress {
  toolId: string;
  toolName: string;
  toolType: string;
  status: 'running' | 'completed' | 'error';
  stepName?: string;
  progress?: number;
  startTime?: number;
  endTime?: number;
  error?: string;
}

export interface RunState {
  runId: string;
  graphId?: string;
  graphName?: string;
  status: RunStatus;
  content: string;
  thinking: string;
  error?: string;
  nodeProgress: Record<string, NodeProgress>;
  toolProgress: Record<string, ToolProgress>;
  executionPath: string[];
  startTime?: number;
  endTime?: number;
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
}

export interface UseRunStreamOptions {
  /** Called when content chunks are received */
  onChunk?: (content: string, isThinking: boolean) => void;
  /** Called on run completion */
  onComplete?: (state: RunState) => void;
  /** Called on run error */
  onError?: (error: string) => void;
  /** Called for each event (for debugging or custom handling) */
  onEvent?: (event: RunEvent) => void;
}

export interface UseRunStreamReturn {
  /** Current run state */
  runState: RunState | null;
  /** Whether the stream is connected */
  isConnected: boolean;
  /** Whether the run is in progress */
  isRunning: boolean;
  /** Connect to a run stream */
  connect: (runId: string) => void;
  /** Disconnect from the current stream */
  disconnect: () => void;
  /** Accumulated content */
  content: string;
  /** Accumulated thinking */
  thinking: string;
}

// =============================================================================
// Initial State Factory
// =============================================================================

function createInitialRunState(runId: string): RunState {
  return {
    runId,
    status: 'pending',
    content: '',
    thinking: '',
    nodeProgress: {},
    toolProgress: {},
    executionPath: [],
  };
}

// =============================================================================
// Hook
// =============================================================================

export function useRunStream(options: UseRunStreamOptions = {}): UseRunStreamReturn {
  const { onChunk, onComplete, onError, onEvent } = options;

  // State
  const [runState, setRunState] = useState<RunState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [content, setContent] = useState('');
  const [thinking, setThinking] = useState('');

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);
  const runIdRef = useRef<string | null>(null);
  const connectStartRef = useRef<number | null>(null);
  const openTimeRef = useRef<number | null>(null);

  // Disconnect from stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      console.log('[useRunStream] Disconnecting from stream');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    runIdRef.current = null;
  }, []);

  // Connect to a run stream
  const connect = useCallback((runId: string) => {
    // Disconnect from any existing stream
    disconnect();

    console.log(`[useRunStream] Connecting to run ${runId}`);
    runIdRef.current = runId;

    // Initialize state
    const initialState = createInitialRunState(runId);
    setRunState(initialState);
    setContent('');
    setThinking('');
    setIsRunning(true);

    // Create EventSource
    const url = `/api/v1/runs/${runId}/stream`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    eventSource.onopen = () => {
      openTimeRef.current = Date.now();
      console.log(`[useRunStream] Connected to ${url} at ${new Date(openTimeRef.current).toISOString()}`);
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      console.error('[useRunStream] EventSource error:', error);
      // Don't set disconnected on transient errors - SSE will reconnect
      if (eventSource.readyState === EventSource.CLOSED) {
        setIsConnected(false);
        setIsRunning(false);
      }
    };

    eventSource.onmessage = (event) => {
      const arrival = Date.now();
      console.log(`[useRunStream] message arrived ${new Date(arrival).toISOString()} (run=${runId})`);
      // Handle [DONE] signal
      if (event.data === '[DONE]') {
        console.log('[useRunStream] Received [DONE]');
        disconnect();
        return;
      }

      try {
        const data = JSON.parse(event.data) as RunEvent;
        // Log event timing and deltas
        const evtTs = (data && (data as any).timestamp) ? (data as any).timestamp : undefined;
        const delta = evtTs ? (arrival - evtTs) : undefined;
        console.log(`[useRunStream] event parsed type=${data.type} runId=${(data as any).runId||runId} nodeId=${(data as any).nodeId||''} eventTs=${evtTs ? new Date(evtTs).toISOString() : 'n/a'} now=${new Date(arrival).toISOString()} delta_ms=${delta ?? 'n/a'}`);
        
        // Call event handler if provided
        onEvent?.(data);

        // Process event based on type
        setRunState((prev) => {
          if (!prev) return prev;
          return processEvent(prev, data, {
            onChunk: (c, isThinking) => {
              if (isThinking) {
                setThinking((t) => t + c);
              } else {
                setContent((ct) => ct + c);
              }
              onChunk?.(c, isThinking);
            },
            onComplete,
            onError,
            setIsRunning,
          });
        });
      } catch (e) {
        console.error('[useRunStream] Failed to parse event:', e, event.data);
      }
    };
  }, [disconnect, onChunk, onComplete, onError, onEvent]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    runState,
    isConnected,
    isRunning,
    connect,
    disconnect,
    content,
    thinking,
  };
}

// =============================================================================
// Event Processor
// =============================================================================

interface EventCallbacks {
  onChunk: (content: string, isThinking: boolean) => void;
  onComplete?: (state: RunState) => void;
  onError?: (error: string) => void;
  setIsRunning: (running: boolean) => void;
}

function processEvent(
  state: RunState,
  event: RunEvent,
  callbacks: EventCallbacks
): RunState {
  const { onChunk, onComplete, onError, setIsRunning } = callbacks;

  switch (event.type) {
    case 'init': {
      // Replay existing state
      const initEvent = event as any;
      if (initEvent.state) {
        return {
          ...state,
          ...initEvent.state,
          runId: state.runId,
        };
      }
      return state;
    }

    case 'run_start': {
      const e = event as any;
      return {
        ...state,
        graphId: e.graphId,
        graphName: e.graphName,
        status: 'running',
        startTime: e.timestamp,
      };
    }

    case 'run_complete': {
      const e = event as any;
      const finalState: RunState = {
        ...state,
        status: 'completed',
        endTime: e.timestamp,
        metadata: e.metadata || state.metadata,
      };
      setIsRunning(false);
      onComplete?.(finalState);
      return finalState;
    }

    case 'run_error': {
      const e = event as any;
      const errorState: RunState = {
        ...state,
        status: 'error',
        error: e.error,
        endTime: e.timestamp,
      };
      setIsRunning(false);
      onError?.(e.error);
      return errorState;
    }

    case 'status': {
      // Status updates (routing, processing, etc.)
      return state;
    }

    case 'graph_start': {
      const e = event as any;
      return {
        ...state,
        status: 'running',
        executionPath: e.entryNodeId ? [e.entryNodeId] : [],
      };
    }

    case 'graph_complete':
    case 'graph_error': {
      // Handled by run_complete/run_error
      return state;
    }

    case 'node_start': {
      const e = event as any;
      return {
        ...state,
        executionPath: [...state.executionPath, e.nodeId],
        nodeProgress: {
          ...state.nodeProgress,
          [e.nodeId]: {
            nodeId: e.nodeId,
            nodeName: e.nodeName,
            nodeType: e.nodeType,
            status: 'running',
            startTime: e.timestamp,
          },
        },
      };
    }

    case 'node_progress': {
      const e = event as any;
      const existing = state.nodeProgress[e.nodeId] || { nodeId: e.nodeId, status: 'running' };
      return {
        ...state,
        nodeProgress: {
          ...state.nodeProgress,
          [e.nodeId]: {
            ...existing,
            stepName: e.step,
            currentStep: e.stepIndex,
            totalSteps: e.totalSteps,
          },
        },
      };
    }

    case 'node_complete': {
      const e = event as any;
      const existing = state.nodeProgress[e.nodeId] || { nodeId: e.nodeId, status: 'running' };
      return {
        ...state,
        nodeProgress: {
          ...state.nodeProgress,
          [e.nodeId]: {
            ...existing,
            status: 'completed',
            endTime: e.timestamp,
          },
        },
      };
    }

    case 'node_error': {
      const e = event as any;
      const existing = state.nodeProgress[e.nodeId] || { nodeId: e.nodeId, status: 'running' };
      return {
        ...state,
        nodeProgress: {
          ...state.nodeProgress,
          [e.nodeId]: {
            ...existing,
            status: 'error',
            error: e.error,
            endTime: e.timestamp,
          },
        },
      };
    }

    case 'chunk': {
      const e = event as any;
      const isThinking = e.thinking === true;
      onChunk(e.content, isThinking);
      return {
        ...state,
        content: isThinking ? state.content : state.content + e.content,
        thinking: isThinking ? state.thinking + e.content : state.thinking,
      };
    }

    case 'thinking_complete': {
      // Thinking is done, subsequent chunks are content
      return state;
    }

    case 'tool_start': {
      const e = event as any;
      return {
        ...state,
        toolProgress: {
          ...state.toolProgress,
          [e.toolId]: {
            toolId: e.toolId,
            toolName: e.toolName,
            toolType: e.toolType,
            status: 'running',
            startTime: e.timestamp,
          },
        },
      };
    }

    case 'tool_progress': {
      const e = event as any;
      const existing = state.toolProgress[e.toolId] || {
        toolId: e.toolId,
        toolName: '',
        toolType: '',
        status: 'running' as const,
      };
      return {
        ...state,
        toolProgress: {
          ...state.toolProgress,
          [e.toolId]: {
            ...existing,
            stepName: e.step,
            progress: e.progress,
          },
        },
      };
    }

    case 'tool_complete': {
      const e = event as any;
      const existing = state.toolProgress[e.toolId] || {
        toolId: e.toolId,
        toolName: '',
        toolType: '',
        status: 'running' as const,
      };
      return {
        ...state,
        toolProgress: {
          ...state.toolProgress,
          [e.toolId]: {
            ...existing,
            status: 'completed',
            endTime: e.timestamp,
          },
        },
      };
    }

    case 'tool_error': {
      const e = event as any;
      const existing = state.toolProgress[e.toolId] || {
        toolId: e.toolId,
        toolName: '',
        toolType: '',
        status: 'running' as const,
      };
      return {
        ...state,
        toolProgress: {
          ...state.toolProgress,
          [e.toolId]: {
            ...existing,
            status: 'error',
            error: e.error,
            endTime: e.timestamp,
          },
        },
      };
    }

    default:
      // Unknown event type - ignore
      return state;
  }
}

export default useRunStream;
