'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'redbtn-theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');
  const [mounted, setMounted] = useState(false);

  // Resolve the actual theme (handle 'system' preference)
  const resolveTheme = useCallback((themeValue: Theme): ResolvedTheme => {
    if (themeValue === 'system') {
      return getSystemTheme();
    }
    return themeValue;
  }, []);

  // Apply theme to document
  const applyTheme = useCallback((resolved: ResolvedTheme) => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(resolved);
    
    // Also set color-scheme for native elements
    root.style.colorScheme = resolved;
    
    // Update theme-color meta tag for PWA status bar
    // We update ALL theme-color meta tags to the same value to override media queries
    const themeColor = resolved === 'dark' ? '#0a0a0a' : '#ffffff';
    const existingMetas = document.querySelectorAll('meta[name="theme-color"]');
    
    if (existingMetas.length > 0) {
      // Update all existing meta tags (including those with media queries)
      existingMetas.forEach(meta => {
        meta.setAttribute('content', themeColor);
      });
    } else {
      // Create one if none exist
      const metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      metaThemeColor.setAttribute('content', themeColor);
      document.head.appendChild(metaThemeColor);
    }
  }, []);

  // Set theme and persist
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyTheme(resolved);
    
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      console.warn('Failed to save theme preference:', e);
    }
  }, [resolveTheme, applyTheme]);

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initialTheme = stored || 'dark';
      setThemeState(initialTheme);
      const resolved = resolveTheme(initialTheme);
      setResolvedTheme(resolved);
      applyTheme(resolved);
    } catch (e) {
      console.warn('Failed to load theme preference:', e);
      applyTheme('dark');
    }
  }, [resolveTheme, applyTheme]);

  // Listen for system preference changes when theme is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newResolved = e.matches ? 'dark' : 'light';
      setResolvedTheme(newResolved);
      applyTheme(newResolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
