/**
 * OAuth Callback Endpoint
 * 
 * GET /api/v1/connections/oauth/callback
 * 
 * Handles OAuth 2.0 authorization callback:
 * 1. Validates state parameter (CSRF protection)
 * 2. Exchanges authorization code for tokens
 * 3. Fetches user info if available
 * 4. Creates encrypted UserConnection record
 * 5. Redirects to connections page
 */

import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import { ConnectionProvider, UserConnection, type IConnectionProvider } from '@/lib/database/models/connections';
import {
  consumeOAuthState,
  exchangeCodeForTokens,
  fetchUserInfo,
  encryptCredentials,
  generateConnectionId,
  getOAuthCallbackUrl,
  calculateTokenExpiry,
  generateDefaultLabel,
} from '@/lib/connections';

export const dynamic = 'force-dynamic';

// Base URL for redirects
function getBaseUrl(): string {
  return process.env.OAUTH_CALLBACK_BASE_URL || 
    process.env.NEXT_PUBLIC_APP_URL || 
    'http://localhost:3000';
}

// Build redirect URL with query params
function buildRedirectUrl(path: string, params: Record<string, string>): string {
  const url = new URL(path, getBaseUrl());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  
  // Check for error from provider
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  
  if (error) {
    console.error(`[OAuth Callback] Provider error: ${error} - ${errorDescription}`);
    return NextResponse.redirect(
      buildRedirectUrl('/connections/accounts', {
        error: 'oauth_error',
        message: errorDescription || error,
      })
    );
  }

  // Get required parameters
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(
      buildRedirectUrl('/connections/accounts', {
        error: 'invalid_callback',
        message: 'Missing authorization code or state',
      })
    );
  }

  try {
    // Validate and consume state (one-time use)
    const stateData = await consumeOAuthState(state);
    
    if (!stateData) {
      return NextResponse.redirect(
        buildRedirectUrl('/connections/accounts', {
          error: 'invalid_state',
          message: 'Invalid or expired state. Please try connecting again.',
        })
      );
    }

    const { userId, providerId, label, requestedScopes, codeVerifier } = stateData;

    // Connect to database
    await connectToDatabase();

    // Find the provider
    const provider = await ConnectionProvider.findOne({ providerId }).lean<IConnectionProvider>();
    
    if (!provider) {
      return NextResponse.redirect(
        buildRedirectUrl('/connections/accounts', {
          error: 'provider_not_found',
          message: `Provider '${providerId}' not found`,
        })
      );
    }

    // Exchange code for tokens
    const redirectUri = getOAuthCallbackUrl();
    const tokenResponse = await exchangeCodeForTokens({
      provider,
      code,
      redirectUri,
      codeVerifier,
    });

    // Fetch user info if available
    let userInfo = null;
    if (provider.oauth2Config?.userinfoUrl && tokenResponse.access_token) {
      userInfo = await fetchUserInfo({
        provider,
        accessToken: tokenResponse.access_token,
      });
    }

    // Check for existing connection with same provider user ID
    let existingConnection = null;
    if (userInfo?.sub) {
      existingConnection = await UserConnection.findOne({
        userId,
        providerId,
        'accountInfo.providerUserId': userInfo.sub,
      });
    }

    // Prepare credentials (encrypted)
    const credentials = encryptCredentials({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      idToken: tokenResponse.id_token,
    });

    // Calculate token expiration
    const tokenMetadata = {
      expiresAt: tokenResponse.expires_in 
        ? calculateTokenExpiry(tokenResponse.expires_in)
        : undefined,
      issuedAt: new Date(),
      scopes: requestedScopes,
      tokenType: tokenResponse.token_type || 'Bearer',
    };

    // Build account info
    const accountInfo = userInfo ? {
      email: userInfo.email,
      name: userInfo.name || userInfo.given_name,
      avatar: userInfo.picture,
      providerUserId: userInfo.sub,
    } : undefined;

    // Determine if this should be the default connection
    const existingCount = await UserConnection.countDocuments({
      userId,
      providerId,
    });
    const shouldBeDefault = existingCount === 0;

    // Generate connection label
    const connectionLabel = label || generateDefaultLabel(
      provider.name,
      userInfo?.email,
      existingCount
    );

    if (existingConnection) {
      // Update existing connection
      existingConnection.credentials = credentials;
      existingConnection.tokenMetadata = tokenMetadata;
      existingConnection.accountInfo = accountInfo || existingConnection.accountInfo;
      existingConnection.status = 'active';
      existingConnection.lastError = undefined;
      existingConnection.errorCount = 0;
      existingConnection.label = connectionLabel;
      await existingConnection.save();

      return NextResponse.redirect(
        buildRedirectUrl('/connections/accounts', {
          success: 'reconnected',
          provider: providerId,
        })
      );
    }

    // Create new connection
    const connectionId = generateConnectionId();
    
    await UserConnection.create({
      connectionId,
      userId,
      providerId,
      label: connectionLabel,
      accountInfo,
      credentials,
      tokenMetadata,
      status: 'active',
      errorCount: 0,
      usageCount: 0,
      isDefault: shouldBeDefault,
      autoRefresh: true,
    });

    return NextResponse.redirect(
      buildRedirectUrl('/connections/accounts', {
        success: 'connected',
        provider: providerId,
      })
    );
  } catch (err) {
    console.error('[OAuth Callback] Error:', err);
    
    const errorMessage = err instanceof Error ? err.message : 'Connection failed';
    
    return NextResponse.redirect(
      buildRedirectUrl('/connections/accounts', {
        error: 'connection_failed',
        message: errorMessage,
      })
    );
  }
}
