/**
 * Single Connection API
 * 
 * GET /api/v1/connections/[connectionId] - Get connection details
 * PATCH /api/v1/connections/[connectionId] - Update connection (label, isDefault, autoRefresh)
 * DELETE /api/v1/connections/[connectionId] - Delete connection
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
    revokeToken,
    decryptCredentials,
    isValidConnectionLabel,
    maskCredential,
} from '@/lib/connections';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    connectionId: string;
  }>;
}

/**
 * GET - Get connection details
 */
export async function GET(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectionId } = await context.params;

  try {
    await connectToDatabase();

    const connection = await UserConnection.findOne({
      connectionId,
      userId: user.userId,
    }).lean();

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Get provider info
    const provider = await ConnectionProvider.findOne({
      providerId: connection.providerId,
    }).lean();

    return NextResponse.json({
      connectionId: connection.connectionId,
      providerId: connection.providerId,
      provider: provider ? {
        name: provider.name,
        icon: provider.icon,
        color: provider.color,
        authType: provider.authType,
        website: provider.website,
        docsUrl: provider.docsUrl,
      } : null,
      label: connection.label,
      accountInfo: connection.accountInfo ? {
        email: connection.accountInfo.email,
        name: connection.accountInfo.name,
        avatar: connection.accountInfo.avatar,
        providerAccountId: connection.accountInfo.providerAccountId,
      } : undefined,
      status: connection.status,
      lastUsedAt: connection.lastUsedAt,
      lastValidatedAt: connection.lastValidatedAt,
      lastRefreshedAt: connection.lastRefreshedAt,
      lastError: connection.lastError,
      errorCount: connection.errorCount,
      usageCount: connection.usageCount,
      isDefault: connection.isDefault,
      autoRefresh: connection.autoRefresh,
      tokenMetadata: connection.tokenMetadata ? {
        expiresAt: connection.tokenMetadata.expiresAt,
        scopes: connection.tokenMetadata.scopes,
      } : undefined,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      // Masked credential hint
      credentialHint: connection.credentials.apiKey 
        ? maskCredential(connection.credentials.apiKey)
        : connection.credentials.username 
          ? maskCredential(connection.credentials.username)
          : undefined,
    });
  } catch (error) {
    console.error('[Connection] Error getting:', error);
    return NextResponse.json(
      { error: 'Failed to get connection' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update connection
 * 
 * Allowed updates: label, isDefault, autoRefresh
 */
export async function PATCH(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectionId } = await context.params;

  try {
    const body = await request.json();

    await connectToDatabase();

    const connection = await UserConnection.findOne({
      connectionId,
      userId: user.userId,
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    if (body.label !== undefined) {
      if (!isValidConnectionLabel(body.label)) {
        return NextResponse.json(
          { error: 'Label must be 1-100 characters' },
          { status: 400 }
        );
      }
      connection.label = body.label;
    }

    if (body.isDefault !== undefined) {
      connection.isDefault = Boolean(body.isDefault);
    }

    if (body.autoRefresh !== undefined) {
      connection.autoRefresh = Boolean(body.autoRefresh);
    }

    await connection.save();

    return NextResponse.json({
      connectionId: connection.connectionId,
      label: connection.label,
      isDefault: connection.isDefault,
      autoRefresh: connection.autoRefresh,
      updatedAt: connection.updatedAt,
    });
  } catch (error) {
    console.error('[Connection] Error updating:', error);
    return NextResponse.json(
      { error: 'Failed to update connection' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete connection
 * 
 * For OAuth connections, attempts to revoke tokens with the provider.
 */
export async function DELETE(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectionId } = await context.params;

  try {
    await connectToDatabase();

    const connection = await UserConnection.findOne({
      connectionId,
      userId: user.userId,
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Get provider for OAuth revocation
    const provider = await ConnectionProvider.findOne({
      providerId: connection.providerId,
    }).lean<IConnectionProvider>();

    // Attempt to revoke OAuth tokens
    if (provider?.authType === 'oauth2' && provider.oauth2Config?.revokeUrl) {
      const credentials = decryptCredentials(connection.credentials);
      
      // Revoke access token
      if (credentials.accessToken) {
        try {
          await revokeToken({
            provider,
            token: credentials.accessToken,
            tokenTypeHint: 'access_token',
          });
        } catch {
          // Revocation failures are non-critical
        }
      }
      
      // Revoke refresh token
      if (credentials.refreshToken) {
        try {
          await revokeToken({
            provider,
            token: credentials.refreshToken,
            tokenTypeHint: 'refresh_token',
          });
        } catch {
          // Revocation failures are non-critical
        }
      }
    }

    // Delete the connection
    await UserConnection.deleteOne({ connectionId, userId: user.userId });

    // If this was the default, make another connection the default
    if (connection.isDefault) {
      const nextConnection = await UserConnection.findOne({
        userId: user.userId,
        providerId: connection.providerId,
      }).sort({ createdAt: 1 });

      if (nextConnection) {
        nextConnection.isDefault = true;
        await nextConnection.save();
      }
    }

    return NextResponse.json({ 
      deleted: true,
      connectionId,
    });
  } catch (error) {
    console.error('[Connection] Error deleting:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection' },
      { status: 500 }
    );
  }
}
