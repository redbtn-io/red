'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Variable, Hash, Globe, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';

export interface VariableCategory {
  label: string;
  icon: React.ReactNode;
  variables: Array<{
    name: string;
    path: string;
    description?: string;
  }>;
}

interface SmartInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  /** If true, inserts the raw path (for output fields). If false, wraps in {{}} */
  isOutput?: boolean;
  rows?: number;
  className?: string;
  /** Graph-level variables from other nodes' output fields */
  graphVariables?: string[];
  /** Node parameters that can be referenced */
  nodeParameters?: string[];
  /** Whether this is a single-line input */
  singleLine?: boolean;
}

interface DropdownPosition {
  top: number;
  left: number;
  width: number;
  openAbove: boolean;
}

/**
 * SmartInput Component
 * 
 * A text input with intelligent autocomplete for template variables.
 * Uses a portal to render the dropdown outside container hierarchy,
 * preventing overflow clipping issues.
 */
export default function SmartInput({
  value,
  onChange,
  placeholder,
  isOutput = false,
  rows = 1,
  className = '',
  graphVariables = [],
  nodeParameters = [],
  singleLine = false,
}: SmartInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Client-side mount check for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check scroll position and update indicators
  const updateScrollIndicators = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    setCanScrollUp(scrollTop > 0);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 1);
  }, []);

  // Build categorized suggestions
  const categories = useMemo<VariableCategory[]>(() => {
    const cats: VariableCategory[] = [];

    // State variables (from graph outputs)
    if (graphVariables.length > 0) {
      cats.push({
        label: 'State Variables',
        icon: <Variable className="w-3 h-3 text-blue-400" />,
        variables: graphVariables.map(v => ({
          name: v.split('.').pop() || v,
          path: v.startsWith('state.') ? v : `state.${v}`,
          description: 'From graph node output',
        })),
      });
    }

    // Common state fields always available
    const commonStateVars = [
      { name: 'query.message', path: 'state.data.query.message', description: 'User input message' },
      { name: 'response', path: 'state.data.response', description: 'Generated response' },
      { name: 'contextMessages', path: 'state.data.contextMessages', description: 'Conversation history' },
    ];
    
    // Filter out any that already exist in graphVariables
    const filteredCommon = commonStateVars.filter(cv => 
      !graphVariables.some(gv => gv.includes(cv.name) || cv.path.includes(gv))
    );
    
    if (filteredCommon.length > 0) {
      const existingState = cats.find(c => c.label === 'State Variables');
      if (existingState) {
        existingState.variables.push(...filteredCommon);
      } else {
        cats.push({
          label: 'State Variables',
          icon: <Variable className="w-3 h-3 text-blue-400" />,
          variables: filteredCommon,
        });
      }
    }

    // Node parameters
    if (nodeParameters.length > 0) {
      cats.push({
        label: 'Parameters',
        icon: <Hash className="w-3 h-3 text-purple-400" />,
        variables: nodeParameters.map(p => ({
          name: p,
          path: `parameters.${p}`,
          description: 'Node parameter',
        })),
      });
    }

    // Global state hint
    cats.push({
      label: 'Global State',
      icon: <Globe className="w-3 h-3 text-green-400" />,
      variables: [
        { name: 'namespace.key', path: 'globalState.namespace.key', description: 'Persistent storage (use your own namespace)' },
      ],
    });

    return cats;
  }, [graphVariables, nodeParameters]);

  // Update scroll indicators when dropdown opens or content changes
  useEffect(() => {
    if (showSuggestions && scrollContainerRef.current) {
      // Small delay to ensure DOM has rendered
      setTimeout(updateScrollIndicators, 50);
    }
  }, [showSuggestions, categories, updateScrollIndicators]);

  // Calculate dropdown position based on input element
  const calculatePosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropdownHeight = 280; // Max height of dropdown
    const minWidth = 320; // Minimum dropdown width
    const padding = 24; // Padding from viewport edges
    
    // Calculate width - at least minWidth, but don't exceed viewport
    const desiredWidth = Math.max(rect.width, minWidth);
    const maxWidth = viewportWidth - (padding * 2);
    const finalWidth = Math.min(desiredWidth, maxWidth);
    
    // Calculate left position - ensure it stays within viewport
    let left = rect.left;
    
    // If dropdown would overflow right edge, shift it left
    if (left + finalWidth > viewportWidth - padding) {
      left = viewportWidth - finalWidth - padding;
    }
    
    // If dropdown would overflow left edge, shift it right
    if (left < padding) {
      left = padding;
    }
    
    // Open above if not enough space below and more space above
    const openAbove = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    
    setDropdownPos({
      top: openAbove ? rect.top - 4 : rect.bottom + 4,
      left,
      width: finalWidth,
      openAbove,
    });
  }, []);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as globalThis.Node;
      const isInsideContainer = containerRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);
      
      if (!isInsideContainer && !isInsideDropdown) {
        setShowSuggestions(false);
      }
    }
    
    function handleScroll() {
      if (showSuggestions) {
        calculatePosition();
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', calculatePosition);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', calculatePosition);
    };
  }, [showSuggestions, calculatePosition]);

  // Check for {{ trigger
  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    
    // Show suggestions if user types {{
    if (newValue.endsWith('{{')) {
      setShowSuggestions(true);
      calculatePosition();
    }
  };

  const handleFocus = () => {
    calculatePosition();
    setShowSuggestions(true);
  };

  const handleSelect = (variable: { name: string; path: string }) => {
    if (isOutput) {
      // For output fields, just use the raw path without state. prefix
      const outputPath = variable.path.replace(/^state\./, '');
      onChange(outputPath);
    } else {
      // For input fields, wrap in {{ }} template syntax
      const template = `{{${variable.path}}}`;
      
      // If input ends with {{, replace it
      if (value.endsWith('{{')) {
        onChange(value.slice(0, -2) + template);
      } else if (!value) {
        onChange(template);
      } else {
        // Append with space
        onChange(`${value} ${template}`);
      }
    }
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const hasVariables = categories.some(c => c.variables.length > 0);

  const inputBaseClass = `w-full bg-bg-secondary border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-cyan-500 resize-none ${className}`;

  // Render dropdown via portal
  const renderDropdown = () => {
    if (!showSuggestions || !hasVariables || !dropdownPos || !mounted) return null;
    
    const dropdown = (
      <div 
        ref={dropdownRef}
        className="fixed bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden"
        style={{ 
          top: dropdownPos.openAbove ? 'auto' : dropdownPos.top,
          bottom: dropdownPos.openAbove ? `calc(100vh - ${dropdownPos.top}px)` : 'auto',
          left: dropdownPos.left,
          width: dropdownPos.width,
          maxHeight: '280px',
          zIndex: 99999,
        }}
      >
        {/* Scroll up indicator */}
        {canScrollUp && (
          <div className="absolute top-0 left-0 right-0 h-8 pointer-events-none z-10 flex items-start justify-center pt-1" 
            style={{ background: 'linear-gradient(to bottom, var(--bg-secondary) 0%, transparent 100%)' }}>
            <ChevronUp className="w-4 h-4 text-text-muted animate-pulse" />
          </div>
        )}
        
        {/* Scrollable content - hidden scrollbar */}
        <div 
          ref={scrollContainerRef}
          className="smart-input-scroll overflow-y-auto"
          style={{ maxHeight: '280px' }}
          onScroll={updateScrollIndicators}
        >
          {/* Hide scrollbar for all browsers */}
          <style>{`
            .smart-input-scroll {
              scrollbar-width: none;
              -ms-overflow-style: none;
            }
            .smart-input-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {categories.map((category) => (
            category.variables.length > 0 && (
              <div key={category.label}>
                <div className="px-3 py-2 text-[10px] text-text-muted uppercase tracking-wider border-b border-border bg-bg-elevated flex items-center gap-1.5 sticky top-0 z-[1]">
                  {category.icon}
                  {category.label}
                </div>
                {category.variables.map((v) => (
                  <button
                    key={v.path}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      handleSelect(v);
                    }}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-bg-tertiary flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <ChevronRight className="w-2.5 h-2.5 text-text-disabled group-hover:text-text-muted flex-shrink-0" />
                      <code className="text-cyan-400 truncate">{isOutput ? v.path.replace(/^state\./, '') : `{{${v.path}}}`}</code>
                    </div>
                    {v.description && (
                      <span className="text-[10px] text-text-disabled truncate flex-shrink-0">
                        {v.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )
          ))}
          <div className="px-3 py-2 text-[10px] text-text-disabled border-t border-border bg-bg-primary">
            Type <code className="text-cyan-500">{'{{'}</code> to trigger suggestions
          </div>
        </div>
        
        {/* Scroll down indicator */}
        {canScrollDown && (
          <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none z-10 flex items-end justify-center pb-1" 
            style={{ background: 'linear-gradient(to top, var(--bg-secondary) 0%, transparent 100%)' }}>
            <ChevronDown className="w-4 h-4 text-text-muted animate-pulse" />
          </div>
        )}
      </div>
    );
    
    return createPortal(dropdown, document.body);
  };

  return (
    <div className="relative" ref={containerRef}>
      {singleLine ? (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          className={inputBaseClass}
          placeholder={placeholder}
        />
      ) : (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleFocus}
          rows={rows}
          className={inputBaseClass}
          placeholder={placeholder}
        />
      )}
      {renderDropdown()}
    </div>
  );
}
