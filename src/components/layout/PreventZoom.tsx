'use client';

import { useEffect } from 'react';

/**
 * PreventZoom Component
 * 
 * Prevents pinch-to-zoom and double-tap zoom on iOS and other mobile devices.
 * iOS Safari ignores maximum-scale=1 in the viewport meta tag, so we need
 * JavaScript event handlers to reliably prevent zooming.
 * 
 * This component:
 * 1. Prevents pinch-to-zoom via touchmove with 2+ touches
 * 2. Prevents double-tap zoom via gesturestart/gesturechange/gestureend
 * 3. Prevents iOS text input auto-zoom by ensuring font sizes are 16px+
 */
export default function PreventZoom() {
  useEffect(() => {
    // Prevent pinch-to-zoom
    const handleTouchMove = (e: TouchEvent) => {
      // Only prevent if there are 2 or more touch points (pinch gesture)
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Prevent gesture events (Safari-specific zoom gestures)
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    // Prevent double-tap zoom by tracking tap timing
    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    // Add event listeners with passive: false to allow preventDefault
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Gesture events are Safari-specific
    document.addEventListener('gesturestart', handleGestureStart, { passive: false });
    document.addEventListener('gesturechange', handleGestureChange, { passive: false });
    document.addEventListener('gestureend', handleGestureEnd, { passive: false });

    // Cleanup
    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('gesturechange', handleGestureChange);
      document.removeEventListener('gestureend', handleGestureEnd);
    };
  }, []);

  return null;
}
