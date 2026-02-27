import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { encrypt } from '@/lib/crypto';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

// Re-use schema from parent route (Next.js will share the model)
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

interface McpConnectionDocument {
  connectionId: string;
  userId: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  transport: 'sse';
  url: string;
  headers: Map<string, string>;
  isEnabled: boolean;
  lastConnectedAt?: Date;
  lastError?: string;
  discoveredTools: DiscoveredTool[];
  toolsDiscoveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate MCP server URL for security
 */
function validateMcpUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname);
    
    if (process.env.NODE_ENV === 'production' && (isLocalhost || isPrivateIP)) {
      return { valid: false, error: 'Internal addresses not allowed in production' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

type RouteContext = { params: Promise<{ connectionId: string }> };

/**
 * GET /api/v1/mcp-connections/[connectionId]
 * Get a specific MCP connection
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
    }).lean() as McpConnectionDocument | null;

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      connection: {
        connectionId: connection.connectionId,
        name: connection.name,
        description: connection.description,
        icon: connection.icon,
        color: connection.color,
        transport: connection.transport,
        url: connection.url,
        headerKeys: connection.headers ? Object.keys(connection.headers instanceof Map ? Object.fromEntries(connection.headers) : connection.headers) : [],
        isEnabled: connection.isEnabled,
        lastConnectedAt: connection.lastConnectedAt,
        lastError: connection.lastError,
        toolCount: connection.discoveredTools?.length || 0,
        tools: connection.discoveredTools || [],
        toolsDiscoveredAt: connection.toolsDiscoveredAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching MCP connection:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connection' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/mcp-connections/[connectionId]
 * Update an MCP connection
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId } = await context.params;
    const body = await request.json();
    const { name, description, icon, color, url, headers } = body;

    await connectToDatabase();

    const connection = await McpConnection.findOne({ 
      connectionId,
      userId: user.userId 
    });

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Validate URL if provided
    if (url !== undefined) {
      if (!url || typeof url !== 'string') {
        return NextResponse.json({ error: 'URL is required' }, { status: 400 });
      }
      const urlValidation = validateMcpUrl(url);
      if (!urlValidation.valid) {
        return NextResponse.json({ error: urlValidation.error }, { status: 400 });
      }
      
      // Check for duplicate URL (excluding current)
      const existingUrl = await McpConnection.findOne({ 
        userId: user.userId, 
        url: url.trim(),
        connectionId: { $ne: connectionId }
      });
      if (existingUrl) {
        return NextResponse.json(
          { error: 'A connection with this URL already exists' },
          { status: 409 }
        );
      }
      
      connection.url = url;
    }

    // Update fields
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      
      // Check for duplicate name (excluding current)
      const existing = await McpConnection.findOne({ 
        userId: user.userId, 
        name: name.trim(),
        connectionId: { $ne: connectionId }
      });
      if (existing) {
        return NextResponse.json(
          { error: 'A connection with this name already exists' },
          { status: 409 }
        );
      }
      connection.name = name.trim();
    }
    
    if (description !== undefined) connection.description = description?.trim() || '';
    if (icon !== undefined) connection.icon = icon || 'server';
    if (color !== undefined) connection.color = color || '#10b981';
    if (headers !== undefined) {
      // Encrypt header values before storing
      const encryptedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers || {})) {
        encryptedHeaders[key] = encrypt(value as string);
      }
      connection.headers = new Map(Object.entries(encryptedHeaders));
    }
    
    connection.updatedAt = new Date();
    await connection.save();

    return NextResponse.json({
      success: true,
      connection: {
        connectionId: connection.connectionId,
        name: connection.name,
        description: connection.description,
        icon: connection.icon,
        color: connection.color,
        transport: connection.transport,
        url: connection.url,
        headerKeys: connection.headers ? Object.keys(connection.headers instanceof Map ? Object.fromEntries(connection.headers) : connection.headers) : [],
        isEnabled: connection.isEnabled,
        lastConnectedAt: connection.lastConnectedAt,
        lastError: connection.lastError,
        toolCount: connection.discoveredTools?.length || 0,
        tools: connection.discoveredTools || [],
        toolsDiscoveredAt: connection.toolsDiscoveredAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating MCP connection:', error);
    return NextResponse.json(
      { error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/mcp-connections/[connectionId]
 * Delete an MCP connection
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { connectionId } = await context.params;
    
    await connectToDatabase();

    const result = await McpConnection.deleteOne({ 
      connectionId,
      userId: user.userId 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Connection deleted',
    });
  } catch (error) {
    console.error('Error deleting MCP connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
