'use client';

import Link from 'next/link';
import { Menu, Plus, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useState, ReactNode } from 'react';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNewChat: () => void;
  onTitleClick?: () => void;
  /** Optional element to render after the title (e.g., agent selector) */
  extra?: ReactNode;
}

export function Header({ title, onMenuClick, onNewChat, onTitleClick, extra }: HeaderProps) {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const isAdmin = user?.accountLevel === 0;

  const handleLogout = async () => {
    try {
      await logout();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <motion.div 
      className="pwa-header sticky top-0 z-40 bg-bg-elevated border-b border-border px-4 py-3 flex items-center gap-2 sm:gap-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary flex-shrink-0"
      >
        <Menu size={24} />
      </button>
      <h1 
        onClick={onTitleClick}
        className={`text-base sm:text-lg font-semibold text-text-primary truncate min-w-0 flex-shrink ${onTitleClick ? 'cursor-pointer hover:text-text-primary transition-colors' : ''}`}
        title={onTitleClick ? 'Scroll to top' : title}
      >
        {title}
      </h1>
      {extra && <div className="flex-shrink-0 ml-auto sm:ml-0">{extra}</div>}
      <button
        onClick={onNewChat}
        className={`${extra ? '' : 'ml-auto'} p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary flex-shrink-0`}
        title="New Chat"
      >
        <Plus size={20} />
      </button>

      {/* User Menu */}
      {user && (
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 hover:bg-bg-secondary rounded-lg transition-colors text-text-secondary"
            title="User Menu"
          >
            <UserIcon size={20} />
            <span className="hidden sm:inline text-sm">{user.name || user.email}</span>
          </button>

          <AnimatePresence>
            {showUserMenu && (
              <>
                {/* Backdrop */}
                <motion.div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />

                {/* Menu Dropdown */}
                <motion.div 
                  className="absolute right-0 mt-2 w-56 bg-bg-secondary border border-border rounded-lg shadow-xl z-50 overflow-hidden"
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="px-4 py-3 border-b border-border">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-text-primary">{user.name || 'User'}</p>
                      {isAdmin && (
                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400 font-semibold">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary truncate">{user.email}</p>
                  </div>

                  <Link
                    href="/settings"
                    onClick={() => setShowUserMenu(false)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-tertiary transition-colors text-text-secondary text-sm"
                  >
                    <Settings size={16} />
                    <span>Settings</span>
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-tertiary transition-colors text-text-secondary text-sm"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
