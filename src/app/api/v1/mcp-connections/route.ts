import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

/**
 * McpConnection Schema - User's custom MCP server connections
 */
const McpConnectionSchema = new mongoose.Schema({
  connectionId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'server' },
  color: { type: String, default: '#10b981' },
  
  // Transport config (SSE only for now)
  transport: { type: String, enum: ['sse'], default: 'sse' },
  url: { type: String, required: true },
  headers: { type: Map, of: String, default: {} },
  
  // State
  isEnabled: { type: Boolean, default: true },
  lastConnectedAt: { type: Date },
  lastError: { type: String },
  
  // Discovered tools (cached)
  discoveredTools: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    inputSchema: { type: mongoose.Schema.Types.Mixed, default: {} },
  }],
  toolsDiscoveredAt: { type: Date },
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

McpConnectionSchema.index({ userId: 1, isEnabled: 1 });
McpConnectionSchema.index({ userId: 1, name: 1 }, { unique: true });
McpConnectionSchema.index({ userId: 1, url: 1 }, { unique: true });

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
    
    // Must be http or https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
    }
    
    // Block localhost and private IPs in production
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname);
    
    if (process.env.NODE_ENV === 'production' && (isLocalhost || isPrivateIP)) {
      return { valid: false, error: 'Internal addresses not allowed in production' };
    }
    
    // Require HTTPS in production (optional - can be strict later)
    // if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
    //   return { valid: false, error: 'HTTPS required in production' };
    // }
    
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Encrypt all header values
 */
function encryptHeaders(headers: Record<string, string>): Record<string, string> {
  const encrypted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    encrypted[key] = encrypt(value);
  }
  return encrypted;
}

/**
 * Decrypt all header values
 */
function decryptHeaders(headers: Map<string, string> | Record<string, string> | undefined): Record<string, string> {
  if (!headers) return {};
  const decrypted: Record<string, string> = {};
  const entries = headers instanceof Map ? headers.entries() : Object.entries(headers);
  for (const [key, value] of entries) {
    decrypted[key] = isEncrypted(value) ? decrypt(value) : value;
  }
  return decrypted;
}

/**
 * Test connection to an MCP server and discover tools
 */
async function testMcpConnection(url: string, headers?: Record<string, string>): Promise<{
  success: boolean;
  latency?: number;
  serverInfo?: { name: string; version: string };
  tools?: DiscoveredTool[];
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Build headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    
    // Try health check first
    const healthUrl = url.endsWith('/') ? `${url}health` : `${url}/health`;
    const healthRes = await fetch(healthUrl, {
      method: 'GET',
      headers: requestHeaders,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });
    
    if (!healthRes.ok) {
      return { success: false, error: `Health check failed: ${healthRes.status}` };
    }
    
    // Initialize connection
    const initRes = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
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
      return { success: false, error: `Initialize failed: ${initRes.status}` };
    }
    
    const initData = await initRes.json();
    if (initData.error) {
      return { success: false, error: initData.error.message || 'Initialize error' };
    }
    
    const serverInfo = initData.result?.serverInfo || { name: 'Unknown', version: '0.0.0' };
    
    // Send initialized notification
    await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      }),
    });
    
    // List tools
    const toolsRes = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      }),
      signal: AbortSignal.timeout(10000),
    });
    
    if (!toolsRes.ok) {
      return { success: false, error: `Tools list failed: ${toolsRes.status}` };
    }
    
    const toolsData = await toolsRes.json();
    if (toolsData.error) {
      return { success: false, error: toolsData.error.message || 'Tools list error' };
    }
    
    const tools: DiscoveredTool[] = (toolsData.result?.tools || []).map((t: any) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema || {},
    }));
    
    const latency = Date.now() - startTime;
    
    return {
      success: true,
      latency,
      serverInfo,
      tools,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Connection failed';
    return { success: false, error };
  }
}

/**
 * GET /api/v1/mcp-connections
 * List all MCP connections for the user
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const connections = await McpConnection.find({ userId: user.userId })
      .sort({ name: 1 })
      .lean() as McpConnectionDocument[];

    return NextResponse.json({
      success: true,
      count: connections.length,
      connections: connections.map(conn => ({
        connectionId: conn.connectionId,
        name: conn.name,
        description: conn.description,
        icon: conn.icon,
        color: conn.color,
        transport: conn.transport,
        url: conn.url,
        // Don't expose full headers, just keys (headers is a plain object, not a Map)
        headerKeys: conn.headers ? Object.keys(conn.headers) : [],
        isEnabled: conn.isEnabled,
        lastConnectedAt: conn.lastConnectedAt,
        lastError: conn.lastError,
        toolCount: conn.discoveredTools?.length || 0,
        tools: conn.discoveredTools || [],
        toolsDiscoveredAt: conn.toolsDiscoveredAt,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching MCP connections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/mcp-connections
 * Create a new MCP connection
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, url, headers } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Validate URL
    const urlValidation = validateMcpUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json({ error: urlValidation.error }, { status: 400 });
    }

    await connectToDatabase();

    // Check for duplicate name
    const existingName = await McpConnection.findOne({ 
      userId: user.userId, 
      name: name.trim() 
    });
    if (existingName) {
      return NextResponse.json(
        { error: 'A connection with this name already exists' },
        { status: 409 }
      );
    }

    // Check for duplicate URL
    const existingUrl = await McpConnection.findOne({ 
      userId: user.userId, 
      url: url.trim() 
    });
    if (existingUrl) {
      return NextResponse.json(
        { error: 'A connection with this URL already exists' },
        { status: 409 }
      );
    }

    // Test connection and discover tools
    const headersObj = headers && typeof headers === 'object' ? headers : {};
    const testResult = await testMcpConnection(url, headersObj);
    
    if (!testResult.success) {
      return NextResponse.json(
        { error: `Connection test failed: ${testResult.error}` },
        { status: 400 }
      );
    }

    // Generate unique ID
    const connectionId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Encrypt headers before storing
    const encryptedHeaders = encryptHeaders(headersObj);

    // Create connection
    const connection = new McpConnection({
      connectionId,
      userId: user.userId,
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon || 'server',
      color: color || '#10b981',
      transport: 'sse',
      url,
      headers: new Map(Object.entries(encryptedHeaders)),
      isEnabled: true,
      lastConnectedAt: new Date(),
      discoveredTools: testResult.tools || [],
      toolsDiscoveredAt: new Date(),
    });

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
        headerKeys: Object.keys(headersObj),
        isEnabled: connection.isEnabled,
        lastConnectedAt: connection.lastConnectedAt,
        toolCount: connection.discoveredTools.length,
        tools: connection.discoveredTools,
        toolsDiscoveredAt: connection.toolsDiscoveredAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt,
      },
      serverInfo: testResult.serverInfo,
    });
  } catch (error) {
    console.error('Error creating MCP connection:', error);
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}
