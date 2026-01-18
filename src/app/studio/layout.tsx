'use client';

import { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import { useViewportHeight } from '@/hooks/useViewportHeight';

/**
 * Studio Layout
 * 
 * Wraps the Studio pages with ReactFlowProvider for canvas functionality.
 * Uses the same dark theme as the rest of the app.
 * 
 * Handles mobile viewport height to account for browser chrome (address bar, etc.)
 * so the header doesn't scroll off screen.
 */
export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This hook sets --vh and --app-height CSS variables
  useViewportHeight();

  return (
    <ReactFlowProvider>
      {/* Use --app-height instead of h-screen to account for mobile browser chrome */}
      <div 
        className="w-screen overflow-hidden bg-bg-primary"
        style={{ height: 'var(--app-height, 100vh)' }}
      >
        {children}
      </div>
    </ReactFlowProvider>
  );
}
