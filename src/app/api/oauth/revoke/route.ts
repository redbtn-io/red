import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import OAuthAccessToken from '@/lib/database/models/oauth/OAuthAccessToken';
import OAuthClient from '@/lib/database/models/oauth/OAuthClient';
import { verifyClientSecret } from '@/lib/auth/oauth';

/**
 * POST /api/oauth/revoke
 * Revoke an access token or refresh token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, client_id, client_secret, token_type_hint } = body;

    if (!token || !client_id || !client_secret) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing required parameters' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Verify client
    const client = await OAuthClient.findOne({ clientId: client_id });
    if (!client) {
      return NextResponse.json(
        { error: 'invalid_client' },
        { status: 401 }
      );
    }

    if (!verifyClientSecret(client_secret, client.clientSecret)) {
      return NextResponse.json(
        { error: 'invalid_client' },
        { status: 401 }
      );
    }

    // Revoke token
    let deleted = false;
    if (token_type_hint === 'refresh_token' || !token_type_hint) {
      const result = await OAuthAccessToken.deleteOne({
        refreshToken: token,
        clientId: client_id,
      });
      deleted = result.deletedCount > 0;
    }

    if (!deleted && (token_type_hint === 'access_token' || !token_type_hint)) {
      const result = await OAuthAccessToken.deleteOne({
        accessToken: token,
        clientId: client_id,
      });
      deleted = result.deletedCount > 0;
    }

    if (deleted) {
      console.log('[OAuth] Token revoked for client:', client_id);
    }

    // Always return 200 OK (RFC 7009)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[OAuth] Revoke error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}
