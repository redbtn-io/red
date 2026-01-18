import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { getRed } from '@/lib/red';

/**
 * GET /api/v1/tools
 * Get all available MCP tools
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

    // Get all available MCP tools
    const red = await getRed();
    const toolsByServer = await red.getMcpTools();

    // Format response
    const tools = toolsByServer.flatMap(({ server, tools }) =>
      tools.map(tool => ({
        server,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }))
    );

    return NextResponse.json({
      success: true,
      count: tools.length,
      tools,
      toolsByServer: toolsByServer.map(({ server, tools }) => ({
        server,
        count: tools.length,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
        })),
      })),
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
