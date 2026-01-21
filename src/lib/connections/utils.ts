/**
 * Connection Utility Functions
 * 
 * Helper functions for connection management:
 * - ID generation
 * - PKCE support for OAuth
 * - State token generation
 */

import crypto from 'crypto';

/**
 * Generate a unique connection ID
 * Format: conn_<timestamp>_<random>
 */
export function generateConnectionId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `conn_${timestamp}_${random}`;
}

/**
 * Generate a cryptographically secure OAuth state token
 * Used to prevent CSRF attacks during OAuth flow
 */
export function generateOAuthState(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a PKCE code verifier
 * RFC 7636: 43-128 characters from [A-Z, a-z, 0-9, -, ., _, ~]
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generate a PKCE code challenge from a verifier
 * @param verifier - The code verifier
 * @param method - 'S256' (SHA-256) or 'plain'
 */
export function generateCodeChallenge(
  verifier: string, 
  method: 'S256' | 'plain' = 'S256'
): string {
  if (method === 'plain') {
    return verifier;
  }
  
  // S256: base64url(sha256(verifier))
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

/**
 * Build OAuth authorization URL with all parameters
 */
export function buildAuthorizationUrl(params: {
  authorizationUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  extraParams?: Record<string, string>;
}): string {
  const url = new URL(params.authorizationUrl);
  
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope);
  url.searchParams.set('state', params.state);
  
  if (params.codeChallenge) {
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', params.codeChallengeMethod || 'S256');
  }
  
  if (params.extraParams) {
    for (const [key, value] of Object.entries(params.extraParams)) {
      url.searchParams.set(key, value);
    }
  }
  
  return url.toString();
}

/**
 * Get the OAuth callback URL
 */
export function getOAuthCallbackUrl(): string {
  const baseUrl = process.env.OAUTH_CALLBACK_BASE_URL || 
    process.env.NEXT_PUBLIC_APP_URL || 
    'http://localhost:3000';
  return `${baseUrl}/api/v1/connections/oauth/callback`;
}

/**
 * Validate provider ID format
 * Must be lowercase alphanumeric with underscores, 3-50 chars
 */
export function isValidProviderId(providerId: string): boolean {
  return /^[a-z][a-z0-9_]{2,49}$/.test(providerId);
}

/**
 * Sanitize a provider name for use as providerId
 */
export function sanitizeProviderId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50);
}

/**
 * Format a timestamp for display
 */
export function formatConnectionDate(date: Date | undefined): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Check if a token is expiring soon (within buffer time)
 * @param expiresAt - Token expiration date
 * @param bufferMs - Buffer time in milliseconds (default: 5 minutes)
 */
export function isTokenExpiringSoon(
  expiresAt: Date | undefined, 
  bufferMs: number = 5 * 60 * 1000
): boolean {
  if (!expiresAt) return false;
  const now = Date.now();
  const expiryTime = new Date(expiresAt).getTime();
  return expiryTime - now <= bufferMs;
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(expiresAt: Date | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Calculate token expiration date from expires_in seconds
 */
export function calculateTokenExpiry(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Mask a credential for safe display
 * Shows first 4 and last 4 characters
 */
export function maskCredential(value: string): string {
  if (!value || value.length <= 12) {
    return '••••••••••••';
  }
  const first = value.slice(0, 4);
  const last = value.slice(-4);
  return `${first}••••••••${last}`;
}

/**
 * Connection label validation
 */
export function isValidConnectionLabel(label: string): boolean {
  return label.length >= 1 && label.length <= 100;
}

/**
 * Generate a default connection label
 */
export function generateDefaultLabel(
  providerName: string, 
  accountEmail?: string,
  existingCount: number = 0
): string {
  if (accountEmail) {
    return accountEmail;
  }
  if (existingCount === 0) {
    return `${providerName} Account`;
  }
  return `${providerName} Account ${existingCount + 1}`;
}
