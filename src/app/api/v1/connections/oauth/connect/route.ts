/**
 * OAuth Connect Endpoint
 * 
 * POST /api/v1/connections/oauth/connect
 * 
 * Initiates an OAuth 2.0 authorization flow:
 * 1. Validates the provider exists and supports OAuth
 * 2. Generates PKCE challenge if required
 * 3. Creates and stores OAuth state
 * 4. Returns authorization URL for redirect
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { ConnectionProvider, type IConnectionProvider } from '@/lib/database/models/connections';
import {
    createOAuthState,
    generateCodeVerifier,
    generateCodeChallenge,
    buildAuthorizationUrl,
    getOAuthCallbackUrl,
    decryptValue,
} from '@/lib/connections';

export const dynamic = 'force-dynamic';

interface ConnectRequest {
  providerId: string;
  scopes?: string[];
  label?: string;
}

interface ConnectResponse {
  authorizationUrl: string;
  state: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json() as ConnectRequest;
    const { providerId, scopes, label } = body;

    if (!providerId) {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    // Connect to database
    await connectToDatabase();

    // Find the provider
    const provider = await ConnectionProvider.findOne({
      providerId,
      status: { $in: ['active', 'beta'] },
    }).lean<IConnectionProvider>();

    if (!provider) {
      return NextResponse.json(
        { error: `Provider '${providerId}' not found or not available` },
        { status: 404 }
      );
    }

    // Verify this is an OAuth 2.0 provider
    if (provider.authType !== 'oauth2') {
      return NextResponse.json(
        { error: `Provider '${providerId}' does not support OAuth 2.0` },
        { status: 400 }
      );
    }

    if (!provider.oauth2Config) {
      return NextResponse.json(
        { error: `Provider '${providerId}' is not properly configured` },
        { status: 500 }
      );
    }

    // Check that we have app credentials
    if (!provider.clientId) {
      return NextResponse.json(
        { error: `Provider '${providerId}' is not configured (missing credentials)` },
        { status: 500 }
      );
    }

    // Decrypt client ID
    const clientId = decryptValue(provider.clientId);
    if (!clientId) {
      return NextResponse.json(
        { error: `Provider '${providerId}' has invalid credentials` },
        { status: 500 }
      );
    }

    // Determine which scopes to request
    const availableScopes = provider.oauth2Config.scopes || [];
    const requiredScopes = availableScopes
      .filter(s => s.required)
      .map(s => s.name);
    const defaultScopes = availableScopes
      .filter(s => s.default)
      .map(s => s.name);
    
    // Use provided scopes or fall back to required + default
    let requestedScopes = scopes && scopes.length > 0
      ? [...new Set([...requiredScopes, ...scopes])]
      : [...new Set([...requiredScopes, ...defaultScopes])];

    // Ensure we have at least some scopes
    if (requestedScopes.length === 0) {
      requestedScopes = availableScopes.map(s => s.name);
    }

    // Generate PKCE if required
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;
    
    if (provider.oauth2Config.pkceRequired) {
      codeVerifier = generateCodeVerifier();
      codeChallenge = generateCodeChallenge(
        codeVerifier, 
        provider.oauth2Config.pkceMethod || 'S256'
      );
    }

    // Create OAuth state
    const state = await createOAuthState({
      userId: user.userId,
      providerId,
      label: label || '',
      requestedScopes,
      codeVerifier,
    });

    // Build authorization URL
    const redirectUri = getOAuthCallbackUrl();
    const scopeString = requestedScopes.join(' ');
    
    // Convert extraAuthParams Map to object if needed
    const extraParams = provider.oauth2Config.extraAuthParams 
      ? Object.fromEntries(
          provider.oauth2Config.extraAuthParams instanceof Map
            ? provider.oauth2Config.extraAuthParams
            : Object.entries(provider.oauth2Config.extraAuthParams)
        )
      : undefined;

    const authorizationUrl = buildAuthorizationUrl({
      authorizationUrl: provider.oauth2Config.authorizationUrl,
      clientId,
      redirectUri,
      scope: scopeString,
      state,
      codeChallenge,
      codeChallengeMethod: provider.oauth2Config.pkceMethod,
      extraParams,
    });

    const response: ConnectResponse = {
      authorizationUrl,
      state,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[OAuth Connect] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
