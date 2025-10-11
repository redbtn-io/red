import { NextRequest, NextResponse } from 'next/server';
import { requireScope } from '@/lib/auth/oauthMiddleware';

/**
 * GET /api/protected/example
 * Example protected endpoint that requires OAuth 'read' scope
 * 
 * This demonstrates how to protect API endpoints with OAuth scopes.
 * Third-party apps with valid access tokens can call this endpoint.
 */
export async function GET(request: NextRequest) {
  // Require 'read' scope
  const auth = await requireScope(request, 'read');
  
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error, error_description: 'Access denied' },
      { status: auth.status }
    );
  }

  // Access granted - return protected data
  return NextResponse.json({
    message: 'This is protected data',
    userId: auth.data!.userId,
    clientId: auth.data!.clientId,
    scopes: auth.data!.scopes,
    timestamp: new Date().toISOString(),
  });
}

/**
 * POST /api/protected/example
 * Example protected endpoint that requires OAuth 'write' scope
 */
export async function POST(request: NextRequest) {
  // Require 'write' scope
  const auth = await requireScope(request, 'write');
  
  if (auth.error) {
    return NextResponse.json(
      { error: auth.error, error_description: 'Access denied' },
      { status: auth.status }
    );
  }

  const body = await request.json();

  // Access granted - perform write operation
  return NextResponse.json({
    message: 'Data written successfully',
    userId: auth.data!.userId,
    clientId: auth.data!.clientId,
    data: body,
    timestamp: new Date().toISOString(),
  });
}
