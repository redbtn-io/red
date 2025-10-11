import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import OAuthAccessToken from '@/lib/database/models/oauth/OAuthAccessToken';
import OAuthClient from '@/lib/database/models/oauth/OAuthClient';
import User from '@/lib/database/models/auth/User';

/**
 * POST /api/oauth/introspect
 * Validate an access token and return metadata
 * 
 * Spec: RFC 7662 (OAuth 2.0 Token Introspection)
 * 
 * Request:
 * - token: The token to introspect
 * - token_type_hint: "access_token" or "refresh_token" (optional)
 * 
 * Response:
 * - active: boolean - whether token is active
 * - scope: space-separated scopes
 * - client_id: client identifier
 * - username: user identifier
 * - token_type: "Bearer"
 * - exp: expiration timestamp
 * - iat: issued at timestamp
 * - sub: subject (user ID)
 */
export async function POST(request: NextRequest) {
  try {
    // Parse Basic Auth or form data for client authentication
    const authHeader = request.headers.get('authorization');
    let clientId: string | null = null;
    let clientSecret: string | null = null;

    if (authHeader?.startsWith('Basic ')) {
      const base64 = authHeader.slice(6);
      const decoded = Buffer.from(base64, 'base64').toString('utf-8');
      const [id, secret] = decoded.split(':');
      clientId = id;
      clientSecret = secret;
    }

    const body = await request.json();
    const { token, token_type_hint } = body;

    // Get client from form data if not in Basic Auth
    if (!clientId) {
      clientId = body.client_id;
      clientSecret = body.client_secret;
    }

    if (!token) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing token parameter' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Authenticate client
    if (clientId && clientSecret) {
      const client = await OAuthClient.findOne({ clientId });
      if (!client || !(await client.verifySecret(clientSecret))) {
        return NextResponse.json(
          { error: 'invalid_client', error_description: 'Invalid client credentials' },
          { status: 401 }
        );
      }
    }

    // Find token in database
    const tokenDoc = await OAuthAccessToken.findOne({
      $or: [{ accessToken: token }, { refreshToken: token }],
    });

    // If token not found or expired, return inactive
    if (!tokenDoc) {
      return NextResponse.json({ active: false });
    }

    // Check if token is expired
    const now = new Date();
    if (tokenDoc.expiresAt < now) {
      return NextResponse.json({ active: false });
    }

    // Get user information
    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return NextResponse.json({ active: false });
    }

    // Build introspection response
    const isAccessToken = token === tokenDoc.accessToken;
    const response = {
      active: true,
      scope: tokenDoc.scopes.join(' '),
      client_id: tokenDoc.clientId,
      username: user.email,
      token_type: 'Bearer',
      exp: Math.floor(tokenDoc.expiresAt.getTime() / 1000),
      iat: Math.floor(tokenDoc.createdAt.getTime() / 1000),
      sub: tokenDoc.userId,
      // Additional claims
      email: user.email,
      name: user.name,
      account_level: user.accountLevel,
    };

    console.log('[OAuth] Token introspection:', {
      clientId,
      userId: tokenDoc.userId,
      scopes: tokenDoc.scopes,
      isAccessToken,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('[OAuth] Introspection error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to introspect token' },
      { status: 500 }
    );
  }
}
