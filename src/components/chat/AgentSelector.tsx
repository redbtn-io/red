'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, Check } from 'lucide-react';

interface AgentGraph {
  graphId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isDefault: boolean;
}

interface AgentSelectorProps {
  agents: AgentGraph[];
  selectedGraphId: string | null;
  onSelectGraph: (graphId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AgentSelector({ 
  agents, 
  selectedGraphId, 
  onSelectGraph, 
  disabled = false,
  loading = false 
}: AgentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedAgent = agents.find(a => a.graphId === selectedGraphId);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  if (agents.length === 0) {
    return null;
  }
  
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          border border-[#2a2a2a] bg-[#1a1a1a] 
          hover:bg-[#252525] hover:border-[#3a3a3a]
          transition-colors
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Bot className="w-4 h-4 text-purple-500" />
        <span className="text-gray-300 max-w-[120px] truncate">
          {loading ? 'Loading...' : selectedAgent?.name || 'Select Agent'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 z-50 min-w-[200px] max-w-[280px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
          >
            <div className="max-h-[300px] overflow-y-auto py-1">
              {agents.map((agent) => (
                <button
                  key={agent.graphId}
                  onClick={() => {
                    onSelectGraph(agent.graphId);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-start gap-3 px-3 py-2 text-left
                    hover:bg-[#252525] transition-colors
                    ${agent.graphId === selectedGraphId ? 'bg-[#252525]' : ''}
                  `}
                >
                  <Bot className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white truncate">{agent.name}</span>
                      {agent.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] flex-shrink-0">
                          Default
                        </span>
                      )}
                    </div>
                    {agent.description && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{agent.description}</p>
                    )}
                    {agent.isSystem && (
                      <span className="text-[10px] text-gray-600">System</span>
                    )}
                  </div>
                  {agent.graphId === selectedGraphId && (
                    <Check className="w-4 h-4 text-[#ef4444] flex-shrink-0 mt-0.5" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
