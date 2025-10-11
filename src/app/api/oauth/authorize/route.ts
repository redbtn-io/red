import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import OAuthClient from '@/lib/models/OAuthClient';
import OAuthAuthorizationCode from '@/lib/models/OAuthAuthorizationCode';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';
import {
  generateAuthorizationCode,
  parseScopes,
  validateScopes,
  isValidRedirectUri,
  canGrantScope,
  AVAILABLE_SCOPES,
} from '@/lib/oauth';

/**
 * GET /api/oauth/authorize
 * OAuth2 authorization endpoint - shows consent screen
 */
export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      // Redirect to login with return URL
      const returnUrl = request.url;
      return NextResponse.redirect(
        new URL(`/?login=true&return=${encodeURIComponent(returnUrl)}`, request.url)
      );
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const redirectUri = searchParams.get('redirect_uri');
    const scope = searchParams.get('scope');
    const state = searchParams.get('state');
    const responseType = searchParams.get('response_type');

    // Validate required parameters
    if (!clientId || !redirectUri || responseType !== 'code') {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing or invalid required parameters' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find OAuth client
    const client = await OAuthClient.findOne({ clientId });
    if (!client) {
      return NextResponse.json(
        { error: 'invalid_client', error_description: 'Client not found' },
        { status: 400 }
      );
    }

    // Validate redirect URI
    if (!isValidRedirectUri(redirectUri, client.redirectUris)) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Invalid redirect_uri' },
        { status: 400 }
      );
    }

    // Parse and validate scopes
    const requestedScopes = parseScopes(scope);
    if (!validateScopes(requestedScopes, client.scopes)) {
      return NextResponse.json(
        { error: 'invalid_scope', error_description: 'One or more scopes are not allowed' },
        { status: 400 }
      );
    }

    // Check if user can grant all scopes
    const user = await User.findById(userPayload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canGrantAll = requestedScopes.every(s => canGrantScope(s, user.accountLevel));
    if (!canGrantAll) {
      return NextResponse.json(
        { error: 'access_denied', error_description: 'User cannot grant one or more requested scopes' },
        { status: 403 }
      );
    }

    // If trusted client, auto-approve
    if (client.trusted) {
      return await autoApprove(clientId, userPayload.userId, redirectUri, requestedScopes, state);
    }

    // Return consent screen data (to be rendered by frontend)
    return NextResponse.json({
      requiresConsent: true,
      client: {
        name: client.name,
        description: client.description,
      },
      scopes: requestedScopes.map(s => ({
        scope: s,
        description: AVAILABLE_SCOPES[s as keyof typeof AVAILABLE_SCOPES] || s,
      })),
      user: {
        name: user.name,
        email: user.email,
      },
      authorizationUrl: `/api/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope || '')}&state=${state || ''}`,
    });
  } catch (error) {
    console.error('[OAuth] Authorization error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/oauth/authorize
 * User grants authorization
 */
export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { client_id, redirect_uri, scope, state, approved } = body;

    if (!approved) {
      // User denied
      const denyUrl = new URL(redirect_uri);
      denyUrl.searchParams.set('error', 'access_denied');
      denyUrl.searchParams.set('error_description', 'User denied authorization');
      if (state) denyUrl.searchParams.set('state', state);

      return NextResponse.json({
        redirect: denyUrl.toString(),
      });
    }

    await connectToDatabase();

    // Verify client
    const client = await OAuthClient.findOne({ clientId: client_id });
    if (!client) {
      return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
    }

    if (!isValidRedirectUri(redirect_uri, client.redirectUris)) {
      return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
    }

    const requestedScopes = parseScopes(scope);

    return await autoApprove(client_id, userPayload.userId, redirect_uri, requestedScopes, state);
  } catch (error) {
    console.error('[OAuth] Authorization grant error:', error);
    return NextResponse.json(
      { error: 'server_error' },
      { status: 500 }
    );
  }
}

/**
 * Auto-approve and generate authorization code
 */
async function autoApprove(
  clientId: string,
  userId: string,
  redirectUri: string,
  scopes: string[],
  state: string | null
) {
  // Generate authorization code
  const code = generateAuthorizationCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Save authorization code
  await OAuthAuthorizationCode.create({
    code,
    clientId,
    userId,
    redirectUri,
    scopes,
    expiresAt,
  });

  // Build redirect URL with code
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) redirectUrl.searchParams.set('state', state);

  console.log('[OAuth] Authorization code granted:', code.substring(0, 10) + '...');

  return NextResponse.json({
    redirect: redirectUrl.toString(),
  });
}
