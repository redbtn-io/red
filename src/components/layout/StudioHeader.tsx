'use client';

import { Menu, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { UserMenu } from './UserMenu';

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
  return (
    <motion.div 
      className="sticky top-0 z-40 bg-white/90 dark:bg-bg-elevated backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-3"
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
      
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-semibold text-text-primary truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-text-muted truncate">{subtitle}</p>
        )}
      </div>

      {/* Spacer to push right-side items */}
      <div className="flex-1" />

      {/* Action Button */}
      {action && (
        action.href ? (
          <Link
            href={action.href}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl transition-colors font-medium text-sm shadow-sm flex-shrink-0"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{action.label}</span>
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-xl transition-colors font-medium text-sm shadow-sm flex-shrink-0"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">{action.label}</span>
          </button>
        )
      )}

      {/* User Menu - always on the right */}
      <UserMenu showName={true} />
    </motion.div>
  );
}
