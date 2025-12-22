'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  timestamp: Date;
}

// Mock responses for the terminal
const mockResponses: Record<string, string | string[]> = {
  'help': [
    'Available commands:',
    '  help     - Show this help message',
    '  status   - Show system status',
    '  graphs   - List available graphs',
    '  neurons  - List available neurons',
    '  clear    - Clear terminal',
    '  version  - Show version info',
    '  whoami   - Show current user',
    '  ping     - Test connection',
    '',
    'Coming soon: Direct graph execution from terminal',
  ],
  'status': [
    '┌─────────────────────────────────────┐',
    '│  redbtn System Status               │',
    '├─────────────────────────────────────┤',
    '│  API:      ● Online                 │',
    '│  Database: ● Connected              │',
    '│  Redis:    ● Connected              │',
    '│  Graphs:   2 loaded                 │',
    '│  Neurons:  4 available              │',
    '└─────────────────────────────────────┘',
  ],
  'graphs': [
    'Available Graphs:',
    '  • red-assistant (system, default)',
    '  • red-chat (system)',
    '',
    'Use "graphs --verbose" for more details',
  ],
  'neurons': [
    'Available Neurons:',
    '  • red-neuron (deepseek-reasoner)',
    '  • deepseek-r1 (deepseek-reasoner)',
    '  • gpt-4o (openai)',
    '  • claude-sonnet (anthropic)',
  ],
  'version': 'redbtn v0.1.0 (dynamic)',
  'whoami': 'Authenticated user session',
  'ping': 'pong! (latency: 12ms)',
  'clear': '__CLEAR__',
};

export function MockTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'welcome',
      type: 'system',
      content: 'Welcome to redbtn Terminal v0.1.0',
      timestamp: new Date(),
    },
    {
      id: 'hint',
      type: 'system',
      content: 'Type "help" for available commands',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const processCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase();
    const newLines: TerminalLine[] = [];

    // Add input line
    newLines.push({
      id: `input-${Date.now()}`,
      type: 'input',
      content: cmd,
      timestamp: new Date(),
    });

    if (trimmedCmd === '') {
      // Empty command, just show prompt
    } else if (trimmedCmd === 'clear') {
      setLines([
        {
          id: 'cleared',
          type: 'system',
          content: 'Terminal cleared',
          timestamp: new Date(),
        },
      ]);
      return;
    } else if (mockResponses[trimmedCmd]) {
      const response = mockResponses[trimmedCmd];
      if (Array.isArray(response)) {
        response.forEach((line, i) => {
          newLines.push({
            id: `output-${Date.now()}-${i}`,
            type: 'output',
            content: line,
            timestamp: new Date(),
          });
        });
      } else {
        newLines.push({
          id: `output-${Date.now()}`,
          type: 'output',
          content: response,
          timestamp: new Date(),
        });
      }
    } else {
      newLines.push({
        id: `error-${Date.now()}`,
        type: 'error',
        content: `Command not found: ${cmd}`,
        timestamp: new Date(),
      });
      newLines.push({
        id: `hint-${Date.now()}`,
        type: 'system',
        content: 'Type "help" for available commands',
        timestamp: new Date(),
      });
    }

    setLines(prev => [...prev, ...newLines]);
  };

  const handleSubmit = () => {
    if (input.trim()) {
      setCommandHistory(prev => [...prev, input]);
      setHistoryIndex(-1);
    }
    processCommand(input);
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
      setLines([
        {
          id: 'cleared',
          type: 'system',
          content: 'Terminal cleared',
          timestamp: new Date(),
        },
      ]);
    }
  };

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input':
        return 'text-green-400';
      case 'output':
        return 'text-gray-300';
      case 'error':
        return 'text-red-400';
      case 'system':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div 
      className="h-full flex flex-col bg-[#0a0a0a] rounded-lg border border-[#2a2a2a] overflow-hidden font-mono text-sm"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-gray-500 text-xs ml-2">redbtn ~ terminal</span>
      </div>

      {/* Terminal Content */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 space-y-1"
      >
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
                  <span className="text-[#ef4444]">❯</span>{' '}
                  {line.content}
                </span>
              ) : (
                line.content
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Input Line */}
        <div className="flex items-center gap-2">
          <span className="text-[#ef4444]">❯</span>
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
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-1.5 bg-[#1a1a1a] border-t border-[#2a2a2a] flex items-center justify-between text-xs text-gray-500">
        <span>redbtn terminal</span>
        <span>{commandHistory.length} commands</span>
      </div>
    </div>
  );
}
