'use client';

import { Menu, Plus, LogOut, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNewChat: () => void;
  onTitleClick?: () => void;
}

export function Header({ title, onMenuClick, onNewChat, onTitleClick }: HeaderProps) {
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
      <h1 
        onClick={onTitleClick}
        className={`text-lg font-semibold text-gray-100 ${onTitleClick ? 'cursor-pointer hover:text-white transition-colors' : ''}`}
        title={onTitleClick ? 'Scroll to top' : undefined}
      >
        {title}
      </h1>
      <button
        onClick={onNewChat}
        className="ml-auto p-2 hover:bg-[#1a1a1a] rounded-lg transition-colors text-gray-300"
        title="New Chat"
      >
        <Plus size={20} />
      </button>

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
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] transition-colors text-gray-300 text-sm"
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
