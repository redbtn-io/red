import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { getRed } from '@/lib/red';

/**
 * GET /api/v1/tools
 * Get all available MCP tools (global + user's custom)
 * 
 * Tools are fetched from the database (registered by workers on startup)
 * rather than directly from MCP servers, so webapp doesn't need MCP runtime.
 * 
 * Query params:
 * - source: 'all' | 'global' | 'custom' - filter by source (default: 'all')
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get source filter from query params
    const { searchParams } = new URL(request.url);
    const sourceFilter = searchParams.get('source') as 'all' | 'global' | 'custom' | null;

    // Get all available tools from database (registered by workers)
    const red = await getRed();
    const result = await red.getToolsFromRegistry(user.userId);

    // Apply source filter if specified
    let filteredTools = result.tools;
    let filteredServers = result.toolsByServer;
    
    if (sourceFilter === 'global') {
      filteredTools = result.tools.filter(t => t.source === 'global');
      filteredServers = result.toolsByServer.filter(s => s.source === 'global');
    } else if (sourceFilter === 'custom') {
      filteredTools = result.tools.filter(t => t.source === 'custom');
      filteredServers = result.toolsByServer.filter(s => s.source === 'custom');
    }

    // Format response
    const tools = filteredTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      server: tool.serverName,
      source: tool.source,
      connectionId: tool.connectionId,
    }));

    return NextResponse.json({
      success: true,
      count: tools.length,
      tools,
      toolsByServer: filteredServers.map(({ server, source, connectionId, tools }) => ({
        server,
        source,
        connectionId,
        count: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
        })),
      })),
      sources: result.sources,
    });

  } catch (error) {
    console.error('[GET /api/v1/tools] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tools',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
