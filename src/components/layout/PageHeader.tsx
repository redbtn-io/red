'use client';

import { Menu } from 'lucide-react';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { UserMenu } from './UserMenu';

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle */
  subtitle?: string;
  /** Callback for mobile menu button */
  onMenuClick?: () => void;
  /** Optional icon to display before the title */
  icon?: ReactNode;
  /** Optional action buttons to display on the right (before user menu) */
  actions?: ReactNode;
}

/**
 * Consistent page header with user menu for all routes
 * Use this for pages that don't need specific header actions like "New Chat"
 */
export function PageHeader({ 
  title, 
  subtitle, 
  onMenuClick, 
  icon,
  actions 
}: PageHeaderProps) {
  return (
    <motion.div 
      className="sticky top-0 z-40 bg-bg-elevated/90 backdrop-blur-md border-b border-border/50 px-4 py-3 flex items-center gap-3"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Mobile menu button */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-bg-hover rounded-xl transition-colors text-text-secondary flex-shrink-0"
        >
          <Menu size={24} />
        </button>
      )}
      
      {/* Icon */}
      {icon && (
        <div className="flex-shrink-0">
          {icon}
        </div>
      )}
      
      {/* Title area */}
      <div className="min-w-0">
        <h1 className="text-base sm:text-lg font-semibold text-text-primary truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs text-text-muted truncate">{subtitle}</p>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Optional action buttons */}
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}

      {/* User Menu - always on the right */}
      <UserMenu showName={true} />
    </motion.div>
  );
}
