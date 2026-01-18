import { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useAvailableTools } from '@/hooks/useAvailableTools';

interface AvailableToolsProps {
  onSelectTool?: (toolName: string, toolInfo: any) => void;
  compact?: boolean;
}

/**
 * Browser for available MCP tools
 */
export function AvailableToolsBrowser({ onSelectTool, compact = false }: AvailableToolsProps) {
  const { tools, toolsByServer, loading, error } = useAvailableTools();
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set(['web', 'system', 'rag']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleServer = (server: string) => {
    const newExpanded = new Set(expandedServers);
    if (newExpanded.has(server)) {
      newExpanded.delete(server);
    } else {
      newExpanded.add(server);
    }
    setExpandedServers(newExpanded);
  };

  // Filter tools based on search query
  const filteredToolsByServer = toolsByServer.map(serverGroup => ({
    ...serverGroup,
    tools: serverGroup.tools.filter(tool =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter(group => group.tools.length > 0);

  const filteredTools = tools.filter(tool =>
    tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (compact) {
    // Minimal view for embedding
    return (
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search tools..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {loading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 text-accent animate-spin mr-2" />
            <span className="text-sm text-text-muted">Loading tools...</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-sm text-red-200">{error}</span>
          </div>
        )}

        {!loading && !error && filteredTools.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredTools.slice(0, 10).map(tool => (
              <div
                key={`${tool.server}:${tool.name}`}
                className="p-2 bg-bg-primary border border-border rounded hover:bg-bg-elevated cursor-pointer transition-colors"
                onClick={() => onSelectTool?.(tool.name, tool)}
              >
                <div className="font-mono text-xs text-accent-text">{tool.name}</div>
                <div className="text-xs text-text-muted line-clamp-1">{tool.description}</div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && filteredTools.length === 0 && (
          <div className="text-center py-4 text-text-muted text-sm">
            No tools found matching "{searchQuery}"
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-muted" />
        <input
          type="text"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-bg-primary border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-accent animate-spin mb-3" />
          <p className="text-text-secondary">Loading available tools...</p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-200">Failed to load tools</p>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Tools by server */}
      {!loading && !error && (
        <div className="space-y-3">
          {filteredToolsByServer.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="w-12 h-12 text-text-disabled mx-auto mb-3" />
              <p className="text-text-secondary">No tools found matching "{searchQuery}"</p>
            </div>
          ) : (
            filteredToolsByServer.map(serverGroup => (
              <div key={serverGroup.server} className="border border-border rounded-lg overflow-hidden">
                {/* Server header */}
                <button
                  onClick={() => toggleServer(serverGroup.server)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-bg-primary hover:bg-bg-elevated transition-colors"
                >
                  {expandedServers.has(serverGroup.server) ? (
                    <ChevronDown className="w-5 h-5 text-accent" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-text-muted" />
                  )}
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-text-primary">{serverGroup.server}</h3>
                    <p className="text-xs text-text-muted">{serverGroup.count} tool{serverGroup.count !== 1 ? 's' : ''}</p>
                  </div>
                </button>

                {/* Tools list */}
                {expandedServers.has(serverGroup.server) && (
                  <div className="bg-bg-secondary border-t border-border divide-y divide-border">
                    {serverGroup.tools.map(tool => {
                      const fullTool = tools.find(t => t.name === tool.name && t.server === serverGroup.server);
                      return (
                        <div
                          key={`${serverGroup.server}:${tool.name}`}
                          onClick={() => onSelectTool?.(tool.name, fullTool)}
                          className="px-4 py-3 hover:bg-bg-hover cursor-pointer transition-colors"
                        >
                          <div className="font-mono text-sm text-accent-text mb-1">{tool.name}</div>
                          <p className="text-sm text-text-secondary leading-relaxed">{tool.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Summary */}
      {!loading && !error && (
        <div className="text-xs text-text-muted text-center py-2">
          Showing {filteredTools.length} of {tools.length} available tools
        </div>
      )}
    </div>
  );
}
