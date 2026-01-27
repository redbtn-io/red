/**
 * User Connections API
 * 
 * GET /api/v1/connections - List user's connections
 * POST /api/v1/connections - Create a new connection (API Key, Basic Auth, Multi-credential)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import connectToDatabase from '@/lib/database/mongodb';
import {
    ConnectionProvider,
    UserConnection,
    type IConnectionProvider,
} from '@/lib/database/models/connections';
import {
    encryptCredentials,
    generateConnectionId,
    isValidConnectionLabel,
    generateDefaultLabel,
    testConnection,
    buildBasicAuthHeader,
    parseHeaderFormat,
} from '@/lib/connections';

export const dynamic = 'force-dynamic';

/**
 * GET - List user's connections
 * 
 * Query params:
 * - providerId: Filter by provider
 * - status: Filter by status
 * - grouped: Group by provider (default: true)
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const providerId = searchParams.get('providerId');
  const status = searchParams.get('status');
  const grouped = searchParams.get('grouped') !== 'false';

  try {
    await connectToDatabase();

    // Build query
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { userId: user.userId };

    if (providerId) {
      query.providerId = providerId;
    }

    if (status) {
      query.status = { $in: status.split(',') };
    }

    const connections = await UserConnection.find(query)
      .sort({ providerId: 1, isDefault: -1, createdAt: -1 })
      .lean();

    // Get provider info for each connection
    const providerIds = [...new Set(connections.map(c => c.providerId))];
    const providers = await ConnectionProvider.find({ 
      providerId: { $in: providerIds } 
    }).lean();
    
    const providerMap = new Map(providers.map(p => [p.providerId, p]));

    // Transform connections (remove sensitive data)
    const transformedConnections = connections.map(conn => {
      const provider = providerMap.get(conn.providerId);
      return {
        connectionId: conn.connectionId,
        providerId: conn.providerId,
        providerName: provider?.name || conn.providerId,
        providerIcon: provider?.icon,
        providerColor: provider?.color,
        label: conn.label,
        accountInfo: conn.accountInfo ? {
          email: conn.accountInfo.email,
          name: conn.accountInfo.name,
          avatar: conn.accountInfo.avatar,
          providerAccountId: conn.accountInfo.providerAccountId,
        } : undefined,
        status: conn.status,
        lastUsedAt: conn.lastUsedAt,
        lastValidatedAt: conn.lastValidatedAt,
        lastError: conn.lastError,
        isDefault: conn.isDefault,
        autoRefresh: conn.autoRefresh,
        createdAt: conn.createdAt,
        // Note: Credentials are encrypted, so we indicate presence but don't show hints
        // This avoids expensive decryption for list views
        hasApiKey: Boolean(conn.credentials.apiKey),
        hasBasicAuth: Boolean(conn.credentials.username),
      };
    });

    if (grouped) {
      // Group by provider
      const groupedConnections: Record<string, {
        provider: {
          providerId: string;
          name: string;
          icon: string;
          color: string;
          authType: string;
        };
        connections: typeof transformedConnections;
      }> = {};

      for (const conn of transformedConnections) {
        if (!groupedConnections[conn.providerId]) {
          const provider = providerMap.get(conn.providerId);
          groupedConnections[conn.providerId] = {
            provider: {
              providerId: conn.providerId,
              name: provider?.name || conn.providerId,
              icon: provider?.icon || 'key',
              color: provider?.color || '#6B7280',
              authType: provider?.authType || 'unknown',
            },
            connections: [],
          };
        }
        groupedConnections[conn.providerId].connections.push(conn);
      }

      return NextResponse.json({
        grouped: Object.values(groupedConnections),
        total: transformedConnections.length,
      });
    }

    return NextResponse.json({
      connections: transformedConnections,
      total: transformedConnections.length,
    });
  } catch (error) {
    console.error('[Connections] Error listing:', error);
    return NextResponse.json(
      { error: 'Failed to list connections' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new connection
 * 
 * For API Key:
 * { providerId, apiKey, label? }
 * 
 * For Basic Auth:
 * { providerId, username, password, label? }
 * 
 * For Multi-credential:
 * { providerId, credentials: { key1: value1, ... }, label? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { providerId, label } = body;

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    if (label && !isValidConnectionLabel(label)) {
      return NextResponse.json(
        { error: 'Label must be 1-100 characters' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the provider
    const provider = await ConnectionProvider.findOne({
      providerId,
      status: { $in: ['active', 'beta'] },
    }).lean<IConnectionProvider>();

    if (!provider) {
      return NextResponse.json(
        { error: `Provider '${providerId}' not found` },
        { status: 404 }
      );
    }

    // Handle different auth types
    let credentials: Record<string, string> = {};
    let testHeaders: Record<string, string> | null = null;

    switch (provider.authType) {
      case 'api_key': {
        const { apiKey } = body;
        if (!apiKey) {
          return NextResponse.json({ error: 'apiKey is required' }, { status: 400 });
        }
        
        credentials = { apiKey };
        
        // Build test headers
        if (provider.apiKeyConfig) {
          const headerValue = parseHeaderFormat(
            provider.apiKeyConfig.headerFormat,
            { key: apiKey }
          );
          testHeaders = { [provider.apiKeyConfig.headerName]: headerValue };
        }
        break;
      }

      case 'basic': {
        const { username, password } = body;
        if (!username || !password) {
          return NextResponse.json(
            { error: 'username and password are required' },
            { status: 400 }
          );
        }
        
        credentials = { username, password };
        
        // Build test headers
        if (provider.basicAuthConfig) {
          if (provider.basicAuthConfig.headerFormat === 'basic') {
            testHeaders = { 'Authorization': buildBasicAuthHeader(username, password) };
          } else if (provider.basicAuthConfig.customHeaderFormat) {
            const headerValue = parseHeaderFormat(
              provider.basicAuthConfig.customHeaderFormat,
              { username, password }
            );
            testHeaders = { 
              [provider.basicAuthConfig.customHeaderName || 'Authorization']: headerValue 
            };
          }
        }
        break;
      }

      case 'multi_credential': {
        const { credentials: multiCreds } = body;
        if (!multiCreds || typeof multiCreds !== 'object') {
          return NextResponse.json(
            { error: 'credentials object is required' },
            { status: 400 }
          );
        }

        // Validate required fields
        if (provider.multiCredentialConfig) {
          for (const field of provider.multiCredentialConfig.credentials) {
            if (field.required && !multiCreds[field.key]) {
              return NextResponse.json(
                { error: `${field.label} is required` },
                { status: 400 }
              );
            }
          }
          
          // Build test headers using headerBuilder template
          const headerValue = parseHeaderFormat(
            provider.multiCredentialConfig.headerBuilder,
            multiCreds
          );
          testHeaders = { 'Authorization': headerValue };
        }

        credentials = { multiCredentials: multiCreds };
        break;
      }

      case 'oauth2':
        return NextResponse.json(
          { error: 'Use /api/v1/connections/oauth/connect for OAuth providers' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { error: `Auth type '${provider.authType}' not supported for direct creation` },
          { status: 400 }
        );
    }

    // Test the connection if test endpoint is configured
    const testConfig = provider.apiKeyConfig || provider.basicAuthConfig || provider.multiCredentialConfig;
    if (testConfig?.testEndpoint && testHeaders) {
      const testResult = await testConnection({
        testEndpoint: testConfig.testEndpoint,
        testMethod: testConfig.testMethod || 'GET',
        testExpectedStatus: testConfig.testExpectedStatus || 200,
        headers: testHeaders,
      });

      if (!testResult.valid) {
        return NextResponse.json(
          { 
            error: 'Credential validation failed',
            details: testResult.error,
          },
          { status: 400 }
        );
      }
    }

    // Count existing connections for this provider
    const existingCount = await UserConnection.countDocuments({
      userId: user.userId,
      providerId,
    });

    // Generate connection label
    const connectionLabel = label || generateDefaultLabel(
      provider.name,
      undefined,
      existingCount
    );

    // Encrypt credentials
    const encryptedCredentials = encryptCredentials(credentials);

    // Create the connection
    const connectionId = generateConnectionId();
    
    const connection = await UserConnection.create({
      connectionId,
      userId: user.userId,
      providerId,
      label: connectionLabel,
      credentials: encryptedCredentials,
      status: 'active',
      errorCount: 0,
      usageCount: 0,
      isDefault: existingCount === 0,
      autoRefresh: false, // Non-OAuth2 connections don't auto-refresh
      lastValidatedAt: testConfig?.testEndpoint ? new Date() : undefined,
    });

    return NextResponse.json({
      connectionId: connection.connectionId,
      providerId: connection.providerId,
      label: connection.label,
      status: connection.status,
      isDefault: connection.isDefault,
    }, { status: 201 });
  } catch (error) {
    console.error('[Connections] Error creating:', error);
    return NextResponse.json(
      { error: 'Failed to create connection' },
      { status: 500 }
    );
  }
}
