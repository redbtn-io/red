'use client';

import { ReactNode, useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Workflow, 
  Compass, 
  Terminal,
  Library,
  Zap,
  X,
  Home,
  GripVertical
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  match?: string; // Path prefix to match for active state
}

const defaultNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, match: '/' },
  { href: '/chat', label: 'Chat', icon: MessageSquare, match: '/chat' },
  { href: '/studio', label: 'Studio', icon: Workflow, match: '/studio' },
  { href: '/automations', label: 'Automations', icon: Zap, match: '/automations' },
  { href: '/knowledge', label: 'Knowledge', icon: Library, match: '/knowledge' },
  { href: '/logs', label: 'Terminal', icon: Terminal, match: '/logs' },
];

// Simple nav item for normal (non-drag) mode
function NavItemLink({ 
  item, 
  isActive, 
  onLongPressStart
}: { 
  item: NavItem; 
  isActive: boolean;
  onLongPressStart: (itemHref: string, e: PointerEvent) => void;
}) {
  const Icon = item.icon;
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const lastPointerEvent = useRef<PointerEvent | null>(null);
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsLongPressing(true);
    // Store the native event for later
    lastPointerEvent.current = e.nativeEvent;
    
    // Track pointer movement to keep event fresh
    const trackMove = (moveEvent: PointerEvent) => {
      lastPointerEvent.current = moveEvent;
    };
    document.addEventListener('pointermove', trackMove);
    
    longPressTimer.current = setTimeout(() => {
      document.removeEventListener('pointermove', trackMove);
      if (lastPointerEvent.current) {
        onLongPressStart(item.href, lastPointerEvent.current);
      }
    }, 500);
  }, [onLongPressStart, item.href]);
  
  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsLongPressing(false);
    lastPointerEvent.current = null;
  }, []);

  return (
    <Link
      href={item.href}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      draggable={false}
      className={`
        flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors
        select-none touch-none
        [-webkit-touch-callout:none] [-webkit-user-select:none]
        ${isActive
          ? 'bg-[#ef4444]/10 text-[#ef4444]'
          : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
        }
        ${isLongPressing ? 'ring-2 ring-[#ef4444]/50' : ''}
      `}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{item.label}</span>
    </Link>
  );
}

// Floating drag preview that follows cursor/finger
function DragPreview({ item, position }: { item: NavItem; position: { x: number; y: number } }) {
  const Icon = item.icon;
  return (
    <div
      className="fixed pointer-events-none z-[9999] px-3 py-2 rounded-lg text-sm font-medium
        bg-[#1a1a1a] text-white border border-[#ef4444]/50 shadow-xl flex items-center gap-2"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <GripVertical className="w-3.5 h-3.5 text-[#ef4444]" />
      <Icon className="w-4 h-4" />
      <span>{item.label}</span>
    </div>
  );
}

// Reorderable nav item for drag mode (vertical list) - touch-friendly
function ReorderableNavItem({ 
  item, 
  index,
  isActive,
  isDragging,
  onPointerDown,
  itemRef
}: { 
  item: NavItem; 
  index: number;
  isActive: boolean;
  isDragging: boolean;
  onPointerDown: (index: number, e: React.PointerEvent) => void;
  itemRef: (el: HTMLDivElement | null) => void;
}) {
  const Icon = item.icon;

  return (
    <div
      ref={itemRef}
      onPointerDown={(e) => onPointerDown(index, e)}
      className={`
        cursor-grab active:cursor-grabbing touch-none select-none
        ${isDragging ? 'opacity-30' : ''}
      `}
    >
      <div
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
          select-none w-full
          ${isActive
            ? 'bg-[#ef4444]/10 text-[#ef4444]'
            : 'text-gray-400 hover:bg-[#1a1a1a]'
          }
        `}
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-600" />
        <Icon className="w-4 h-4" />
        <span>{item.label}</span>
      </div>
    </div>
  );
}

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  children?: ReactNode;
  /** Optional header content (e.g., "New Chat" button) */
  headerAction?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
}

/**
 * Unified sidebar component for all pages
 * Provides consistent navigation with page-specific content
 */
export function AppSidebar({ 
  isOpen, 
  onClose, 
  children,
  headerAction,
  footer
}: AppSidebarProps) {
  const pathname = usePathname();
  const [navItems, setNavItems] = useState<NavItem[]>(defaultNavItems);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [initialItemHref, setInitialItemHref] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load nav order from API on mount
  useEffect(() => {
    async function loadNavOrder() {
      try {
        const res = await fetch('/api/v1/user/preferences/ui');
        if (res.ok) {
          const data = await res.json();
          if (data.navOrder && Array.isArray(data.navOrder)) {
            // Reorder items based on saved order
            const orderedItems = data.navOrder
              .map((href: string) => defaultNavItems.find(item => item.href === href))
              .filter(Boolean) as NavItem[];
            
            // Add any new items not in saved order
            const missingItems = defaultNavItems.filter(
              item => !data.navOrder.includes(item.href)
            );
            
            setNavItems([...orderedItems, ...missingItems]);
          }
        }
      } catch (err) {
        console.error('Failed to load nav order:', err);
      } finally {
        setHasLoaded(true);
      }
    }
    loadNavOrder();
  }, []);

  // Save nav order to API (debounced)
  const saveNavOrder = useCallback((items: NavItem[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/v1/user/preferences/ui', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ navOrder: items.map(item => item.href) })
        });
      } catch (err) {
        console.error('Failed to save nav order:', err);
      }
    }, 500);
  }, []);

  // Pointer-based drag state for reorder mode
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  // Shared drag move/up handlers
  const setupDragListeners = useCallback((initialIndex: number, initialX: number, initialY: number) => {
    dragIndexRef.current = initialIndex;
    setDraggingIndex(initialIndex);
    setDragPosition({ x: initialX, y: initialY });
    
    const handleMove = (moveEvent: PointerEvent) => {
      setDragPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
      
      const currentIndex = dragIndexRef.current;
      if (currentIndex === null) return;
      
      // Find which item we're over
      let targetIndex: number | null = null;
      itemRefs.current.forEach((ref, idx) => {
        if (!ref || idx === currentIndex) return;
        const rect = ref.getBoundingClientRect();
        if (
          moveEvent.clientY >= rect.top &&
          moveEvent.clientY <= rect.bottom
        ) {
          targetIndex = idx;
        }
      });
      
      if (targetIndex !== null && targetIndex !== currentIndex) {
        setNavItems(prev => {
          const newItems = [...prev];
          const [removed] = newItems.splice(currentIndex, 1);
          newItems.splice(targetIndex!, 0, removed);
          return newItems;
        });
        dragIndexRef.current = targetIndex;
        setDraggingIndex(targetIndex);
      }
    };
    
    const handleUp = () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
      setDraggingIndex(null);
      setDragPosition(null);
      dragIndexRef.current = null;
    };
    
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  }, []);

  // Enter reorder mode (triggered by long press) and auto-start drag
  const enterReorderMode = useCallback((itemHref: string, e: PointerEvent) => {
    setInitialItemHref(itemHref);
    setIsReorderMode(true);
    
    // Find the index of the item that was long-pressed
    const index = navItems.findIndex(item => item.href === itemHref);
    if (index !== -1) {
      // Auto-start dragging this item, continuing from the long-press pointer position
      // Small delay to let the reorder mode render first
      setTimeout(() => {
        setupDragListeners(index, e.clientX, e.clientY);
      }, 0);
    }
  }, [navItems, setupDragListeners]);

  // Exit reorder mode and save
  const exitReorderMode = useCallback(() => {
    setIsReorderMode(false);
    setInitialItemHref(null);
    setDraggingIndex(null);
    setDragPosition(null);
    dragIndexRef.current = null;
    saveNavOrder(navItems);
  }, [navItems, saveNavOrder]);

  // Pointer-based drag handlers for touch support (when clicking in reorder mode)
  const handleItemPointerDown = useCallback((index: number, e: React.PointerEvent) => {
    e.preventDefault();
    setupDragListeners(index, e.clientX, e.clientY);
  }, [setupDragListeners]);

  // Determine which nav item is active
  const isActive = (item: NavItem) => {
    if (item.match === '/') {
      // Special case: root path should only match exactly
      return pathname === '/';
    }
    return pathname.startsWith(item.match!);
  };

  return (
    <>
      {/* Sidebar */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 lg:w-80 bg-[#0f0f0f] border-r border-[#2a2a2a] text-white 
          transform transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo Header */}
          <div className="p-4 border-b border-[#2a2a2a]">
            <div className="flex items-center justify-between mb-4">
              <Link href="/" className="flex items-center gap-2 no-underline hover:opacity-90">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/logo.png" 
                    alt="Red" 
                    width={32} 
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-lg font-semibold">redbtn</span>
              </Link>
              <button 
                onClick={onClose}
                className="lg:hidden p-1.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Optional header action (e.g., New Chat button) */}
            {headerAction}
          </div>

          {/* Main Navigation */}
          <div className="px-3 py-2 border-b border-[#2a2a2a]">
            {isReorderMode ? (
              // Vertical reorder mode - pointer-based for touch support
              <>
                <div className="flex flex-col gap-1">
                  {navItems.map((item, index) => (
                    <ReorderableNavItem
                      key={item.href}
                      item={item}
                      index={index}
                      isActive={isActive(item)}
                      isDragging={draggingIndex === index}
                      onPointerDown={handleItemPointerDown}
                      itemRef={(el) => { itemRefs.current[index] = el; }}
                    />
                  ))}
                </div>
                <button
                  onClick={exitReorderMode}
                  className="w-full mt-2 py-1.5 text-xs text-[#ef4444] bg-[#ef4444]/10 rounded-lg hover:bg-[#ef4444]/20 transition-colors"
                >
                  Done
                </button>
                {/* Floating drag preview */}
                {draggingIndex !== null && dragPosition && (
                  <DragPreview 
                    item={navItems[draggingIndex]} 
                    position={dragPosition} 
                  />
                )}
              </>
            ) : (
              // Normal horizontal flex-wrap mode
              <div className="flex flex-wrap gap-1">
                {navItems.map((item) => (
                  <NavItemLink
                    key={item.href}
                    item={item}
                    isActive={isActive(item)}
                    onLongPressStart={enterReorderMode}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Page-specific content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {children}
          </div>

          {/* Footer */}
          {footer ? (
            <div className="p-4 border-t border-[#2a2a2a]">
              {footer}
            </div>
          ) : (
            <div className="p-4 border-t border-[#2a2a2a]">
              <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Red Connected</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
