'use client';

import { ReactNode } from 'react';
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
  Home
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  match?: string; // Path prefix to match for active state
}

const mainNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, match: '/' },
  { href: '/chat', label: 'Chat', icon: MessageSquare, match: '/chat' },
  { href: '/studio', label: 'Studio', icon: Workflow, match: '/studio' },
  { href: '/automations', label: 'Automations', icon: Zap, match: '/automations' },
  { href: '/knowledge', label: 'Knowledge', icon: Library, match: '/knowledge' },
  { href: '/logs', label: 'Terminal', icon: Terminal, match: '/logs' },
];

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
            <div className="flex flex-wrap gap-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-[#ef4444]/10 text-[#ef4444]'
                        : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
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
