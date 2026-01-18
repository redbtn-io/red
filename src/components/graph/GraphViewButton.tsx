'use client';

import { motion } from 'framer-motion';
import { GitBranch, Loader2 } from 'lucide-react';

interface GraphViewButtonProps {
  /** Whether a graph is currently running */
  isRunning?: boolean;
  /** Click handler */
  onClick: () => void;
  /** Optional custom className */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show as icon-only */
  iconOnly?: boolean;
  /** Disabled state */
  disabled?: boolean;
}

export function GraphViewButton({
  isRunning = false,
  onClick,
  className = '',
  size = 'md',
  iconOnly = false,
  disabled = false,
}: GraphViewButtonProps) {
  const sizeClasses = {
    sm: 'p-1.5 text-xs',
    md: 'p-2 text-sm',
    lg: 'p-3 text-base',
  };
  
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      className={`
        flex items-center gap-1.5 rounded-lg
        border border-border bg-bg-secondary
        hover:bg-bg-tertiary hover:border-border-hover
        transition-colors
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${sizeClasses[size]}
        ${isRunning ? 'border-accent/50 bg-accent/10' : ''}
        ${className}
      `}
      title={isRunning ? 'View running graph' : 'View graph'}
    >
      {isRunning ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className={`${iconSizes[size]} text-accent`} />
        </motion.div>
      ) : (
        <GitBranch className={`${iconSizes[size]} text-text-muted`} />
      )}
      {!iconOnly && (
        <span className={`text-text-secondary ${isRunning ? 'text-accent' : ''}`}>
          {isRunning ? 'Live' : 'Graph'}
        </span>
      )}
    </motion.button>
  );
}

export default GraphViewButton;
