import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import OAuthClient from '@/lib/database/models/oauth/OAuthClient';
import OAuthAuthorizationCode from '@/lib/database/models/oauth/OAuthAuthorizationCode';
import OAuthAccessToken from '@/lib/database/models/oauth/OAuthAccessToken';
import { verifyClientSecret, generateAccessToken, generateRefreshToken } from '@/lib/auth/oauth';

/**
 * POST /api/oauth/token
 * Exchange authorization code for access token
 * Or refresh an access token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { grant_type, code, client_id, client_secret, redirect_uri, refresh_token } = body;

    await connectToDatabase();

    // Verify client
    const client = await OAuthClient.findOne({ clientId: client_id });
    if (!client) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client not found' },
        { status: 401 }
      );
    }

    // Verify client secret
    if (!verifyClientSecret(client_secret, client.clientSecret)) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Invalid client credentials' },
        { status: 401 }
      );
    }

    if (grant_type === 'authorization_code') {
      return await handleAuthorizationCodeGrant(code, client_id, redirect_uri);
    } else if (grant_type === 'refresh_token') {
      return await handleRefreshTokenGrant(refresh_token, client_id);
    } else {
      return NextResponse.json(
        { error: 'unsupported_grant_type', error_description: 'Grant type not supported' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[OAuth] Token error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle authorization code grant
 */
async function handleAuthorizationCodeGrant(
  code: string,
  clientId: string,
  redirectUri: string
) {
  // Find and validate authorization code
  const authCode = await OAuthAuthorizationCode.findOne({
    code,
    clientId,
    redirectUri,
    expiresAt: { $gt: new Date() },
  });

  if (!authCode) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired authorization code' },
      { status: 400 }
    );
  }

  // Delete the authorization code (one-time use)
  await OAuthAuthorizationCode.deleteOne({ _id: authCode._id });

  // Generate access token and refresh token
  const accessToken = generateAccessToken();
  const refreshToken = generateRefreshToken();
  const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  const refreshExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Save access token
  await OAuthAccessToken.create({
    accessToken,
    refreshToken,
    clientId,
    userId: authCode.userId,
    scopes: authCode.scopes,
    expiresAt: accessExpiresAt,
    refreshExpiresAt,
  });

  console.log('[OAuth] Access token issued for user:', authCode.userId);

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600, // 1 hour in seconds
    refresh_token: refreshToken,
    scope: authCode.scopes.join(' '),
  });
}

/**
 * Handle refresh token grant
 */
async function handleRefreshTokenGrant(refreshToken: string, clientId: string) {
  // Find valid refresh token
  const tokenDoc = await OAuthAccessToken.findOne({
    refreshToken,
    clientId,
    refreshExpiresAt: { $gt: new Date() },
  });

  if (!tokenDoc) {
    return NextResponse.json(
      { error: 'invalid_grant', error_description: 'Invalid or expired refresh token' },
      { status: 400 }
    );
  }

  // Generate new access token
  const newAccessToken = generateAccessToken();
  const accessExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Update token document
  tokenDoc.accessToken = newAccessToken;
  tokenDoc.expiresAt = accessExpiresAt;
  await tokenDoc.save();

  console.log('[OAuth] Access token refreshed for user:', tokenDoc.userId);

  return NextResponse.json({
    access_token: newAccessToken,
    token_type: 'Bearer',
    expires_in: 3600, // 1 hour in seconds
    refresh_token: refreshToken, // Same refresh token
    scope: tokenDoc.scopes.join(' '),
  });
}
