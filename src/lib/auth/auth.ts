import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { AccountLevel } from '../database/models/auth/User';

// SECURITY: JWT_SECRET must be set in production - no fallback
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[Auth] FATAL: JWT_SECRET environment variable is not set!');
  // In production, you may want to throw here: throw new Error('JWT_SECRET is required');
}
const JWT_EXPIRY = '7d'; // 7 days

// Internal service key for service-to-service calls (AI library -> webapp)
// Must be set in environment and match between services
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || '';

export interface JWTPayload {
  userId: string;
  email: string;
  accountLevel?: number;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(payload: JWTPayload): string {
  if (!JWT_SECRET) {
    throw new Error('Cannot generate token: JWT_SECRET not configured');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRY,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  if (!JWT_SECRET) {
    console.error('[Auth] Cannot verify token: JWT_SECRET not configured');
    return null;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}

/**
 * Extract user from Authorization header, cookie, or internal service header
 * 
 * Authentication methods (in order of priority):
 * 1. Authorization: Bearer <JWT> header
 * 2. auth_token cookie
 * 3. X-User-Id + X-Internal-Key headers (for internal service-to-service calls)
 *    SECURITY: Requires matching INTERNAL_SERVICE_KEY to prevent spoofing
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

  // For internal service-to-service calls, accept X-User-Id header
  // ONLY if the correct internal service key is provided
  // SECURITY: Uses timing-safe comparison to prevent timing attacks
  const internalUserId = request.headers.get('x-user-id');
  const internalKey = request.headers.get('x-internal-key');
  
  if (internalUserId && internalKey && INTERNAL_SERVICE_KEY) {
    // Use timing-safe comparison to prevent timing attacks
    try {
      const keyBuffer = Buffer.from(internalKey, 'utf8');
      const secretBuffer = Buffer.from(INTERNAL_SERVICE_KEY, 'utf8');
      
      // Must be same length for timingSafeEqual
      if (keyBuffer.length === secretBuffer.length && 
          crypto.timingSafeEqual(keyBuffer, secretBuffer)) {
        return {
          userId: internalUserId,
          email: 'internal@redbtn.io',
          accountLevel: AccountLevel.ADMIN,
        };
      }
    } catch {
      // Comparison failed
    }
    console.warn('[Auth] Invalid internal service key attempted');
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
