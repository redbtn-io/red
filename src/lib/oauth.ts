import crypto from 'crypto';

/**
 * Generate a cryptographically secure random string
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('base64url');
}

/**
 * Generate OAuth client ID (format: client_xxxxxxxxxxxx)
 */
export function generateClientId(): string {
  return `client_${generateSecureToken(16)}`;
}

/**
 * Generate OAuth client secret
 */
export function generateClientSecret(): string {
  return generateSecureToken(32);
}

/**
 * Generate OAuth authorization code
 */
export function generateAuthorizationCode(): string {
  return `code_${generateSecureToken(24)}`;
}

/**
 * Generate OAuth access token
 */
export function generateAccessToken(): string {
  return `rbt_${generateSecureToken(32)}`;
}

/**
 * Generate OAuth refresh token
 */
export function generateRefreshToken(): string {
  return `rfsh_${generateSecureToken(32)}`;
}

/**
 * Hash client secret for storage (using bcrypt-style)
 */
export function hashClientSecret(secret: string): string {
  return crypto
    .createHash('sha256')
    .update(secret)
    .digest('hex');
}

/**
 * Verify client secret
 */
export function verifyClientSecret(secret: string, hash: string): boolean {
  const secretHash = hashClientSecret(secret);
  return crypto.timingSafeEqual(
    Buffer.from(secretHash),
    Buffer.from(hash)
  );
}

/**
 * Validate redirect URI
 */
export function isValidRedirectUri(uri: string, allowedUris: string[]): boolean {
  return allowedUris.includes(uri);
}

/**
 * Parse scope string to array
 */
export function parseScopes(scopeString: string | null | undefined): string[] {
  if (!scopeString) return [];
  return scopeString.split(' ').filter(Boolean);
}

/**
 * Validate scopes
 */
export function validateScopes(
  requestedScopes: string[],
  allowedScopes: string[]
): boolean {
  return requestedScopes.every(scope => allowedScopes.includes(scope));
}

/**
 * Available OAuth scopes
 */
export const AVAILABLE_SCOPES = {
  profile: 'Access your profile information',
  email: 'Access your email address',
  chats: 'Access your chat history',
  'chats:write': 'Create and modify chats',
  admin: 'Administrative access (admin users only)',
} as const;

export type OAuthScope = keyof typeof AVAILABLE_SCOPES;

/**
 * Check if user can grant scope
 */
export function canGrantScope(scope: string, userAccountLevel: number): boolean {
  // Admin scope only for admin users
  if (scope === 'admin' && userAccountLevel !== 0) {
    return false;
  }
  return scope in AVAILABLE_SCOPES;
}
