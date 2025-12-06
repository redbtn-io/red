/**
 * Framer Motion Animation Variants & Utilities
 * 
 * Centralized animation configurations for consistent motion across the app.
 */

import { Variants, Transition } from 'framer-motion';

// ============================================
// TRANSITIONS
// ============================================

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const smoothTransition: Transition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.2,
};

export const fastTransition: Transition = {
  type: 'tween',
  ease: 'easeOut',
  duration: 0.15,
};

export const slowTransition: Transition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.4,
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: 20,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: fastTransition,
  },
};

export const pageSlideVariants: Variants = {
  initial: { 
    opacity: 0, 
    x: 20,
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: fastTransition,
  },
};

// ============================================
// FADE VARIANTS
// ============================================

export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0,
    transition: fastTransition,
  },
};

export const fadeUpVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: 10,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    y: -5,
    transition: fastTransition,
  },
};

export const fadeDownVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: -10,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    y: 5,
    transition: fastTransition,
  },
};

// ============================================
// SCALE VARIANTS
// ============================================

export const scaleVariants: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.95,
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    transition: fastTransition,
  },
};

export const popVariants: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.8,
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.8,
    transition: fastTransition,
  },
};

// ============================================
// SLIDE VARIANTS
// ============================================

export const slideRightVariants: Variants = {
  initial: { 
    opacity: 0, 
    x: -20,
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    x: -20,
    transition: fastTransition,
  },
};

export const slideLeftVariants: Variants = {
  initial: { 
    opacity: 0, 
    x: 20,
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    x: 20,
    transition: fastTransition,
  },
};

export const slideUpVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: 20,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    y: 20,
    transition: fastTransition,
  },
};

// ============================================
// STAGGER CONTAINERS
// ============================================

export const staggerContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.03,
      staggerDirection: -1,
    },
  },
};

export const staggerFastContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05,
    },
  },
};

export const staggerSlowContainerVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.15,
    },
  },
};

// ============================================
// STAGGER ITEMS
// ============================================

export const staggerItemVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: 15,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: fastTransition,
  },
};

export const staggerScaleItemVariants: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.9,
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    scale: 0.9,
    transition: fastTransition,
  },
};

// ============================================
// CARD VARIANTS
// ============================================

export const cardVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: 20,
    scale: 0.98,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    y: 10,
    scale: 0.98,
    transition: fastTransition,
  },
  hover: {
    y: -2,
    transition: fastTransition,
  },
  tap: {
    scale: 0.98,
    transition: fastTransition,
  },
};

// ============================================
// MODAL / OVERLAY VARIANTS
// ============================================

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { 
    opacity: 1,
    transition: fastTransition,
  },
  exit: { 
    opacity: 0,
    transition: fastTransition,
  },
};

export const modalVariants: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.95,
    y: 10,
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: 10,
    transition: fastTransition,
  },
};

export const sheetVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: '100%',
  },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { 
    opacity: 0, 
    y: '100%',
    transition: smoothTransition,
  },
};

export const drawerVariants: Variants = {
  initial: { 
    x: '-100%',
  },
  animate: { 
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { 
    x: '-100%',
    transition: smoothTransition,
  },
};

export const drawerRightVariants: Variants = {
  initial: { 
    x: '100%',
  },
  animate: { 
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 30,
    },
  },
  exit: { 
    x: '100%',
    transition: smoothTransition,
  },
};

// ============================================
// MENU / DROPDOWN VARIANTS
// ============================================

export const menuVariants: Variants = {
  initial: { 
    opacity: 0, 
    scale: 0.95,
    y: -5,
  },
  animate: { 
    opacity: 1, 
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 25,
    },
  },
  exit: { 
    opacity: 0, 
    scale: 0.95,
    y: -5,
    transition: fastTransition,
  },
};

export const dropdownVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: -10,
    scaleY: 0.8,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scaleY: 1,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 30,
    },
  },
  exit: { 
    opacity: 0, 
    y: -10,
    scaleY: 0.8,
    transition: fastTransition,
  },
};

// ============================================
// LIST VARIANTS
// ============================================

export const listVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

export const listItemVariants: Variants = {
  initial: { 
    opacity: 0, 
    x: -10,
  },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0, 
    x: -10,
    transition: fastTransition,
  },
};

// ============================================
// LOADING VARIANTS
// ============================================

export const pulseVariants: Variants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const spinVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const bounceVariants: Variants = {
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================
// SKELETON VARIANTS
// ============================================

export const skeletonVariants: Variants = {
  initial: { opacity: 0.3 },
  animate: {
    opacity: [0.3, 0.6, 0.3],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// ============================================
// BUTTON / INTERACTIVE VARIANTS
// ============================================

export const buttonVariants: Variants = {
  initial: { scale: 1 },
  hover: { 
    scale: 1.02,
    transition: fastTransition,
  },
  tap: { 
    scale: 0.98,
    transition: fastTransition,
  },
};

export const iconButtonVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: { 
    scale: 1.1,
    transition: fastTransition,
  },
  tap: { 
    scale: 0.9,
    transition: fastTransition,
  },
};

// ============================================
// NOTIFICATION / TOAST VARIANTS
// ============================================

export const toastVariants: Variants = {
  initial: { 
    opacity: 0, 
    y: 50,
    scale: 0.9,
  },
  animate: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: springTransition,
  },
  exit: { 
    opacity: 0, 
    y: 20,
    scale: 0.9,
    transition: fastTransition,
  },
};

// ============================================
// TAB VARIANTS
// ============================================

export const tabContentVariants: Variants = {
  initial: { 
    opacity: 0,
    x: 10,
  },
  animate: { 
    opacity: 1,
    x: 0,
    transition: smoothTransition,
  },
  exit: { 
    opacity: 0,
    x: -10,
    transition: fastTransition,
  },
};

export const tabIndicatorVariants: Variants = {
  initial: {},
  animate: {
    transition: springTransition,
  },
};
