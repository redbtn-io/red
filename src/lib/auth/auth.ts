/**
 * Auth utilities — powered by redAuth
 * Maintains same export signatures for backward compatibility.
 */

import { NextRequest } from 'next/server';
import { createRedAuth } from 'red-auth';

// Shared redAuth instance for this app
export const auth = createRedAuth({
  mongoUri: process.env.AUTH_MONGODB_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/redbtn',
  jwtSecret: process.env.JWT_SECRET || '',
  appName: 'redbtn',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  cookieName: 'red_session',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  verifyPath: '/api/auth/verify-link',
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY,
  audit: { enabled: true },
});

export interface JWTPayload {
  userId: string;
  email: string;
  accountLevel?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JWTPayload): string {
  return auth.createSession(payload);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  return auth.verifySession(token);
}

/**
 * Extract user from Authorization header, cookie, or internal service header
 */
export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  return auth.getUserFromHeaders({
    authorization: request.headers.get('authorization'),
    cookie: request.headers.get('cookie'),
    'x-user-id': request.headers.get('x-user-id'),
    'x-internal-key': request.headers.get('x-internal-key'),
  });
}

/**
 * Check if the current user is an admin
 */
export function isAdmin(user: JWTPayload | null): boolean {
  return user?.accountLevel === 0;
}

/**
 * Verify authentication and return user or null
 */
export async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
  return getUserFromRequest(request);
}

/**
 * Require admin access or throw error
 */
export function requireAdmin(user: JWTPayload | null): void {
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
}
