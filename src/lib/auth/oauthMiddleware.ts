import { NextRequest } from 'next/server';
import connectToDatabase from '../database/mongodb';
import OAuthAccessToken from '../database/models/oauth/OAuthAccessToken';

/**
 * Extract and validate OAuth access token from request
 */
export async function getAccessTokenFromRequest(request: NextRequest): Promise<{
  token: any;
  userId: string;
  clientId: string;
  scopes: string[];
} | null> {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const accessToken = authHeader.slice(7);

    await connectToDatabase();

    // Find and validate access token
    const tokenDoc = await OAuthAccessToken.findOne({ accessToken });
    if (!tokenDoc) {
      return null;
    }

    // Check if token is expired
    const now = new Date();
    if (tokenDoc.expiresAt < now) {
      return null;
    }

    return {
      token: tokenDoc,
      userId: tokenDoc.userId,
      clientId: tokenDoc.clientId,
      scopes: tokenDoc.scopes,
    };
  } catch (error) {
    console.error('[OAuth Middleware] Token validation error:', error);
    return null;
  }
}

/**
 * Check if access token has required scope
 */
export function hasScope(tokenScopes: string[], requiredScope: string): boolean {
  return tokenScopes.includes(requiredScope);
}

/**
 * Check if access token has any of the required scopes
 */
export function hasAnyScope(tokenScopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.some(scope => tokenScopes.includes(scope));
}

/**
 * Check if access token has all required scopes
 */
export function hasAllScopes(tokenScopes: string[], requiredScopes: string[]): boolean {
  return requiredScopes.every(scope => tokenScopes.includes(scope));
}

/**
 * Middleware: Require valid OAuth access token
 */
export async function requireAccessToken(request: NextRequest) {
  const tokenData = await getAccessTokenFromRequest(request);
  if (!tokenData) {
    return {
      error: 'invalid_token',
      status: 401,
      data: null,
    };
  }
  return {
    error: null,
    status: 200,
    data: tokenData,
  };
}

/**
 * Middleware: Require specific OAuth scope
 */
export async function requireScope(request: NextRequest, scope: string) {
  const tokenData = await getAccessTokenFromRequest(request);
  if (!tokenData) {
    return {
      error: 'invalid_token',
      status: 401,
      data: null,
    };
  }

  if (!hasScope(tokenData.scopes, scope)) {
    return {
      error: 'insufficient_scope',
      status: 403,
      data: null,
    };
  }

  return {
    error: null,
    status: 200,
    data: tokenData,
  };
}

/**
 * Middleware: Require any of the specified scopes
 */
export async function requireAnyScope(request: NextRequest, scopes: string[]) {
  const tokenData = await getAccessTokenFromRequest(request);
  if (!tokenData) {
    return {
      error: 'invalid_token',
      status: 401,
      data: null,
    };
  }

  if (!hasAnyScope(tokenData.scopes, scopes)) {
    return {
      error: 'insufficient_scope',
      status: 403,
      data: null,
    };
  }

  return {
    error: null,
    status: 200,
    data: tokenData,
  };
}

/**
 * Middleware: Require all specified scopes
 */
export async function requireAllScopes(request: NextRequest, scopes: string[]) {
  const tokenData = await getAccessTokenFromRequest(request);
  if (!tokenData) {
    return {
      error: 'invalid_token',
      status: 401,
      data: null,
    };
  }

  if (!hasAllScopes(tokenData.scopes, scopes)) {
    return {
      error: 'insufficient_scope',
      status: 403,
      data: null,
    };
  }

  return {
    error: null,
    status: 200,
    data: tokenData,
  };
}
