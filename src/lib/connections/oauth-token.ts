/**
 * OAuth Token Exchange Utilities
 * 
 * Handles token operations for OAuth 2.0 providers:
 * - Code exchange for tokens
 * - Token refresh
 * - Token revocation
 */

import type { IConnectionProvider } from '../database/models/connections';
import { decryptValue } from './crypto';

/**
 * Token response from OAuth provider
 */
export interface ITokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
}

/**
 * User info response (OpenID Connect)
 */
export interface IUserInfoResponse {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  [key: string]: unknown;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(params: {
  provider: IConnectionProvider;
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<ITokenResponse> {
  const { provider, code, redirectUri, codeVerifier } = params;
  
  if (!provider.oauth2Config) {
    throw new Error(`Provider ${provider.providerId} is not configured for OAuth 2.0`);
  }
  
  const { tokenUrl, tokenAuthMethod } = provider.oauth2Config;
  
  // Decrypt client credentials
  const clientId = provider.clientId ? decryptValue(provider.clientId) : '';
  const clientSecret = provider.clientSecret ? decryptValue(provider.clientSecret) : '';
  
  if (!clientId || !clientSecret) {
    throw new Error(`Provider ${provider.providerId} is missing OAuth credentials`);
  }
  
  // Build request body
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  
  // Add PKCE verifier if provided
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }
  
  // Build headers based on auth method
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  };
  
  if (tokenAuthMethod === 'client_secret_basic') {
    // Basic auth header
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    // client_secret_post - include in body
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  }
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Token exchange failed: ${response.status}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      // Use status code message
    }
    
    throw new Error(errorMessage);
  }
  
  // Handle different response content types
  const contentType = response.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  
  // GitHub returns application/x-www-form-urlencoded by default
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await response.text();
    const params = new URLSearchParams(text);
    return {
      access_token: params.get('access_token') || '',
      refresh_token: params.get('refresh_token') || undefined,
      token_type: params.get('token_type') || 'bearer',
      scope: params.get('scope') || undefined,
    };
  }
  
  // Try JSON as fallback
  return await response.json();
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(params: {
  provider: IConnectionProvider;
  refreshToken: string;
}): Promise<ITokenResponse> {
  const { provider, refreshToken } = params;
  
  if (!provider.oauth2Config) {
    throw new Error(`Provider ${provider.providerId} is not configured for OAuth 2.0`);
  }
  
  const { tokenUrl, tokenAuthMethod } = provider.oauth2Config;
  
  // Decrypt client credentials
  const clientId = provider.clientId ? decryptValue(provider.clientId) : '';
  const clientSecret = provider.clientSecret ? decryptValue(provider.clientSecret) : '';
  
  if (!clientId || !clientSecret) {
    throw new Error(`Provider ${provider.providerId} is missing OAuth credentials`);
  }
  
  // Build request body
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  
  // Build headers based on auth method
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  };
  
  if (tokenAuthMethod === 'client_secret_basic') {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    body.set('client_id', clientId);
    body.set('client_secret', clientSecret);
  }
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Token refresh failed: ${response.status}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error_description || errorJson.error || errorMessage;
    } catch {
      // Use status code message
    }
    
    throw new Error(errorMessage);
  }
  
  return await response.json();
}

/**
 * Revoke an OAuth token
 */
export async function revokeToken(params: {
  provider: IConnectionProvider;
  token: string;
  tokenTypeHint?: 'access_token' | 'refresh_token';
}): Promise<boolean> {
  const { provider, token, tokenTypeHint } = params;
  
  if (!provider.oauth2Config?.revokeUrl) {
    // Provider doesn't support revocation
    return true;
  }
  
  const { revokeUrl, tokenAuthMethod } = provider.oauth2Config;
  
  // Decrypt client credentials
  const clientId = provider.clientId ? decryptValue(provider.clientId) : '';
  const clientSecret = provider.clientSecret ? decryptValue(provider.clientSecret) : '';
  
  if (!clientId) {
    return false;
  }
  
  // Build request body
  const body = new URLSearchParams({
    token,
  });
  
  if (tokenTypeHint) {
    body.set('token_type_hint', tokenTypeHint);
  }
  
  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  
  if (tokenAuthMethod === 'client_secret_basic' && clientSecret) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${credentials}`;
  } else {
    body.set('client_id', clientId);
    if (clientSecret) {
      body.set('client_secret', clientSecret);
    }
  }
  
  try {
    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
    });
    
    // RFC 7009: Revocation endpoint should return 200 even if token was already invalid
    return response.ok || response.status === 200;
  } catch {
    // Revocation failures are non-critical
    return false;
  }
}

/**
 * Fetch user info from OpenID Connect userinfo endpoint
 */
export async function fetchUserInfo(params: {
  provider: IConnectionProvider;
  accessToken: string;
}): Promise<IUserInfoResponse | null> {
  const { provider, accessToken } = params;
  
  if (!provider.oauth2Config?.userinfoUrl) {
    return null;
  }
  
  try {
    const response = await fetch(provider.oauth2Config.userinfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Test a connection by making a simple API call
 * Returns true if the credentials are valid
 */
export async function testConnection(params: {
  testEndpoint: string;
  testMethod: 'GET' | 'POST';
  testExpectedStatus: number;
  headers: Record<string, string>;
}): Promise<{ valid: boolean; error?: string }> {
  const { testEndpoint, testMethod, testExpectedStatus, headers } = params;
  
  try {
    const response = await fetch(testEndpoint, {
      method: testMethod,
      headers: {
        ...headers,
        'Accept': 'application/json',
      },
    });
    
    if (response.status === testExpectedStatus) {
      return { valid: true };
    }
    
    // Try to get error message
    let error = `Unexpected status: ${response.status}`;
    try {
      const body = await response.json();
      error = body.error?.message || body.message || body.error || error;
    } catch {
      // Ignore JSON parse errors
    }
    
    return { valid: false, error };
  } catch (err) {
    return { 
      valid: false, 
      error: err instanceof Error ? err.message : 'Connection failed' 
    };
  }
}
