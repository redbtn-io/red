import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
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
 * POST /api/v1/mcp-connections/[connectionId]/toggle
 * Enable or disable an MCP connection
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

    // Toggle the enabled state
    connection.isEnabled = !connection.isEnabled;
    connection.updatedAt = new Date();
    await connection.save();

    return NextResponse.json({
      success: true,
      isEnabled: connection.isEnabled,
      message: connection.isEnabled ? 'Connection enabled' : 'Connection disabled',
    });
  } catch (error) {
    console.error('Error toggling MCP connection:', error);
    return NextResponse.json(
      { error: 'Failed to toggle connection' },
      { status: 500 }
    );
  }
}
