import { useEffect, useState, useCallback } from 'react';

export interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: object;
}

export interface McpConnection {
  connectionId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  transport: 'sse';
  url: string;
  headerKeys: string[];
  isEnabled: boolean;
  lastConnectedAt?: string;
  lastError?: string;
  toolCount: number;
  tools: DiscoveredTool[];
  toolsDiscoveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMcpConnectionData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  url: string;
  headers?: Record<string, string>;
}

export interface TestResult {
  success: boolean;
  latency?: number;
  error?: string;
  message?: string;
}

export interface DiscoverResult {
  success: boolean;
  toolCount?: number;
  tools?: DiscoveredTool[];
  serverInfo?: { name: string; version: string };
  error?: string;
}

export interface UseMcpConnectionsReturn {
  connections: McpConnection[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createConnection: (data: CreateMcpConnectionData) => Promise<McpConnection>;
  updateConnection: (connectionId: string, data: Partial<CreateMcpConnectionData>) => Promise<McpConnection>;
  deleteConnection: (connectionId: string) => Promise<void>;
  testConnection: (connectionId: string) => Promise<TestResult>;
  discoverTools: (connectionId: string) => Promise<DiscoverResult>;
  toggleConnection: (connectionId: string) => Promise<boolean>;
}

/**
 * Hook to manage MCP connections
 */
export function useMcpConnections(): UseMcpConnectionsReturn {
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/mcp-connections', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch connections: ${response.statusText}`);
      }

      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch connections';
      setError(message);
      console.error('useMcpConnections error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const createConnection = async (data: CreateMcpConnectionData): Promise<McpConnection> => {
    const response = await fetch('/api/v1/mcp-connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create connection');
    }

    const result = await response.json();
    setConnections(prev => [...prev, result.connection]);
    return result.connection;
  };

  const updateConnection = async (connectionId: string, data: Partial<CreateMcpConnectionData>): Promise<McpConnection> => {
    const response = await fetch(`/api/v1/mcp-connections/${connectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update connection');
    }

    const result = await response.json();
    setConnections(prev => prev.map(c => 
      c.connectionId === connectionId ? result.connection : c
    ));
    return result.connection;
  };

  const deleteConnection = async (connectionId: string): Promise<void> => {
    const response = await fetch(`/api/v1/mcp-connections/${connectionId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to delete connection');
    }

    setConnections(prev => prev.filter(c => c.connectionId !== connectionId));
  };

  const testConnection = async (connectionId: string): Promise<TestResult> => {
    const response = await fetch(`/api/v1/mcp-connections/${connectionId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();
    
    // Update local state with test result
    if (result.success) {
      setConnections(prev => prev.map(c => 
        c.connectionId === connectionId 
          ? { ...c, lastConnectedAt: new Date().toISOString(), lastError: undefined }
          : c
      ));
    } else {
      setConnections(prev => prev.map(c => 
        c.connectionId === connectionId 
          ? { ...c, lastError: result.error }
          : c
      ));
    }
    
    return result;
  };

  const discoverTools = async (connectionId: string): Promise<DiscoverResult> => {
    const response = await fetch(`/api/v1/mcp-connections/${connectionId}/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();
    
    // Update local state with discovered tools
    if (result.success) {
      setConnections(prev => prev.map(c => 
        c.connectionId === connectionId 
          ? { 
              ...c, 
              tools: result.tools || [], 
              toolCount: result.toolCount || 0,
              toolsDiscoveredAt: new Date().toISOString(),
              lastConnectedAt: new Date().toISOString(),
              lastError: undefined
            }
          : c
      ));
    } else {
      setConnections(prev => prev.map(c => 
        c.connectionId === connectionId 
          ? { ...c, lastError: result.error }
          : c
      ));
    }
    
    return result;
  };

  const toggleConnection = async (connectionId: string): Promise<boolean> => {
    const response = await fetch(`/api/v1/mcp-connections/${connectionId}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to toggle connection');
    }

    const result = await response.json();
    
    // Update local state
    setConnections(prev => prev.map(c => 
      c.connectionId === connectionId 
        ? { ...c, isEnabled: result.isEnabled }
        : c
    ));
    
    return result.isEnabled;
  };

  return {
    connections,
    loading,
    error,
    refetch: fetchConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    discoverTools,
    toggleConnection,
  };
}
