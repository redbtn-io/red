/**
 * Reusable Motion Components
 * 
 * Pre-configured animated wrappers for common UI patterns.
 */

'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';
import {
  pageVariants,
  fadeUpVariants,
  fadeVariants,
  staggerContainerVariants,
  staggerItemVariants,
  cardVariants,
  listVariants,
  listItemVariants,
  scaleVariants,
  slideUpVariants,
  modalVariants,
  overlayVariants,
  menuVariants,
} from '@/lib/animations';

// ============================================
// PAGE WRAPPER
// ============================================

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// FADE WRAPPERS
// ============================================

interface FadeInProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  delay?: number;
}

export function FadeIn({ children, delay = 0, className = '', ...props }: FadeInProps) {
  return (
    <motion.div
      variants={fadeVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function FadeInUp({ children, delay = 0, className = '', ...props }: FadeInProps) {
  return (
    <motion.div
      variants={fadeUpVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({ children, delay = 0, className = '', ...props }: FadeInProps) {
  return (
    <motion.div
      variants={slideUpVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, delay = 0, className = '', ...props }: FadeInProps) {
  return (
    <motion.div
      variants={scaleVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// STAGGER CONTAINERS
// ============================================

interface StaggerContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function StaggerContainer({ children, className = '', delay = 0 }: StaggerContainerProps) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ delayChildren: delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className = '', ...props }: FadeInProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// LIST ANIMATIONS
// ============================================

interface AnimatedListProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedList({ children, className = '' }: AnimatedListProps) {
  return (
    <motion.div
      variants={listVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedListItem({ children, className = '', ...props }: FadeInProps) {
  return (
    <motion.div
      variants={listItemVariants}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// CARD ANIMATIONS
// ============================================

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  hoverable?: boolean;
}

export function AnimatedCard({ children, hoverable = true, className = '', ...props }: AnimatedCardProps) {
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover={hoverable ? 'hover' : undefined}
      whileTap={hoverable ? 'tap' : undefined}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// MODAL / OVERLAY
// ============================================

interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function AnimatedModal({ isOpen, onClose, children, className = '' }: AnimatedModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className={`fixed z-50 ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// MENU ANIMATIONS
// ============================================

interface AnimatedMenuProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export function AnimatedMenu({ isOpen, children, className = '' }: AnimatedMenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={menuVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ============================================
// PRESENCE WRAPPER
// ============================================

interface AnimatedPresenceProps {
  children: ReactNode;
  show: boolean;
  mode?: 'wait' | 'sync' | 'popLayout';
}

export function AnimatedPresenceWrapper({ children, show, mode = 'wait' }: AnimatedPresenceProps) {
  return (
    <AnimatePresence mode={mode}>
      {show && children}
    </AnimatePresence>
  );
}

// ============================================
// LOADING STATES
// ============================================

export function LoadingPulse({ className = '' }: { className?: string }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    />
  );
}

export function LoadingDots({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
          className="w-1.5 h-1.5 bg-current rounded-full"
        />
      ))}
    </div>
  );
}

// ============================================
// UTILITY COMPONENTS
// ============================================

interface MotionDivProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
}

// Re-export motion for convenience
export { motion, AnimatePresence };

// Simple motion div with common defaults
export function MotionDiv({ children, ...props }: MotionDivProps) {
  return <motion.div {...props}>{children}</motion.div>;
}
