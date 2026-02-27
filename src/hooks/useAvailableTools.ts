import { useEffect, useState } from 'react';

export interface ToolInfo {
  server: string;
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  source: 'global' | 'custom';
  connectionId?: string;
}

export interface ToolsByServer {
  server: string;
  source: 'global' | 'custom';
  connectionId?: string;
  count: number;
  tools: Array<{
    name: string;
    description: string;
  }>;
}

export interface ToolSources {
  global: string[];
  custom: string[];
}

export interface UseAvailableToolsReturn {
  tools: ToolInfo[];
  toolsByServer: ToolsByServer[];
  sources: ToolSources;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch available MCP tools (global + user's custom)
 */
export function useAvailableTools(): UseAvailableToolsReturn {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [toolsByServer, setToolsByServer] = useState<ToolsByServer[]>([]);
  const [sources, setSources] = useState<ToolSources>({ global: [], custom: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTools = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/tools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tools: ${response.statusText}`);
      }

      const data = await response.json();
      setTools(data.tools || []);
      setToolsByServer(data.toolsByServer || []);
      setSources(data.sources || { global: [], custom: [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tools';
      setError(message);
      console.error('[useAvailableTools] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTools();
  }, []);

  return {
    tools,
    toolsByServer,
    sources,
    loading,
    error,
    refetch: fetchTools,
  };
}
