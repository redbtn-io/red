/**
 * Connections Library
 * 
 * Utilities for managing third-party service connections:
 * - Credential encryption/decryption
 * - OAuth flow management
 * - Token operations
 */

// Crypto utilities
export {
  encryptValue,
  decryptValue,
  isEncrypted,
  encryptCredentials,
  decryptCredentials,
  buildBasicAuthHeader,
  parseHeaderFormat,
} from './crypto';

// Connection utilities
export {
  generateConnectionId,
  generateOAuthState,
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthorizationUrl,
  getOAuthCallbackUrl,
  isValidProviderId,
  sanitizeProviderId,
  formatConnectionDate,
  isTokenExpiringSoon,
  isTokenExpired,
  calculateTokenExpiry,
  maskCredential,
  isValidConnectionLabel,
  generateDefaultLabel,
} from './utils';

// OAuth state management
export {
  createOAuthState,
  getOAuthState,
  deleteOAuthState,
  consumeOAuthState,
  closeOAuthStateConnection,
  type IOAuthStateData,
} from './oauth-state';

// OAuth token operations
export {
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
  fetchUserInfo,
  testConnection,
  type ITokenResponse,
  type IUserInfoResponse,
} from './oauth-token';

// Connection fetcher for graph execution
export {
  createConnectionFetcher,
} from './connection-fetcher';
