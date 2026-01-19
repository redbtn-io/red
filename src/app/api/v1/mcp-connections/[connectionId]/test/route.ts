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

type RouteContext = { params: Promise<{ connectionId: string }> };

/**
 * POST /api/v1/mcp-connections/[connectionId]/test
 * Test connectivity to the MCP server
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // More restrictive rate limit for test endpoint
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
    const headers: Record<string, string> = {};
    if (connection.headers) {
      const headerObj = connection.headers instanceof Map 
        ? Object.fromEntries(connection.headers) 
        : (connection.headers as Record<string, string>);
      for (const [key, value] of Object.entries(headerObj)) {
        headers[key] = isEncrypted(value) ? decrypt(value) : value;
      }
    }

    const startTime = Date.now();
    
    try {
      // Health check
      const healthUrl = connection.url.endsWith('/') 
        ? `${connection.url}health` 
        : `${connection.url}/health`;
      
      const healthRes = await fetch(healthUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...headers },
        signal: AbortSignal.timeout(10000),
      });
      
      const latency = Date.now() - startTime;
      
      if (!healthRes.ok) {
        // Update error status
        connection.lastError = `Health check failed: ${healthRes.status}`;
        connection.updatedAt = new Date();
        await connection.save();
        
        return NextResponse.json({
          success: false,
          error: `Health check failed: ${healthRes.status}`,
          latency,
        });
      }
      
      // Update success status
      connection.lastConnectedAt = new Date();
      connection.lastError = undefined;
      connection.updatedAt = new Date();
      await connection.save();
      
      return NextResponse.json({
        success: true,
        latency,
        message: 'Connection successful',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Connection failed';
      const latency = Date.now() - startTime;
      
      // Update error status
      connection.lastError = error;
      connection.updatedAt = new Date();
      await connection.save();
      
      return NextResponse.json({
        success: false,
        error,
        latency,
      });
    }
  } catch (error) {
    console.error('Error testing MCP connection:', error);
    return NextResponse.json(
      { error: 'Failed to test connection' },
      { status: 500 }
    );
  }
}
