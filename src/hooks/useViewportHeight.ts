'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to handle viewport height on mobile browsers
 * 
 * Mobile browsers have dynamic browser chrome (address bar, etc.) that affects
 * the viewport height. This hook:
 * 1. Detects if running as a standalone PWA (fullscreen) vs in-browser
 * 2. Calculates the actual available height
 * 3. Sets a CSS custom property for use in layouts
 * 
 * Usage:
 * - Call this hook in your layout component
 * - Use `height: calc(var(--vh, 1vh) * 100)` instead of `h-screen`
 */
export function useViewportHeight() {
  const [isStandalone, setIsStandalone] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    // Check if running as standalone PWA
    const checkStandalone = () => {
      const standalone = 
        // iOS Safari
        ('standalone' in window.navigator && (window.navigator as Navigator & { standalone: boolean }).standalone) ||
        // Android Chrome / Other browsers
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches;
      
      setIsStandalone(standalone);
      return standalone;
    };

    // Calculate and set viewport height
    const updateViewportHeight = () => {
      const standalone = checkStandalone();
      
      // Use visualViewport if available (more accurate on mobile)
      const vh = window.visualViewport?.height || window.innerHeight;
      setViewportHeight(vh);
      
      // Set CSS custom property
      // In standalone mode, use full height
      // In browser mode, use the visual viewport height which accounts for browser chrome
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
      
      // Also set a fixed height variable for containers that need exact height
      document.documentElement.style.setProperty('--app-height', `${vh}px`);
      
      // Set a flag for standalone mode
      document.documentElement.style.setProperty('--is-standalone', standalone ? '1' : '0');
    };

    // Initial calculation
    updateViewportHeight();

    // Listen for resize events
    window.addEventListener('resize', updateViewportHeight);
    
    // Listen for visualViewport changes (handles keyboard, browser chrome, etc.)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
    }

    // Listen for orientation changes
    window.addEventListener('orientationchange', () => {
      // Delay to let browser settle after orientation change
      setTimeout(updateViewportHeight, 100);
    });

    // Listen for display-mode changes (PWA install/uninstall)
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', updateViewportHeight);

    return () => {
      window.removeEventListener('resize', updateViewportHeight);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
      }
      window.removeEventListener('orientationchange', updateViewportHeight);
      displayModeQuery.removeEventListener('change', updateViewportHeight);
    };
  }, []);

  return {
    isStandalone,
    viewportHeight,
  };
}
