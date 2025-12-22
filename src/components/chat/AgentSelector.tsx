'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [mounted, setMounted] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  
  const selectedAgent = agents.find(a => a.graphId === selectedGraphId);
  
  // Client-side only mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Update dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 200;
      // On mobile, align right edge to button's right edge; on desktop, align left
      const isMobile = window.innerWidth < 640;
      const left = isMobile 
        ? Math.max(8, rect.right - dropdownWidth) // Align right edge, but keep 8px from left edge
        : Math.min(rect.left, window.innerWidth - dropdownWidth - 8);
      
      setDropdownPosition({
        top: rect.bottom + 8,
        left,
      });
    }
  }, [isOpen]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
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
    <>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-sm
          border border-[#2a2a2a] bg-[#1a1a1a] 
          hover:bg-[#252525] hover:border-[#3a3a3a]
          transition-colors
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <span className="text-gray-300 hidden sm:inline max-w-[120px] truncate">
          {loading ? 'Loading...' : selectedAgent?.name || 'Select Agent'}
        </span>
        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 z-[9998]" 
                onClick={() => setIsOpen(false)} 
              />
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -5, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -5, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                className="fixed z-[9999] min-w-[180px] max-w-[240px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
              >
                <div className="max-h-[200px] overflow-y-auto py-1">
                  {agents.map((agent) => (
                    <button
                      key={agent.graphId}
                      onClick={() => {
                        onSelectGraph(agent.graphId);
                        setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2 text-left
                        hover:bg-[#252525] transition-colors
                        ${agent.graphId === selectedGraphId ? 'bg-[#252525]' : ''}
                      `}
                    >
                      <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <span className="text-sm text-white truncate flex-1">{agent.name}</span>
                      {agent.isDefault && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] flex-shrink-0">
                          Default
                        </span>
                      )}
                      {agent.graphId === selectedGraphId && (
                        <Check className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

