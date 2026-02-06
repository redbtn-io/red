'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings } from 'lucide-react';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system' | 'streaming';
  content: string;
  timestamp: Date;
}

interface GraphOption {
  graphId: string;
  name: string;
  isSystem: boolean;
  isDefault?: boolean;
}

interface TerminalProps {
  initialGraphId?: string;
}

// Generate a stable terminal conversation ID for this browser session
const TERMINAL_CONVERSATION_KEY = 'redbtn_terminal_conversation_id';

function getTerminalConversationId(): string {
  if (typeof window === 'undefined') return `terminal-${Date.now()}`;
  
  let conversationId = localStorage.getItem(TERMINAL_CONVERSATION_KEY);
  if (!conversationId) {
    conversationId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(TERMINAL_CONVERSATION_KEY, conversationId);
  }
  return conversationId;
}

export function Terminal({ initialGraphId = 'red-assistant' }: TerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const [selectedGraphId, setSelectedGraphId] = useState(initialGraphId);
  const [graphs, setGraphs] = useState<GraphOption[]>([]);
  const [showGraphSelector, setShowGraphSelector] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const graphSelectorRef = useRef<HTMLDivElement>(null);

  // Initialize terminal
  useEffect(() => {
    const id = getTerminalConversationId();
    setConversationId(id);
    
    // Load graphs for selector
    fetchGraphs();
    
    // Load existing messages from this conversation
    loadConversationHistory(id);
  }, []);

  // Close graph selector on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (graphSelectorRef.current && !graphSelectorRef.current.contains(e.target as Node)) {
        setShowGraphSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchGraphs = async () => {
    try {
      const res = await fetch('/api/v1/graphs?limit=50', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const graphOptions: GraphOption[] = (data.graphs || [])
          .filter((g: any) => g.graphType === 'agent') // Only agent graphs for terminal
          .map((g: any) => ({
            graphId: g.graphId,
            name: g.name,
            isSystem: g.isSystem,
            isDefault: g.isDefault,
          }));
        setGraphs(graphOptions);
      }
    } catch (err) {
      console.error('Failed to fetch graphs:', err);
    }
  };

  const loadConversationHistory = async (convId: string) => {
    try {
      const res = await fetch(`/api/v1/conversations/${convId}/messages`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const messages = data.messages || [];
        
        // Convert stored messages to terminal lines
        const historyLines: TerminalLine[] = [];
        messages.forEach((msg: any) => {
          if (msg.role === 'user') {
            historyLines.push({
              id: `input-${msg.messageId}`,
              type: 'input',
              content: msg.content,
              timestamp: new Date(msg.createdAt),
            });
          } else if (msg.role === 'assistant') {
            historyLines.push({
              id: `output-${msg.messageId}`,
              type: 'output',
              content: msg.content,
              timestamp: new Date(msg.createdAt),
            });
          }
        });
        
        if (historyLines.length > 0) {
          setLines(historyLines);
        } else {
          // Show welcome message for new terminal
          setLines([
            {
              id: 'welcome',
              type: 'system',
              content: 'Welcome to redbtn Terminal v0.1.0',
              timestamp: new Date(),
            },
            {
              id: 'hint',
              type: 'system',
              content: 'Type "help" for commands or just start chatting.',
              timestamp: new Date(),
            },
          ]);
        }
      } else {
        // Conversation doesn't exist yet, show welcome
        setLines([
          {
            id: 'welcome',
            type: 'system',
            content: 'Welcome to redbtn Terminal v0.1.0',
            timestamp: new Date(),
          },
          {
            id: 'hint',
            type: 'system',
            content: 'Type "help" for commands or just start chatting.',
            timestamp: new Date(),
          },
        ]);
      }
    } catch (err) {
      // Show welcome on error
      setLines([
        {
          id: 'welcome',
          type: 'system',
          content: 'Welcome to redbtn Terminal v0.1.0',
          timestamp: new Date(),
        },
        {
          id: 'hint',
          type: 'system',
          content: 'Type "help" for commands or just start chatting.',
          timestamp: new Date(),
        },
      ]);
    }
    setIsInitialized(true);
  };

  // Add a line to the terminal
  const addLine = useCallback((line: Omit<TerminalLine, 'id' | 'timestamp'>) => {
    setLines(prev => [...prev, {
      ...line,
      id: `${line.type}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date(),
    }]);
  }, []);

  // Update the last streaming line
  const updateStreamingLine = useCallback((content: string) => {
    setLines(prev => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx].type === 'streaming') {
        const updated = [...prev];
        updated[lastIdx] = { ...updated[lastIdx], content };
        return updated;
      }
      return prev;
    });
  }, []);

  // Convert streaming line to output
  const finalizeStreamingLine = useCallback(() => {
    setLines(prev => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx].type === 'streaming') {
        const updated = [...prev];
        updated[lastIdx] = { ...updated[lastIdx], type: 'output' };
        return updated;
      }
      return prev;
    });
  }, []);

  // Remove the streaming line (on error)
  const removeStreamingLine = useCallback(() => {
    setLines(prev => {
      const lastIdx = prev.length - 1;
      if (lastIdx >= 0 && prev[lastIdx].type === 'streaming') {
        return prev.slice(0, -1);
      }
      return prev;
    });
  }, []);

  // Built-in commands
  const handleBuiltinCommand = async (cmd: string): Promise<boolean> => {
    const trimmed = cmd.trim().toLowerCase();
    const parts = trimmed.split(/\s+/);
    const command = parts[0];

    switch (command) {
      case 'help':
        addLine({ type: 'output', content: 'Available commands:' });
        addLine({ type: 'output', content: '  help     - Show this help message' });
        addLine({ type: 'output', content: '  status   - Show system status' });
        addLine({ type: 'output', content: '  graphs   - List available graphs' });
        addLine({ type: 'output', content: '  neurons  - List available neurons' });
        addLine({ type: 'output', content: '  clear    - Clear terminal & conversation' });
        addLine({ type: 'output', content: '  version  - Show version info' });
        addLine({ type: 'output', content: '  whoami   - Show current user' });
        addLine({ type: 'output', content: '  ping     - Test connection' });
        addLine({ type: 'output', content: '' });
        addLine({ type: 'output', content: 'Any other input is sent to the selected graph.' });
        return true;

      case 'clear':
        await clearConversation();
        return true;

      case 'status':
        await showStatus();
        return true;

      case 'graphs':
        await showGraphs();
        return true;

      case 'neurons':
        await showNeurons();
        return true;

      case 'version':
        addLine({ type: 'output', content: 'redbtn v0.1.0 (dynamic graph engine)' });
        return true;

      case 'whoami':
        await showWhoami();
        return true;

      case 'ping':
        await doPing();
        return true;

      default:
        return false;
    }
  };

  const clearConversation = async () => {
    // Clear local state
    setLines([{
      id: 'cleared',
      type: 'system',
      content: 'Terminal cleared',
      timestamp: new Date(),
    }]);

    // Delete conversation from backend
    try {
      await fetch(`/api/v1/conversations/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch (err) {
      // Ignore errors - conversation may not exist
    }

    // Generate new conversation ID
    const newId = `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(TERMINAL_CONVERSATION_KEY, newId);
    setConversationId(newId);

    addLine({
      type: 'system',
      content: 'New session started. Type "help" for commands.',
    });
  };

  const showStatus = async () => {
    try {
      const [healthRes, graphsRes, neuronsRes] = await Promise.all([
        fetch('/api/health', { credentials: 'include' }),
        fetch('/api/v1/graphs?limit=100', { credentials: 'include' }),
        fetch('/api/v1/neurons', { credentials: 'include' }),
      ]);

      const healthOk = healthRes.ok;
      const graphsData = graphsRes.ok ? await graphsRes.json() : { graphs: [] };
      const neuronsData = neuronsRes.ok ? await neuronsRes.json() : { neurons: [] };

      addLine({ type: 'output', content: '┌─────────────────────────────────────┐' });
      addLine({ type: 'output', content: '│  redbtn System Status               │' });
      addLine({ type: 'output', content: '├─────────────────────────────────────┤' });
      addLine({ type: 'output', content: `│  API:      ${healthOk ? '● Online' : '○ Offline'}                 │` });
      addLine({ type: 'output', content: `│  Graphs:   ${String(graphsData.graphs?.length || 0).padEnd(2)} loaded                 │` });
      addLine({ type: 'output', content: `│  Neurons:  ${String(neuronsData.neurons?.length || 0).padEnd(2)} available              │` });
      addLine({ type: 'output', content: '└─────────────────────────────────────┘' });
    } catch (err) {
      addLine({ type: 'error', content: 'Failed to fetch system status' });
    }
  };

  const showGraphs = async () => {
    try {
      const res = await fetch('/api/v1/graphs?limit=100', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      
      addLine({ type: 'output', content: 'Available Graphs:' });
      (data.graphs || []).forEach((g: any) => {
        const tags = [];
        if (g.isSystem) tags.push('system');
        if (g.isDefault) tags.push('default');
        if (g.graphId === selectedGraphId) tags.push('selected');
        const tagStr = tags.length > 0 ? ` (${tags.join(', ')})` : '';
        addLine({ type: 'output', content: `  • ${g.name}${tagStr}` });
      });
    } catch (err) {
      addLine({ type: 'error', content: 'Failed to fetch graphs' });
    }
  };

  const showNeurons = async () => {
    try {
      const res = await fetch('/api/v1/neurons', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      
      addLine({ type: 'output', content: 'Available Neurons:' });
      (data.neurons || []).forEach((n: any) => {
        addLine({ type: 'output', content: `  • ${n.name} (${n.provider}/${n.model})` });
      });
    } catch (err) {
      addLine({ type: 'error', content: 'Failed to fetch neurons' });
    }
  };

  const showWhoami = async () => {
    try {
      const res = await fetch('/api/v1/auth/me', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        addLine({ type: 'output', content: `User: ${data.user?.displayName || data.user?.email || 'Unknown'}` });
        addLine({ type: 'output', content: `Tier: ${data.user?.accountLevel || 4}` });
      } else {
        addLine({ type: 'error', content: 'Not authenticated' });
      }
    } catch (err) {
      addLine({ type: 'error', content: 'Failed to fetch user info' });
    }
  };

  const doPing = async () => {
    const start = Date.now();
    try {
      await fetch('/api/health', { credentials: 'include' });
      const latency = Date.now() - start;
      addLine({ type: 'output', content: `pong! (latency: ${latency}ms)` });
    } catch (err) {
      addLine({ type: 'error', content: 'Connection failed' });
    }
  };

  // Execute input via graph
  const executeViaGraph = async (userInput: string) => {
    // Add a streaming line with cursor indicator immediately
    addLine({ type: 'streaming', content: '' });
    
    try {
      abortControllerRef.current = new AbortController();
      
      // 1. POST to chat/completions to get runId and streamUrl
      const res = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: conversationId,
          messages: [{ role: 'user', content: userInput }],
          stream: true,
          graphId: selectedGraphId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        removeStreamingLine();
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        addLine({ type: 'error', content: errorData.error?.message || errorData.error || `Failed (${res.status})` });
        return;
      }

      const data = await res.json();
      const { runId, streamUrl } = data;
      
      if (!runId || !streamUrl) {
        removeStreamingLine();
        addLine({ type: 'error', content: 'No stream URL returned from server' });
        return;
      }

      // 2. Connect to SSE stream via EventSource
      let accumulated = '';
      
      await new Promise<void>((resolve, reject) => {
        // Close any existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }
        
        const eventSource = new EventSource(streamUrl, { withCredentials: true });
        eventSourceRef.current = eventSource;
        let resolved = false;
        
        // Timeout if nothing happens in 60 seconds
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            eventSource.close();
            eventSourceRef.current = null;
            reject(new Error('Stream timeout'));
          }
        }, 60000);
        
        const finish = () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          eventSource.close();
          eventSourceRef.current = null;
          resolve();
        };
        
        // Handle abort
        if (abortControllerRef.current) {
          abortControllerRef.current.signal.addEventListener('abort', () => {
            finish();
          });
        }
        
        eventSource.onerror = () => {
          // If we haven't received any data, this is a connection failure
          if (!accumulated && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            eventSource.close();
            eventSourceRef.current = null;
            reject(new Error('Stream connection failed'));
          }
          // Otherwise EventSource will auto-reconnect
        };
        
        eventSource.onmessage = (evt) => {
          const eventData = evt.data;
          
          if (eventData === '[DONE]') {
            finish();
            return;
          }
          
          try {
            const event = JSON.parse(eventData);
            
            // Handle init event (may contain existing content for reconnections)
            if (event.type === 'init' && event.existingContent) {
              accumulated = event.existingContent;
              updateStreamingLine(accumulated);
              return;
            }
            
            // Handle content chunks
            if (event.type === 'chunk' && event.content && !event.thinking) {
              accumulated += event.content;
              updateStreamingLine(accumulated);
              return;
            }
            
            // Handle status updates - show in the streaming line if no content yet
            if (event.type === 'status' || event.type === 'tool_status') {
              if (!accumulated) {
                const desc = event.description || event.action || 'Processing...';
                updateStreamingLine(`[${desc}]`);
              }
              return;
            }
            
            // Handle tool events
            if (event.type === 'tool_start' || (event.type === 'tool_event' && event.event?.type === 'tool_start')) {
              const toolName = event.toolName || event.event?.toolName || 'tool';
              if (!accumulated) {
                updateStreamingLine(`[Running ${toolName}...]`);
              }
              return;
            }
            
            // Handle completion
            if (event.type === 'run_complete' || event.type === 'complete') {
              finish();
              return;
            }
            
            // Handle errors
            if (event.type === 'run_error' || event.type === 'error') {
              const errMsg = event.error || 'Run failed';
              removeStreamingLine();
              addLine({ type: 'error', content: errMsg });
              finish();
              return;
            }
          } catch {
            // Ignore parse errors (comments, keepalives)
          }
        };
      });

      // Finalize the streaming line
      if (accumulated) {
        // If streaming line still shows a status placeholder, replace with final content
        finalizeStreamingLine();
      } else {
        // No content received — check if directResponse was used
        // Fetch the run result to get the response
        try {
          const runRes = await fetch(`/api/v1/runs/${runId}`, {
            credentials: 'include',
          });
          if (runRes.ok) {
            const runData = await runRes.json();
            const content = runData.output?.content || runData.output?.data?.response || runData.output?.data?.directResponse;
            if (content) {
              updateStreamingLine(content);
              finalizeStreamingLine();
            } else {
              removeStreamingLine();
              addLine({ type: 'output', content: '(No response)' });
            }
          } else {
            removeStreamingLine();
          }
        } catch {
          removeStreamingLine();
        }
      }
    } catch (err: any) {
      removeStreamingLine();
      if (err.name === 'AbortError') {
        addLine({ type: 'system', content: 'Cancelled' });
      } else {
        addLine({ type: 'error', content: `Error: ${err.message || 'Unknown error'}` });
      }
    } finally {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      abortControllerRef.current = null;
    }
  };

  // Process command or message
  const processInput = async (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (trimmedCmd === '') return;

    // Add input line
    addLine({ type: 'input', content: cmd });

    setIsProcessing(true);

    try {
      // Check if it's a builtin command
      const wasBuiltin = await handleBuiltinCommand(trimmedCmd);
      
      if (!wasBuiltin) {
        // Send to graph
        await executeViaGraph(trimmedCmd);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (isProcessing || !input.trim()) return;
    
    setCommandHistory(prev => [...prev, input]);
    setHistoryIndex(-1);
    processInput(input);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      processInput('clear');
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input':
        return 'text-green-400';
      case 'output':
        return 'text-text-secondary';
      case 'error':
        return 'text-red-400';
      case 'system':
        return 'text-yellow-400';
      case 'streaming':
        return 'text-text-secondary';
      default:
        return 'text-text-secondary';
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    if (isInitialized) {
      inputRef.current?.focus();
    }
  }, [isInitialized]);

  const selectedGraph = graphs.find(g => g.graphId === selectedGraphId);

  return (
    <div 
      className="h-full flex flex-col bg-bg-primary rounded-lg border border-border overflow-hidden font-mono text-sm"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-bg-secondary border-b border-border">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-text-muted text-xs ml-2">redbtn ~ terminal</span>
        
        {/* Graph Selector */}
        <div className="ml-auto relative" ref={graphSelectorRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowGraphSelector(!showGraphSelector);
            }}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-secondary hover:text-text-primary bg-bg-tertiary hover:bg-bg-secondary rounded transition-colors"
          >
            <Settings className="w-3 h-3" />
            <span className="truncate max-w-[120px]">{selectedGraph?.name || selectedGraphId}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          
          {showGraphSelector && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-secondary border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
              {graphs.length === 0 ? (
                <div className="px-3 py-2 text-xs text-text-muted">No graphs available</div>
              ) : (
                graphs.map(graph => (
                  <button
                    key={graph.graphId}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedGraphId(graph.graphId);
                      setShowGraphSelector(false);
                      addLine({ type: 'system', content: `Switched to graph: ${graph.name}` });
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-bg-tertiary transition-colors ${
                      graph.graphId === selectedGraphId ? 'bg-accent/10 text-accent-text' : 'text-text-secondary'
                    }`}
                  >
                    <div className="font-medium">{graph.name}</div>
                    <div className="text-text-muted text-[10px]">
                      {graph.isSystem ? 'System' : 'Custom'}
                      {graph.isDefault && ' • Default'}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        
        {isProcessing && (
          <span className="text-xs text-accent animate-pulse">processing...</span>
        )}
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
        {!isInitialized ? (
          <div className="text-text-muted">Loading...</div>
        ) : (
          <AnimatePresence mode="popLayout">
            {lines.map((line) => (
              <motion.div
                key={line.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className={`${getLineColor(line.type)} whitespace-pre-wrap break-all`}
              >
                {line.type === 'input' ? (
                  <span>
                    <span className="text-accent-text">❯</span>{' '}
                    {line.content}
                  </span>
                ) : line.type === 'streaming' ? (
                  <span>
                    {line.content ? (
                      <>
                        {line.content}
                        <span className="animate-pulse">▊</span>
                      </>
                    ) : (
                      <span className="text-text-muted animate-pulse">● thinking...</span>
                    )}
                  </span>
                ) : (
                  line.content
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {/* Input Line */}
        <div className="flex items-center gap-2">
          <span className="text-accent-text">❯</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-green-400 outline-none caret-green-400"
            spellCheck={false}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            disabled={isProcessing || !isInitialized}
            placeholder={isProcessing ? 'Processing...' : ''}
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-1.5 bg-bg-secondary border-t border-border flex items-center justify-between text-xs text-text-muted">
        <span>{conversationId ? conversationId.slice(0, 20) + '...' : 'No session'}</span>
        <div className="flex items-center gap-3">
          <span>{commandHistory.length} commands</span>
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-accent">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              running
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
