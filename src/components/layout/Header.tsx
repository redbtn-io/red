'use client';

import { Menu, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  title: string;
  onMenuClick: () => void;
  onNewChat: () => void;
  onTitleClick?: () => void;
  /** Optional element to render after the title (e.g., agent selector) */
  extra?: ReactNode;
}

export function Header({ title, onMenuClick, onNewChat, onTitleClick, extra }: HeaderProps) {
  return (
    <motion.div 
      className="pwa-header sticky top-0 z-40 bg-white/90 dark:bg-bg-elevated backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-2 sm:gap-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 hover:bg-bg-hover rounded-xl transition-colors text-text-secondary flex-shrink-0"
      >
        <Menu size={24} />
      </button>
      <h1 
        onClick={onTitleClick}
        className={`text-base sm:text-lg font-semibold text-text-primary truncate min-w-0 flex-shrink ${onTitleClick ? 'cursor-pointer hover:text-text-secondary transition-colors' : ''}`}
        title={onTitleClick ? 'Scroll to top' : title}
      >
        {title}
      </h1>
      
      {/* Extra content (e.g., agent selector) */}
      {extra && <div className="flex-shrink-0">{extra}</div>}
      
      {/* Spacer to push right-side items */}
      <div className="flex-1" />
      
      {/* New Chat button */}
      <button
        onClick={onNewChat}
        className="p-2 hover:bg-bg-hover rounded-xl transition-colors text-text-secondary flex-shrink-0"
        title="New Chat"
      >
        <Plus size={20} />
      </button>

      {/* User Menu - always on the right */}
      <UserMenu showName={true} />
    </motion.div>
  );
}
