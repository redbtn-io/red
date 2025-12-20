'use client';

import { Menu, Plus, User as UserIcon, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import Link from 'next/link';

interface StudioHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  /** Optional action button - defaults to "New Graph" */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function StudioHeader({ title, subtitle, onMenuClick, action }: StudioHeaderProps) {
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
      className="sticky top-0 z-40 bg-[#0f0f0f] border-b border-[#2a2a2a] px-4 py-3 flex items-center gap-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300"
      >
        <Menu size={24} />
      </button>
      
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-gray-100 truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate">{subtitle}</p>
        )}
      </div>

      {/* Action Button */}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="flex items-center gap-2 px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg transition-colors font-medium text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{action.label}</span>
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white rounded-lg transition-colors font-medium text-sm"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        )
      )}

      {/* User Menu */}
      {user && (
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300"
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
                  className="absolute right-0 mt-2 w-56 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl z-50 overflow-hidden"
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className="px-4 py-3 border-b border-[#2a2a2a]">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-white">{user.name || 'User'}</p>
                      {isAdmin && (
                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-400 font-semibold">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-300 hover:bg-[#2a2a2a] transition-colors"
                  >
                    <LogOut size={16} />
                    Sign out
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
