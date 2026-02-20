'use client';

import Link from 'next/link';
import { LogOut, User as UserIcon, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface UserMenuProps {
  /** Whether to show the user's name next to the icon on larger screens */
  showName?: boolean;
}

export function UserMenu({ showName = true }: UserMenuProps) {
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

  if (!user) return null;

  return (
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setShowUserMenu(!showUserMenu)}
        className="flex items-center gap-2 p-2 hover:bg-bg-hover rounded-xl transition-colors text-text-secondary"
        title="User Menu"
      >
        <UserIcon size={20} />
        {showName && (
          <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
            {user.name || user.email}
          </span>
        )}
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
              className="absolute right-0 mt-2 w-56 bg-bg-secondary border border-border rounded-xl shadow-xl z-50 overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: -5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -5 }}
              transition={{ duration: 0.15 }}
            >
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-text-primary">{user.name || 'User'}</p>
                  {isAdmin && (
                    <span className="px-2 py-0.5 bg-red-500/15 border border-red-500/30 rounded-md text-xs text-red-400 font-semibold">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted truncate">{user.email}</p>
              </div>

              <Link
                href="/settings"
                onClick={() => setShowUserMenu(false)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-text-secondary text-sm font-medium"
              >
                <Settings size={16} />
                <span>Settings</span>
              </Link>

              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-hover transition-colors text-text-secondary text-sm font-medium"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
