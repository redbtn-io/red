import { useEffect, useState, useCallback } from 'react';

export interface ToolSet {
  toolSetId: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  tools: string[];
  toolCount: number;
  isSystem: boolean;
  isPublic: boolean;
  isOwned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UseToolSetsReturn {
  toolsets: ToolSet[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createToolSet: (data: CreateToolSetData) => Promise<ToolSet>;
  updateToolSet: (toolSetId: string, data: Partial<CreateToolSetData>) => Promise<ToolSet>;
  deleteToolSet: (toolSetId: string) => Promise<void>;
}

export interface CreateToolSetData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  tools: string[];
  isPublic?: boolean;
}

/**
 * Hook to manage tool sets
 */
export function useToolSets(): UseToolSetsReturn {
  const [toolsets, setToolsets] = useState<ToolSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchToolsets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/toolsets', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch toolsets: ${response.statusText}`);
      }

      const data = await response.json();
      setToolsets(data.toolsets || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch toolsets';
      setError(message);
      console.error('useToolSets error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToolsets();
  }, [fetchToolsets]);

  const createToolSet = async (data: CreateToolSetData): Promise<ToolSet> => {
    const response = await fetch('/api/v1/toolsets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create toolset');
    }

    const result = await response.json();
    setToolsets(prev => [...prev, result.toolset]);
    return result.toolset;
  };

  const updateToolSet = async (toolSetId: string, data: Partial<CreateToolSetData>): Promise<ToolSet> => {
    const response = await fetch(`/api/v1/toolsets/${toolSetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update toolset');
    }

    const result = await response.json();
    setToolsets(prev => prev.map(ts => ts.toolSetId === toolSetId ? result.toolset : ts));
    return result.toolset;
  };

  const deleteToolSet = async (toolSetId: string): Promise<void> => {
    const response = await fetch(`/api/v1/toolsets/${toolSetId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete toolset');
    }

    setToolsets(prev => prev.filter(ts => ts.toolSetId !== toolSetId));
  };

  return {
    toolsets,
    loading,
    error,
    refetch: fetchToolsets,
    createToolSet,
    updateToolSet,
    deleteToolSet,
  };
}
