import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import OAuthClient from '@/lib/database/models/oauth/OAuthClient';
import { getUserFromRequest, requireAdmin } from '@/lib/auth/auth';
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  validateScopes,
  AVAILABLE_SCOPES,
} from '@/lib/auth/oauth';

/**
 * POST /api/oauth/clients
 * Register a new OAuth client (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    try {
      requireAdmin(user);
    } catch (error) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, redirectUris, scopes, trusted } = body;

    // Validate input
    if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return NextResponse.json(
        { error: 'name and redirectUris are required' },
        { status: 400 }
      );
    }

    // Validate redirect URIs
    for (const uri of redirectUris) {
      try {
        new URL(uri);
      } catch {
        return NextResponse.json(
          { error: `Invalid redirect URI: ${uri}` },
          { status: 400 }
        );
      }
    }

    // Validate scopes
    const requestedScopes = scopes || ['profile', 'email'];
    const availableScopes = Object.keys(AVAILABLE_SCOPES);
    if (!validateScopes(requestedScopes, availableScopes)) {
      return NextResponse.json(
        { error: 'Invalid scopes requested' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Generate credentials
    const clientId = generateClientId();
    const clientSecret = generateClientSecret();
    const hashedSecret = hashClientSecret(clientSecret);

    // Create client
    const client = await OAuthClient.create({
      clientId,
      clientSecret: hashedSecret,
      name,
      description: description || '',
      redirectUris,
      scopes: requestedScopes,
      userId: user!.userId,
      trusted: trusted || false,
    });

    console.log('[OAuth] New client registered:', clientId);

    // Return credentials (client_secret shown only once!)
    return NextResponse.json({
      clientId: client.clientId,
      clientSecret: clientSecret, // Plain text, only shown once
      name: client.name,
      description: client.description,
      redirectUris: client.redirectUris,
      scopes: client.scopes,
      trusted: client.trusted,
      createdAt: client.createdAt,
      warning: 'Save the client_secret securely. It will not be shown again.',
    }, { status: 201 });
  } catch (error) {
    console.error('[OAuth] Client creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/oauth/clients
 * List all OAuth clients
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Admins see all clients, regular users see only their own
    const query = user.accountLevel === 0 ? {} : { userId: user.userId };

    const clients = await OAuthClient.find(query)
      .select('-clientSecret') // Never expose the hashed secret
      .sort({ createdAt: -1 });

    return NextResponse.json({ clients });
  } catch (error) {
    console.error('[OAuth] List clients error:', error);
    return NextResponse.json(
      { error: 'Failed to list clients' },
      { status: 500 }
    );
  }
}
