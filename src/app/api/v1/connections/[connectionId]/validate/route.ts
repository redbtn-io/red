/**
 * Connection Validation API
 * 
 * POST /api/v1/connections/[connectionId]/validate
 * 
 * Tests that a connection's credentials are still valid.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { 
  ConnectionProvider, 
  UserConnection,
  type IConnectionProvider,
} from '@/lib/database/models/connections';
import {
  testConnection,
  decryptCredentials,
  buildBasicAuthHeader,
  parseHeaderFormat,
  refreshAccessToken,
  encryptCredentials,
  calculateTokenExpiry,
  isTokenExpired,
} from '@/lib/connections';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{
    connectionId: string;
  }>;
}

/**
 * POST - Validate connection
 * 
 * For OAuth: checks if token is valid, refreshes if expired
 * For API Key/Basic: calls test endpoint
 */
export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectionId } = await context.params;

  try {
    await connectToDatabase();

    const connection = await UserConnection.findOne({
      connectionId,
      userId: user.userId,
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Get provider
    const provider = await ConnectionProvider.findOne({
      providerId: connection.providerId,
    }).lean<IConnectionProvider>();

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Decrypt credentials
    const credentials = decryptCredentials(connection.credentials);

    let valid = false;
    let error: string | undefined;
    let refreshed = false;

    switch (provider.authType) {
      case 'oauth2': {
        // Check if token is expired
        if (connection.tokenMetadata?.expiresAt && 
            isTokenExpired(connection.tokenMetadata.expiresAt)) {
          // Try to refresh
          if (credentials.refreshToken) {
            try {
              const tokenResponse = await refreshAccessToken({
                provider,
                refreshToken: credentials.refreshToken,
              });

              // Update credentials
              const newCredentials = encryptCredentials({
                accessToken: tokenResponse.access_token,
                refreshToken: tokenResponse.refresh_token || credentials.refreshToken,
                idToken: tokenResponse.id_token,
              });

              connection.credentials = newCredentials;
              connection.tokenMetadata = {
                ...connection.tokenMetadata,
                expiresAt: tokenResponse.expires_in 
                  ? calculateTokenExpiry(tokenResponse.expires_in)
                  : undefined,
                issuedAt: new Date(),
              };
              connection.lastRefreshedAt = new Date();
              connection.status = 'active';
              connection.errorCount = 0;
              
              valid = true;
              refreshed = true;
            } catch (refreshError) {
              error = refreshError instanceof Error 
                ? refreshError.message 
                : 'Token refresh failed';
              connection.status = 'expired';
              connection.lastError = error;
              connection.errorCount += 1;
            }
          } else {
            error = 'Token expired and no refresh token available';
            connection.status = 'expired';
            connection.lastError = error;
          }
        } else {
          // Token not expired, assume valid
          // A more thorough check would call the userinfo endpoint
          valid = true;
        }
        break;
      }

      case 'api_key': {
        if (provider.apiKeyConfig?.testEndpoint) {
          const headerValue = parseHeaderFormat(
            provider.apiKeyConfig.headerFormat,
            { key: credentials.apiKey || '' }
          );

          const result = await testConnection({
            testEndpoint: provider.apiKeyConfig.testEndpoint,
            testMethod: provider.apiKeyConfig.testMethod || 'GET',
            testExpectedStatus: provider.apiKeyConfig.testExpectedStatus || 200,
            headers: { [provider.apiKeyConfig.headerName]: headerValue },
          });

          valid = result.valid;
          error = result.error;
        } else {
          // No test endpoint, assume valid
          valid = true;
        }
        break;
      }

      case 'basic': {
        if (provider.basicAuthConfig?.testEndpoint) {
          let headers: Record<string, string>;
          
          if (provider.basicAuthConfig.headerFormat === 'basic') {
            headers = { 
              'Authorization': buildBasicAuthHeader(
                credentials.username || '', 
                credentials.password || ''
              ) 
            };
          } else if (provider.basicAuthConfig.customHeaderFormat) {
            const headerValue = parseHeaderFormat(
              provider.basicAuthConfig.customHeaderFormat,
              { 
                username: credentials.username || '', 
                password: credentials.password || '' 
              }
            );
            headers = { 
              [provider.basicAuthConfig.customHeaderName || 'Authorization']: headerValue 
            };
          } else {
            headers = { 
              'Authorization': buildBasicAuthHeader(
                credentials.username || '', 
                credentials.password || ''
              ) 
            };
          }

          const result = await testConnection({
            testEndpoint: provider.basicAuthConfig.testEndpoint,
            testMethod: provider.basicAuthConfig.testMethod || 'GET',
            testExpectedStatus: provider.basicAuthConfig.testExpectedStatus || 200,
            headers,
          });

          valid = result.valid;
          error = result.error;
        } else {
          valid = true;
        }
        break;
      }

      case 'multi_credential': {
        if (provider.multiCredentialConfig?.testEndpoint) {
          const multiCreds = credentials.multiCredentials || {};
          const headerValue = parseHeaderFormat(
            provider.multiCredentialConfig.headerBuilder,
            multiCreds
          );

          const result = await testConnection({
            testEndpoint: provider.multiCredentialConfig.testEndpoint,
            testMethod: provider.multiCredentialConfig.testMethod || 'GET',
            testExpectedStatus: provider.multiCredentialConfig.testExpectedStatus || 200,
            headers: { 'Authorization': headerValue },
          });

          valid = result.valid;
          error = result.error;
        } else {
          valid = true;
        }
        break;
      }

      default:
        valid = true;
    }

    // Update connection status
    if (valid) {
      connection.status = 'active';
      connection.lastValidatedAt = new Date();
      connection.lastError = undefined;
      connection.errorCount = 0;
    } else {
      connection.status = 'error';
      connection.lastError = error;
      connection.errorCount += 1;
    }

    await connection.save();

    return NextResponse.json({
      valid,
      status: connection.status,
      error,
      refreshed,
      lastValidatedAt: connection.lastValidatedAt,
    });
  } catch (err) {
    console.error('[Connection Validate] Error:', err);
    return NextResponse.json(
      { error: 'Failed to validate connection' },
      { status: 500 }
    );
  }
}
