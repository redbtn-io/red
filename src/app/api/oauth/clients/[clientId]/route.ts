import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import OAuthClient from '@/lib/models/OAuthClient';
import OAuthAccessToken from '@/lib/models/OAuthAccessToken';
import { getUserFromRequest } from '@/lib/auth';

/**
 * GET /api/oauth/clients/[clientId]
 * Get a specific OAuth client
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const client = await OAuthClient.findOne({ clientId }).select('-clientSecret');
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Only owner or admin can view
    if (client.userId !== user.userId && user.accountLevel !== 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ client });
  } catch (error) {
    console.error('[OAuth] Get client error:', error);
    return NextResponse.json(
      { error: 'Failed to get client' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/oauth/clients/[clientId]
 * Delete an OAuth client
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const client = await OAuthClient.findOne({ clientId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Only owner or admin can delete
    if (client.userId !== user.userId && user.accountLevel !== 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete client
    await OAuthClient.deleteOne({ clientId });

    // Revoke all tokens for this client
    await OAuthAccessToken.deleteMany({ clientId });

    console.log('[OAuth] Client deleted:', clientId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[OAuth] Delete client error:', error);
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/oauth/clients/[clientId]
 * Update an OAuth client
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, redirectUris, scopes, trusted } = body;

    await connectToDatabase();

    const client = await OAuthClient.findOne({ clientId });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Only owner or admin can update
    if (client.userId !== user.userId && user.accountLevel !== 0) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update fields
    if (name) client.name = name;
    if (description !== undefined) client.description = description;
    if (redirectUris) client.redirectUris = redirectUris;
    if (scopes) client.scopes = scopes;
    if (trusted !== undefined && user.accountLevel === 0) {
      // Only admins can set trusted status
      client.trusted = trusted;
    }

    await client.save();

    console.log('[OAuth] Client updated:', clientId);

    return NextResponse.json({
      client: {
        clientId: client.clientId,
        name: client.name,
        description: client.description,
        redirectUris: client.redirectUris,
        scopes: client.scopes,
        trusted: client.trusted,
        updatedAt: client.updatedAt,
      },
    });
  } catch (error) {
    console.error('[OAuth] Update client error:', error);
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    );
  }
}
