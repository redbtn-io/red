'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, Check, Star } from 'lucide-react';

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
  onSetDefault?: (graphId: string) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function AgentSelector({ 
  agents, 
  selectedGraphId, 
  onSelectGraph,
  onSetDefault,
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
  
  // Show loading state or hide completely if no agents after loading
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm border border-border bg-bg-secondary opacity-50">
        <Bot className="w-4 h-4 text-purple-500 flex-shrink-0 animate-pulse" />
        <span className="text-text-muted hidden sm:inline text-xs">Loading...</span>
      </div>
    );
  }
  
  // No agents available - show disabled placeholder
  if (agents.length === 0) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm border border-border/50 bg-bg-secondary/50 opacity-60">
        <Bot className="w-4 h-4 text-text-muted flex-shrink-0" />
        <span className="text-text-muted hidden sm:inline text-xs">No agents</span>
      </div>
    );
  }
  
  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`
          flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl text-sm
          border border-border bg-bg-secondary 
          hover:bg-bg-hover hover:border-border-hover
          transition-all shadow-sm
          ${disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
        <span className="text-text-primary hidden sm:inline max-w-[120px] truncate font-medium">
          {loading ? 'Loading...' : selectedAgent?.name || 'Select Agent'}
        </span>
        <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 text-text-muted transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
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
                className="fixed z-[9999] min-w-[180px] max-w-[240px] bg-bg-secondary border border-border rounded-xl shadow-xl overflow-hidden"
              >
                <div className="max-h-[200px] overflow-y-auto py-1">
                  {agents.map((agent) => (
                    <div
                      key={agent.graphId}
                      className={`
                        w-full flex items-center gap-2 px-3 py-2
                        hover:bg-bg-hover transition-colors
                        ${agent.graphId === selectedGraphId ? 'bg-accent-muted' : ''}
                      `}
                    >
                      {/* Set as default button */}
                      {onSetDefault && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            if (!agent.isDefault) {
                              onSetDefault(agent.graphId);
                            }
                          }}
                          className={`
                            flex-shrink-0 p-0.5 rounded-lg transition-colors
                            ${agent.isDefault 
                              ? 'text-amber-500 cursor-default' 
                              : 'text-text-muted hover:text-amber-500'
                            }
                          `}
                          title={agent.isDefault ? 'Current default' : 'Set as default'}
                        >
                          <Star className={`w-3.5 h-3.5 ${agent.isDefault ? 'fill-amber-500' : ''}`} />
                        </button>
                      )}
                      
                      {/* Agent select button */}
                      <button
                        onClick={() => {
                          onSelectGraph(agent.graphId);
                          setIsOpen(false);
                        }}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        <Bot className="w-4 h-4 text-purple-500 flex-shrink-0" />
                        <span className="text-sm text-text-primary truncate flex-1 font-medium">{agent.name}</span>
                        {agent.graphId === selectedGraphId && (
                          <Check className="w-4 h-4 text-accent flex-shrink-0" />
                        )}
                      </button>
                    </div>
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

