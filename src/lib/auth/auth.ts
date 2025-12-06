import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { AccountLevel } from '../database/models/auth/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
console.log('[Auth] JWT_SECRET used:', JWT_SECRET);
const JWT_EXPIRY = '7d'; // 7 days

export interface JWTPayload {
  userId: string;
  email: string;
  accountLevel?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  console.log('[Auth] Verifying token with secret:', JWT_SECRET);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}

/**
 * Extract user from Authorization header or cookie
 */
export function getUserFromRequest(request: NextRequest): JWTPayload | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return verifyToken(token);
  }

  // Try cookie
  const token = request.cookies.get('auth_token')?.value;
  if (token) {
    return verifyToken(token);
  }

  return null;
}

/**
 * Check if the current user is an admin
 */
export function isAdmin(user: JWTPayload | null): boolean {
  return user?.accountLevel === AccountLevel.ADMIN;
}

/**
 * Verify authentication and return user or null
 * Use this for API routes that require authentication
 */
export async function verifyAuth(request: NextRequest): Promise<JWTPayload | null> {
  return getUserFromRequest(request);
}

/**
 * Require admin access or throw 403 error
 */
export function requireAdmin(user: JWTPayload | null): void {
  if (!user) {
    throw new Error('Unauthorized');
  }
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
}
