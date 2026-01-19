import { useEffect, useState, useCallback } from 'react';

export interface UseFavoriteToolsReturn {
  favorites: Set<string>;
  loading: boolean;
  toggleFavorite: (toolId: string) => Promise<void>;
  isFavorite: (toolId: string) => boolean;
  favoritesCount: number;
}

/**
 * Get a unique tool identifier (server:toolName format)
 */
export function getToolId(server: string, toolName: string): string {
  return `${server}:${toolName}`;
}

/**
 * Hook to manage favorite tools
 * Persists to user preferences API
 */
export function useFavoriteTools(): UseFavoriteToolsReturn {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load favorites from API on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await fetch('/api/v1/user/preferences/ui');
        if (response.ok) {
          const data = await response.json();
          setFavorites(new Set(data.favoriteTools || []));
        }
      } catch (error) {
        console.error('[useFavoriteTools] Failed to load favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, []);

  // Toggle a tool's favorite status
  const toggleFavorite = useCallback(async (toolId: string) => {
    const newFavorites = new Set(favorites);
    
    if (newFavorites.has(toolId)) {
      newFavorites.delete(toolId);
    } else {
      newFavorites.add(toolId);
    }
    
    // Optimistic update
    setFavorites(newFavorites);

    // Persist to API
    try {
      const response = await fetch('/api/v1/user/preferences/ui', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favoriteTools: Array.from(newFavorites),
        }),
      });

      if (!response.ok) {
        // Revert on failure
        setFavorites(favorites);
        console.error('[useFavoriteTools] Failed to save favorites');
      }
    } catch (error) {
      // Revert on failure
      setFavorites(favorites);
      console.error('[useFavoriteTools] Failed to save favorites:', error);
    }
  }, [favorites]);

  // Check if a tool is favorited
  const isFavorite = useCallback((toolId: string) => {
    return favorites.has(toolId);
  }, [favorites]);

  return {
    favorites,
    loading,
    toggleFavorite,
    isFavorite,
    favoritesCount: favorites.size,
  };
}
