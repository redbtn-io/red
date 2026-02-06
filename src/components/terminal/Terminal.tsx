'use client';

import { useState, useRef, useEffect, KeyboardEvent, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings, Plus, X } from 'lucide-react';

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

interface TabInfo {
  id: string;
  name: string;
  conversationId: string;
  selectedGraphId: string;
}

interface TabData {
  lines: TerminalLine[];
  commandHistory: string[];
  historyIndex: number;
}

// LocalStorage keys
const TERMINAL_TABS_KEY = 'redbtn_terminal_tabs';
const TERMINAL_ACTIVE_TAB_KEY = 'redbtn_terminal_active_tab';
const TERMINAL_CONVERSATION_KEY = 'redbtn_terminal_conversation_id'; // Legacy

function createTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

function createConversationId(): string {
  return `terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getWelcomeLines(): TerminalLine[] {
  return [
    { id: `welcome-${Date.now()}`, type: 'system', content: 'Welcome to redbtn Terminal v0.1.0', timestamp: new Date() },
    { id: `hint-${Date.now()}`, type: 'system', content: 'Type "help" for commands or just start chatting.', timestamp: new Date() },
  ];
}

function loadTabsFromStorage(defaultGraphId: string): { tabs: TabInfo[]; activeTabId: string } {
  if (typeof window === 'undefined') {
    const id = createTabId();
    return { tabs: [{ id, name: 'Terminal 1', conversationId: createConversationId(), selectedGraphId: defaultGraphId }], activeTabId: id };
  }
  try {
    const saved = localStorage.getItem(TERMINAL_TABS_KEY);
    const savedActive = localStorage.getItem(TERMINAL_ACTIVE_TAB_KEY);
    if (saved) {
      const tabs: TabInfo[] = JSON.parse(saved);
      if (tabs.length > 0) {
        const activeTabId = savedActive && tabs.some(t => t.id === savedActive) ? savedActive : tabs[0].id;
        return { tabs, activeTabId };
      }
    }
  } catch { /* corrupt storage */ }
  // Migrate from legacy single-conversation
  const legacyId = localStorage.getItem(TERMINAL_CONVERSATION_KEY);
  const tabId = createTabId();
  return { tabs: [{ id: tabId, name: 'Terminal 1', conversationId: legacyId || createConversationId(), selectedGraphId: defaultGraphId }], activeTabId: tabId };
}

export function Terminal({ initialGraphId = 'red-assistant' }: TerminalProps) {
  // Tab state
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const tabDataRef = useRef<Map<string, TabData>>(new Map());

  // Active session state
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
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const graphSelectorRef = useRef<HTMLDivElement>(null);
  const tabNameInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileLoadedRef = useRef(false);

  // Mirror state in refs for tab-switching (avoids stale closures)
  const linesRef = useRef<TerminalLine[]>([]);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { historyRef.current = commandHistory; }, [commandHistory]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);

  // Debounced save to user profile API
  const saveTabsToProfile = useCallback((tabsToSave: TabInfo[], activeId: string) => {
    // Write-through to localStorage immediately
    localStorage.setItem(TERMINAL_TABS_KEY, JSON.stringify(tabsToSave));
    localStorage.setItem(TERMINAL_ACTIVE_TAB_KEY, activeId);
    // Debounce the API call (1s)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch('/api/v1/user/preferences/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ terminalTabs: tabsToSave, terminalActiveTab: activeId }),
      }).catch(() => { /* silent — localStorage is the fallback */ });
    }, 1000);
  }, []);

  // Persist tabs on change
  useEffect(() => {
    if (tabs.length > 0 && activeTabId && profileLoadedRef.current) {
      saveTabsToProfile(tabs, activeTabId);
    }
  }, [tabs, activeTabId, saveTabsToProfile]);

  // Cleanup debounce timer
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // Initialize terminal — load from profile API, fall back to localStorage
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      let loaded: { tabs: TabInfo[]; activeTabId: string } | null = null;
      // Try loading from user profile first
      try {
        const res = await fetch('/api/v1/user/preferences/ui', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data.terminalTabs && Array.isArray(data.terminalTabs) && data.terminalTabs.length > 0) {
            const activeId = data.terminalActiveTab && data.terminalTabs.some((t: TabInfo) => t.id === data.terminalActiveTab)
              ? data.terminalActiveTab
              : data.terminalTabs[0].id;
            loaded = { tabs: data.terminalTabs, activeTabId: activeId };
          }
        }
      } catch { /* fall through to localStorage */ }
      // Fall back to localStorage
      if (!loaded) {
        loaded = loadTabsFromStorage(initialGraphId);
      }
      if (cancelled) return;
      profileLoadedRef.current = true;
      setTabs(loaded.tabs);
      setActiveTabId(loaded.activeTabId);
      const activeTab = loaded.tabs.find(t => t.id === loaded!.activeTabId) || loaded.tabs[0];
      setConversationId(activeTab.conversationId);
      setSelectedGraphId(activeTab.selectedGraphId);
      fetchGraphs();
      loadConversationHistory(activeTab.conversationId);
    };
    init();
    return () => { cancelled = true; };
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

  // Focus tab name input when editing
  useEffect(() => {
    if (editingTabId && tabNameInputRef.current) {
      tabNameInputRef.current.focus();
      tabNameInputRef.current.select();
    }
  }, [editingTabId]);

  // Sync active tab's graphId to tab state
  useEffect(() => {
    if (activeTabId && tabs.length > 0) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, selectedGraphId } : t));
    }
  }, [selectedGraphId]);

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

  // --- Tab Management ---

  const saveCurrentTabData = useCallback(() => {
    if (activeTabId) {
      tabDataRef.current.set(activeTabId, {
        lines: linesRef.current,
        commandHistory: historyRef.current,
        historyIndex: historyIndexRef.current,
      });
    }
  }, [activeTabId]);

  const switchToTab = (tabId: string) => {
    if (tabId === activeTabId) return;
    // Abort any active streaming
    abortControllerRef.current?.abort();
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    setIsProcessing(false);
    // Save current tab data
    saveCurrentTabData();
    // Load new tab data
    const cached = tabDataRef.current.get(tabId);
    const tab = tabs.find(t => t.id === tabId);
    if (cached) {
      setLines(cached.lines);
      setCommandHistory(cached.commandHistory);
      setHistoryIndex(cached.historyIndex);
      setIsInitialized(true);
    } else if (tab) {
      setLines([]);
      setIsInitialized(false);
      loadConversationHistory(tab.conversationId);
      setCommandHistory([]);
      setHistoryIndex(-1);
    }
    if (tab) {
      setConversationId(tab.conversationId);
      setSelectedGraphId(tab.selectedGraphId);
      expectedConvIdRef.current = tab.conversationId;
    }
    setActiveTabId(tabId);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const addTab = () => {
    if (tabs.length >= 8) return;
    saveCurrentTabData();
    const tabId = createTabId();
    const convId = createConversationId();
    // Mark the new conversation as expected so any in-flight fetch for the old tab is discarded
    expectedConvIdRef.current = convId;
    const newTab: TabInfo = { id: tabId, name: `Terminal ${tabs.length + 1}`, conversationId: convId, selectedGraphId: initialGraphId };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    setConversationId(convId);
    setSelectedGraphId(initialGraphId);
    setLines(getWelcomeLines());
    setCommandHistory([]);
    setHistoryIndex(-1);
    setInput('');
    setIsInitialized(true);
    tabDataRef.current.set(tabId, { lines: getWelcomeLines(), commandHistory: [], historyIndex: -1 });
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const closeTab = (tabId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    tabDataRef.current.delete(tabId);
    // If closing a tab that's streaming, abort it
    if (tabId === activeTabId) {
      abortControllerRef.current?.abort();
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
      setIsProcessing(false);
    }
    setTabs(newTabs);
    if (tabId === activeTabId) {
      const newIdx = Math.min(idx, newTabs.length - 1);
      const newTab = newTabs[newIdx];
      const cached = tabDataRef.current.get(newTab.id);
      if (cached) {
        setLines(cached.lines);
        setCommandHistory(cached.commandHistory);
        setHistoryIndex(cached.historyIndex);
        setIsInitialized(true);
      } else {
        setLines([]);
        setIsInitialized(false);
        loadConversationHistory(newTab.conversationId);
      }
      setActiveTabId(newTab.id);
      setConversationId(newTab.conversationId);
      setSelectedGraphId(newTab.selectedGraphId);
      setInput('');
    }
  };

  const startRenamingTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = tabs.find(t => t.id === tabId);
    if (tab) { setEditingTabId(tabId); setEditingTabName(tab.name); }
  };

  const finishRenamingTab = () => {
    if (editingTabId && editingTabName.trim()) {
      setTabs(prev => prev.map(t => t.id === editingTabId ? { ...t, name: editingTabName.trim() } : t));
    }
    setEditingTabId(null);
    setEditingTabName('');
    inputRef.current?.focus();
  };

  // Track which conversation is currently expected, to guard against stale async loads
  const expectedConvIdRef = useRef<string>('');

  const loadConversationHistory = async (convId: string) => {
    expectedConvIdRef.current = convId;
    try {
      const res = await fetch(`/api/v1/conversations/${convId}/messages`, { credentials: 'include' });
      // Guard: if tab switched while we were fetching, discard results
      if (expectedConvIdRef.current !== convId) return;
      if (res.ok) {
        const data = await res.json();
        if (expectedConvIdRef.current !== convId) return;
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
          setLines(getWelcomeLines());
        }
      } else {
        setLines(getWelcomeLines());
      }
    } catch (err) {
      setLines(getWelcomeLines());
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
        addLine({ type: 'output', content: 'Shortcuts:' });
        addLine({ type: 'output', content: '  Ctrl+T   - New tab' });
        addLine({ type: 'output', content: '  Ctrl+W   - Close tab' });
        addLine({ type: 'output', content: '  Ctrl+L   - Clear screen' });
        addLine({ type: 'output', content: '  Ctrl+C   - Cancel request' });
        addLine({ type: 'output', content: '  ↑/↓      - Command history' });
        addLine({ type: 'output', content: '' });
        addLine({ type: 'output', content: 'Double-click a tab to rename it.' });
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
    const newId = createConversationId();
    setConversationId(newId);
    // Update the active tab's conversationId
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, conversationId: newId } : t));

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
    } else if (e.key === 't' && e.ctrlKey) {
      e.preventDefault();
      addTab();
    } else if (e.key === 'w' && e.ctrlKey) {
      e.preventDefault();
      closeTab(activeTabId);
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
      {/* Tab Bar */}
      <div className="flex items-center bg-bg-secondary border-b border-border min-h-[36px]">
        <div className="flex items-center overflow-x-auto flex-1 min-w-0 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => switchToTab(tab.id)}
              className={`group flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border/50 whitespace-nowrap transition-colors relative ${
                tab.id === activeTabId
                  ? 'bg-bg-primary text-text-primary'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary'
              }`}
            >
              {tab.id === activeTabId && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent" />
              )}
              {editingTabId === tab.id ? (
                <input
                  ref={tabNameInputRef}
                  value={editingTabName}
                  onChange={(e) => setEditingTabName(e.target.value)}
                  onBlur={finishRenamingTab}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') finishRenamingTab();
                    if (e.key === 'Escape') { setEditingTabId(null); setEditingTabName(''); }
                  }}
                  className="bg-transparent outline-none text-xs w-20 text-text-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => startRenamingTab(tab.id, e)}
                  className="select-none"
                >
                  {tab.name}
                </span>
              )}
              {tabs.length > 1 && (
                <span
                  onClick={(e) => closeTab(tab.id, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity ml-1 p-0.5 rounded hover:bg-bg-tertiary"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
          {tabs.length < 8 && (
            <button
              onClick={(e) => { e.stopPropagation(); addTab(); }}
              className="flex items-center justify-center px-2.5 py-2 text-text-muted hover:text-text-secondary hover:bg-bg-tertiary transition-colors"
              title="New tab (Ctrl+T)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 px-2 shrink-0 border-l border-border/50">
          {isProcessing && (
            <span className="text-xs text-accent animate-pulse">processing...</span>
          )}
          <div className="relative" ref={graphSelectorRef}>
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
        </div>
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
        <div className="flex items-center gap-3">
          {tabs.length > 1 && <span>{tabs.findIndex(t => t.id === activeTabId) + 1}/{tabs.length} tabs</span>}
          <span>{conversationId ? conversationId.slice(0, 16) + '…' : 'No session'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{commandHistory.length} cmds</span>
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
