import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { decrypt, isEncrypted } from '@/lib/crypto';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

const McpConnectionSchema = new mongoose.Schema({
  connectionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'server' },
  color: { type: String, default: '#10b981' },
  transport: { type: String, enum: ['sse'], default: 'sse' },
  url: { type: String, required: true },
  headers: { type: Map, of: String, default: {} },
  isEnabled: { type: Boolean, default: true },
  lastConnectedAt: { type: Date },
  lastError: { type: String },
  discoveredTools: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    inputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
  }],
  toolsDiscoveredAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const McpConnection = mongoose.models.McpConnection || mongoose.model('McpConnection', McpConnectionSchema);

interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: object;
}

type RouteContext = { params: Promise<{ connectionId: string }> };

/**
 * POST /api/v1/mcp-connections/[connectionId]/discover
 * Refresh the list of tools from the MCP server
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId } = await context.params;
    
    await connectToDatabase();

    const connection = await McpConnection.findOne({ 
      connectionId,
      userId: user.userId 
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Build headers from stored object (decrypting values)
    // Note: headers is stored as a plain object in MongoDB, not a Map
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (connection.headers) {
      const headerObj = connection.headers instanceof Map 
        ? Object.fromEntries(connection.headers) 
        : (connection.headers as Record<string, string>);
      for (const [key, value] of Object.entries(headerObj)) {
        headers[key] = isEncrypted(value) ? decrypt(value) : value;
      }
    }

    try {
      // Initialize connection
      const initRes = await fetch(connection.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: { elicitation: {} },
            clientInfo: { name: 'red-ai-webapp', version: '1.0.0' },
          },
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!initRes.ok) {
        connection.lastError = `Initialize failed: ${initRes.status}`;
        connection.updatedAt = new Date();
        await connection.save();
        
        return NextResponse.json({
          success: false,
          error: `Initialize failed: ${initRes.status}`,
        });
      }
      
      const initData = await initRes.json();
      if (initData.error) {
        connection.lastError = initData.error.message || 'Initialize error';
        connection.updatedAt = new Date();
        await connection.save();
        
        return NextResponse.json({
          success: false,
          error: initData.error.message || 'Initialize error',
        });
      }
      
      const serverInfo = initData.result?.serverInfo;
      
      // Send initialized notification
      await fetch(connection.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        }),
      });
      
      // List tools
      const toolsRes = await fetch(connection.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/list',
        }),
        signal: AbortSignal.timeout(10000),
      });
      
      if (!toolsRes.ok) {
        connection.lastError = `Tools list failed: ${toolsRes.status}`;
        connection.updatedAt = new Date();
        await connection.save();
        
        return NextResponse.json({
          success: false,
          error: `Tools list failed: ${toolsRes.status}`,
        });
      }
      
      const toolsData = await toolsRes.json();
      if (toolsData.error) {
        connection.lastError = toolsData.error.message || 'Tools list error';
        connection.updatedAt = new Date();
        await connection.save();
        
        return NextResponse.json({
          success: false,
          error: toolsData.error.message || 'Tools list error',
        });
      }
      
      const tools: DiscoveredTool[] = (toolsData.result?.tools || []).map((t: any) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema || {},
      }));
      
      // Update connection with discovered tools
      connection.discoveredTools = tools;
      connection.toolsDiscoveredAt = new Date();
      connection.lastConnectedAt = new Date();
      connection.lastError = undefined;
      connection.updatedAt = new Date();
      await connection.save();
      
      return NextResponse.json({
        success: true,
        toolCount: tools.length,
        tools,
        serverInfo,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Discovery failed';
      
      connection.lastError = error;
      connection.updatedAt = new Date();
      await connection.save();
      
      return NextResponse.json({
        success: false,
        error,
      });
    }
  } catch (error) {
    console.error('Error discovering MCP tools:', error);
    return NextResponse.json(
      { error: 'Failed to discover tools' },
      { status: 500 }
    );
  }
}
