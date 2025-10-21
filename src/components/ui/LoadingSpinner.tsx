import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /**
   * Display mode: 
   * - 'fullscreen': Covers entire viewport with backdrop, centers spinner
   * - 'inline': Just shows spinner inline (default)
   */
  mode?: 'fullscreen' | 'inline';
  
  /**
   * Size of the spinner icon
   */
  size?: number;
  
  /**
   * Optional message to display below spinner
   */
  message?: string;
  
  /**
   * Custom className for styling
   */
  className?: string;
}

export function LoadingSpinner({ 
  mode = 'inline', 
  size = 24, 
  message,
  className = '' 
}: LoadingSpinnerProps) {
  
  if (mode === 'fullscreen') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-3 bg-[#1a1a1a] border border-red-500/50 rounded-xl px-8 py-6 shadow-2xl">
          <Loader2 size={size} className="text-red-400 animate-spin" />
          {message && (
            <p className="text-sm text-gray-300">{message}</p>
          )}
        </div>
      </div>
    );
  }
  
  // Inline mode
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Loader2 size={size} className="text-red-400 animate-spin" />
      {message && (
        <span className="text-sm text-gray-300">{message}</span>
      )}
    </div>
  );
}
