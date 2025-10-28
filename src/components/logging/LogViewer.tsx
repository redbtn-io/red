/**
 * LogViewer - Main component for displaying logs with real-time streaming
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cardClass, toolbarClass, toolbarBtn, toolbarActive, logLineClass } from './logStyles';

// Define LogEntry type locally to avoid importing server modules
interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'success' | 'warning' | 'error';
  category: string;
  message: string;
  generationId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

// Color tag parsing functions
function stripColorTags(text: string): string {
  return text.replace(/<\/?(?:red|green|yellow|blue|magenta|cyan|white|black|gray|dim|bold|underline|blink|reverse|hidden)>/gi, '');
}

function parseColorTagsToHtml(text: string): string {
  const colorMap: Record<string, string> = {
    red: 'text-red-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
    magenta: 'text-magenta-400',
    cyan: 'text-cyan-400',
    white: 'text-white',
    gray: 'text-gray-400',
    dim: 'text-gray-500',
    bold: 'font-bold',
  };
  
  let html = text;
  
  // Replace opening tags
  Object.entries(colorMap).forEach(([color, className]) => {
    const regex = new RegExp(`<${color}>`, 'gi');
    html = html.replace(regex, `<span class="${className}">`);
  });
  
  // Replace closing tags
  html = html.replace(/<\/(?:red|green|yellow|blue|magenta|cyan|white|black|gray|dim|bold|underline|blink|reverse|hidden)>/gi, '</span>');
  
  return html;
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
  const [compact, setCompact] = useState(false);
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
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
        <div className="text-6xl mb-4">📝</div>
        <h2 className="text-xl font-semibold text-gray-300 mb-2">
          No logs selected
        </h2>
        <p className="text-gray-500">
          Enter a conversation ID or generation ID to view logs
        </p>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-12 text-center">
        <div className="inline-block w-8 h-8 border-4 border-[var(--background)] border-t-[var(--red-primary)] rounded-full animate-spin mb-4"></div>
        <p className="text-[var(--foreground)] opacity-60">Loading logs...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--border-color)] p-6">
        <div className="flex items-start gap-3">
          <div className="text-2xl">❌</div>
          <div>
            <h3 className="font-semibold text-[var(--red-primary)] mb-1">Error loading logs</h3>
            <p className="text-[var(--foreground)] opacity-60 text-sm">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
  <div className={cardClass}>
      {/* Toolbar */}
      <div className={toolbarClass}>
        <div className="text-sm text-[var(--foreground)] opacity-70">
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
          <button
            onClick={() => setCompact(!compact)}
            className={`${toolbarBtn} ${compact ? toolbarActive : ''}`}
            title={compact ? 'Disable compact view' : 'Enable compact view'}
          >
            {compact ? '� Compact' : '�'}
          </button>
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
      <div className="p-4 max-h-[70vh] overflow-y-auto font-sans text-sm">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-[var(--foreground)] opacity-60">
            No logs match the current filters
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <LogLine key={log.id} log={log} compact={compact} />
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

// Individual log line component
function LogLine({ log, compact }: { log: LogEntry; compact?: boolean }) {
  const levelColors: Record<string, string> = {
    debug: 'text-gray-500',
    info: 'text-blue-400',
    success: 'text-green-400',
    warning: 'text-yellow-400',
    error: 'text-red-400',
  };

  const levelIcons: Record<string, string> = {
    debug: '🐛',
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  const timestamp = new Date(log.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });

  // Parse color tags to HTML
  const messageHtml = parseColorTagsToHtml(log.message);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`${logLineClass} ${compact ? 'py-2 px-2' : 'py-3 px-3'}`}>
      {/* Metadata line */}
      <div className={`flex items-center gap-3 ${compact ? 'mb-1' : 'mb-2'} flex-wrap`}>
        <span className="text-[var(--foreground)]/70 text-xs tabular-nums shrink-0">{timestamp}</span>
        <span className="shrink-0" title={log.level}>{levelIcons[log.level] || '•'}</span>
        <span className={`shrink-0 text-xs uppercase font-semibold ${levelColors[log.level]}`}>{log.level}</span>
        <span className="shrink-0 text-xs text-[var(--foreground)]/60 uppercase">{log.category}</span>

        {/* Expand / collapse */}
        <button
          onClick={() => setExpanded((s) => !s)}
          className="ml-auto text-xs px-2 py-1 rounded bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--background)]/60"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      {/* Message line */}
      {(!compact || expanded) && (
        <>
          <div className="pl-2 break-words text-sm leading-relaxed font-mono text-[var(--foreground)]/90">
            <div dangerouslySetInnerHTML={{ __html: messageHtml }} />
          </div>
          
          {/* Metadata section - show when expanded */}
          {expanded && log.metadata && Object.keys(log.metadata).length > 0 && (
            <div className="mt-3 pl-2 border-l-2 border-[var(--border-color)] ml-2">
              <div className="text-xs text-[var(--foreground)]/60 font-semibold mb-2 uppercase">Metadata</div>
              <div className="space-y-1">
                {Object.entries(log.metadata).map(([key, value]) => (
                  <div key={key} className="flex gap-2 text-xs">
                    <span className="text-cyan-400 font-mono shrink-0">{key}:</span>
                    <span className="text-[var(--foreground)]/80 font-mono break-all">
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
