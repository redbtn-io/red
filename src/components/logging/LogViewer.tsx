/**
 * LogViewer - Main component for displaying logs with real-time streaming
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { List, Rows3, Maximize2, SquareTerminal } from 'lucide-react';
import { cardClass, toolbarClass, toolbarBtn, toolbarActive, logLineClass } from './logStyles';
import { parseColorTagsToTailwind, stripColorTags } from '@redbtn/redlog/colors';

// Define LogEntry type locally to avoid importing server modules
interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'success' | 'warning' | 'error';
  category?: string;
  message: string;
  namespace?: string;
  scope?: {
    generationId?: string;
    conversationId?: string;
    [key: string]: string | undefined;
  };
  metadata?: Record<string, unknown>;
  // Backward compat with old LogEntry shape
  generationId?: string;
  conversationId?: string;
}

interface LogViewerProps {
  conversationId: string;
  generationId: string;
  filterLevel: string;
  filterCategory: string;
  showThoughts: boolean;
  onStreamingChange: (isStreaming: boolean) => void;
}

// Type guard for payloads returned by the logs API
function isLogPayload(obj: unknown): obj is { logs: LogEntry[] } {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(o, 'logs')) return false;
  const logsValue = o['logs'] as unknown;
  return Array.isArray(logsValue);
}

export function LogViewer({
  conversationId,
  generationId,
  filterLevel,
  filterCategory,
  showThoughts,
  onStreamingChange,
}: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [viewMode, setViewMode] = useState<'default' | 'compact' | 'expanded' | 'terminal'>('default');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Stream logs (declare early so effects can reference it)
  const startStreaming = useCallback(async () => {
    onStreamingChange(true);

    try {
      const streamUrl = generationId
        ? `/api/v1/generations/${generationId}/stream`
        : `/api/v1/conversations/${conversationId}/stream`;

      const response = await fetch(streamUrl);
      if (!response.ok) throw new Error('Failed to stream logs');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream not available');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed && typeof parsed === 'object' && 'id' in parsed && 'timestamp' in parsed) {
                setLogs((prev) => [...prev, parsed as LogEntry]);
              }
            } catch (e) {
              console.error('Failed to parse log:', e);
            }
          } else if (line.startsWith('event: complete')) {
            onStreamingChange(false);
            return;
          }
        }
      }
    } catch (err: unknown) {
      console.error('Streaming error:', err instanceof Error ? err.message : String(err));
      onStreamingChange(false);
    }
  }, [conversationId, generationId, onStreamingChange]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Fetch logs
  useEffect(() => {
    if (!conversationId && !generationId) {
      setLogs([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    
    const fetchLogs = async () => {
      setIsLoading(true);
      setError(null);
      onStreamingChange(false);

      try {
        let shouldStream = false;

        if (generationId) {
          // Fetch specific generation
          const response = await fetch(`/api/v1/generations/${generationId}/logs`, {
            signal: abortControllerRef.current?.signal,
          });
          
          if (!response.ok) throw new Error('Failed to fetch logs');
          
          const data = await response.json() as unknown;
          if (isLogPayload(data)) {
            setLogs(data.logs as LogEntry[]);
          }
          
          // Check if generation is still active - if so, stream it
          const genResponse = await fetch(`/api/v1/generations/${generationId}`);
          const generation = await genResponse.json() as unknown;
          const gen = generation as Record<string, unknown>;
          if (gen && typeof gen.status === 'string') {
            shouldStream = gen.status === 'generating';
          }
          
        } else if (conversationId) {
          // Fetch conversation logs
          const response = await fetch(`/api/v1/conversations/${conversationId}/logs`, {
            signal: abortControllerRef.current?.signal,
          });
          
          if (!response.ok) throw new Error('Failed to fetch logs');
          
          const data = await response.json() as unknown;
          if (isLogPayload(data)) {
            setLogs(data.logs as LogEntry[]);
          }
          
          // Check if any generation is active
          const stateResponse = await fetch(`/api/v1/conversations/${conversationId}/generation-state`);
          const state = await stateResponse.json() as unknown;
          const st = state as Record<string, unknown>;
          if (st && typeof st.isGenerating === 'boolean') {
            shouldStream = st.isGenerating as boolean;
          }
        }

        setIsLoading(false);

        // Start streaming if generation is active
        if (shouldStream) {
          startStreaming();
        }
      } catch (err: unknown) {
        // Normalize error and ignore AbortError
        const eObj = err as Record<string, unknown> | null;
        const isAbort = eObj && typeof eObj.name === 'string' && eObj.name === 'AbortError';
        const message = isAbort ? null : (err instanceof Error ? err.message : String(err));

        if (message) {
          setError(message);
          setIsLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [conversationId, generationId, startStreaming, onStreamingChange]);

  // Stream logs (already declared above)

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'all' && log.level !== filterLevel) return false;
    if (filterCategory !== 'all' && log.category !== filterCategory) return false;
    if (!showThoughts && log.category === 'thought') return false;
    return true;
  });

  // Render empty state
  if (!conversationId && !generationId) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border p-12 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h2 className="text-xl font-semibold text-text-secondary mb-2">
          No logs selected
        </h2>
        <p className="text-text-muted">
          Enter a conversation ID or generation ID to view logs
        </p>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-bg-primary border-t-accent rounded-full animate-spin mb-4"></div>
        <p className="text-text-primary opacity-60">Loading logs...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-bg-secondary rounded-lg border border-border p-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">❌</div>
          <div>
            <h3 className="font-semibold text-accent mb-1">Error loading logs</h3>
            <p className="text-text-primary opacity-60 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className={cardClass}>
      {/* Toolbar */}
      <div className={toolbarClass}>
        <div className="text-sm text-text-primary opacity-70">
          <span className="font-medium">{filteredLogs.length}</span> {filteredLogs.length === 1 ? 'log' : 'logs'}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`${toolbarBtn} ${autoScroll ? toolbarActive : ''}`}
            title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
          >
            {autoScroll ? '📌 Auto' : '📌'}
          </button>

          {/* View mode buttons */}
          <div className="flex items-center bg-bg-primary rounded overflow-hidden border border-border/30">
            <button
              onClick={() => setViewMode('default')}
              className={`p-1.5 ${viewMode === 'default' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-primary/60'}`}
              title="Default view"
            >
              <Rows3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-1.5 ${viewMode === 'compact' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-primary/60'}`}
              title="Compact view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('expanded')}
              className={`p-1.5 ${viewMode === 'expanded' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-primary/60'}`}
              title="Expanded view (all details open)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('terminal')}
              className={`p-1.5 ${viewMode === 'terminal' ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-primary/60'}`}
              title="Terminal view"
            >
              <SquareTerminal className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setLogs([])}
            className={toolbarBtn}
            title="Clear logs"
          >
            🗑️
          </button>
          <button
            onClick={() => {
              const text = filteredLogs
                .map((log) => `[${new Date(log.timestamp).toISOString()}] [${log.level}] ${stripColorTags(log.message)}`)
                .join('\n');
              navigator.clipboard.writeText(text);
            }}
            className={toolbarBtn}
            title="Copy logs"
          >
            📋
          </button>
        </div>
      </div>

      {/* Logs */}
      <div className={`${viewMode === 'terminal' ? 'p-0' : 'p-4'} max-h-[70vh] overflow-y-auto font-sans text-sm`}>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-text-primary opacity-60">
            No logs match the current filters
          </div>
        ) : viewMode === 'terminal' ? (
          <div className="bg-[#0c0c0c] p-4 font-mono text-xs leading-relaxed select-text cursor-text whitespace-pre-wrap">
            {filteredLogs.map((log) => (
              <TerminalLogLine key={log.id} log={log} />
            ))}
            <div ref={logsEndRef} />
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <LogLine key={log.id} log={log} viewMode={viewMode} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// Individual log line component
function LogLine({ log, viewMode }: { log: LogEntry; viewMode: 'default' | 'compact' | 'expanded' | 'terminal' }) {
  const levelColors: Record<string, string> = {
    debug: 'text-text-muted',
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const levelBgColors: Record<string, string> = {
    debug: 'bg-gray-500/10',
    info: 'bg-blue-500/10',
    success: 'bg-green-500/10',
    warning: 'bg-yellow-500/10',
    error: 'bg-red-500/10',
  };

  const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  // Parse color tags to Tailwind spans
  const messageHtml = parseColorTagsToTailwind(log.message);
  const isCompact = viewMode === 'compact';
  const isExpanded = viewMode === 'expanded';
  const [expanded, setExpanded] = useState(isExpanded);

  // Sync with viewMode changes
  useEffect(() => {
    if (viewMode === 'expanded') setExpanded(true);
    else if (viewMode === 'compact' || viewMode === 'default') setExpanded(false);
  }, [viewMode]);

  return (
    <div className={`${logLineClass} ${isCompact ? 'py-2 px-2' : 'py-3 px-3'}`}>
      {/* Metadata line */}
      <div className={`flex items-center gap-3 ${isCompact ? 'mb-0' : 'mb-2'} flex-wrap`}>
        <span className="text-text-primary/70 text-xs tabular-nums shrink-0">{timestamp}</span>
        <span className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${levelColors[log.level]} ${levelBgColors[log.level]}`}>{log.level}</span>
        <span className="shrink-0 text-xs text-text-primary/60 uppercase">{log.category}</span>

        {/* Inline message in compact mode */}
        {isCompact && (
          <span className="text-sm font-mono text-text-primary/90 truncate flex-1 min-w-0 ml-1">
            <span dangerouslySetInnerHTML={{ __html: messageHtml }} />
          </span>
        )}

        {/* Expand / collapse */}
        {!isCompact && (
          <button
            onClick={() => setExpanded((s) => !s)}
            className="ml-auto text-xs px-2 py-1 rounded bg-bg-primary text-text-primary hover:bg-bg-primary/60"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? '▾' : '▸'}
          </button>
        )}
      </div>

      {/* Message line - shown in default/expanded, hidden in compact */}
      {!isCompact && (
        <>
          <div className="pl-2 break-words text-sm leading-relaxed font-mono text-text-primary/90">
            <div dangerouslySetInnerHTML={{ __html: messageHtml }} />
          </div>
          
          {/* Metadata section - show when expanded */}
          {expanded && log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="mt-3 pl-2 border-l-2 border-border ml-2">
              <div className="text-xs text-text-primary/60 font-semibold mb-2 uppercase">Metadata</div>
              <div className="space-y-1">
                {Object.entries(log.metadata).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-cyan-400 font-mono shrink-0">{key}:</span>
                    <span className="text-text-primary/80 font-mono break-all">
                      {typeof value === 'object' 
                        ? JSON.stringify(value, null, 2)
                        : String(value)
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Terminal-style log line - plain text, selectable
function TerminalLogLine({ log }: { log: LogEntry }) {
  const levelColors: Record<string, string> = {
    debug: 'text-gray-500',
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  const plainMessage = stripColorTags(log.message);

  // Build metadata lines with pretty-printed JSON
  const metaEntries = log.metadata
    ? Object.entries(log.metadata).filter(([k]) => !['runId', 'userId', 'graphId', 'graphName'].includes(k))
    : [];

  const formatValue = (v: unknown): string => {
    if (typeof v === 'object' && v !== null) return JSON.stringify(v, null, 2);
    return String(v);
  };

  return (
    <div className={`py-0.5 ${log.level === 'error' ? 'text-red-400' : log.level === 'warning' ? 'text-yellow-400' : 'text-gray-300'}`}>
      <span className="text-gray-600">{timestamp}</span>
      {' '}
      <span className={levelColors[log.level]}>[{log.level.toUpperCase().padEnd(7)}]</span>
      {' '}
      {log.category && <span className="text-gray-500">[{log.category.toUpperCase()}]</span>}
      {log.category && ' '}
      <span>{plainMessage}</span>
      {metaEntries.length > 0 && (
        <div className="text-gray-500 ml-[2ch] mt-0.5 border-l border-gray-800 pl-2">
          {metaEntries.map(([k, v]) => {
            const formatted = formatValue(v);
            const isMultiline = formatted.includes('\n');
            return (
              <div key={k} className="py-px">
                <span className="text-cyan-700">{k}</span>
                <span className="text-gray-700">{isMultiline ? ':\n' : ': '}</span>
                <span className="text-gray-500">{formatted}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
