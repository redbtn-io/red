/**
 * Connection Fetcher Factory
 * 
 * Creates a ConnectionFetcher object for use with graph execution.
 * This provides the database callbacks that the redbtn package needs
 * to fetch user connections during graph execution.
 */

import { UserConnection, ConnectionProvider, type IConnectionProvider } from '../database/models/connections';
import { decryptValue, encryptValue } from './crypto';
import { refreshAccessToken } from './oauth-token';
import type { ConnectionFetcher, UserConnection as RedbtnUserConnection, ConnectionProvider as RedbtnConnectionProvider } from '@redbtn/redbtn';

/**
 * Transform MongoDB document to plain object for redbtn
 */
function toPlainConnection(doc: any): RedbtnUserConnection {
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    _id: plain._id?.toString() || plain._id,
    connectionId: plain.connectionId,
    userId: plain.userId,
    providerId: plain.providerId,
    label: plain.label,
    status: plain.status,
    credentials: plain.credentials,
    tokenMetadata: plain.tokenMetadata,
    accountInfo: plain.accountInfo,
    isDefault: plain.isDefault,
    autoRefresh: plain.autoRefresh,
    lastUsedAt: plain.lastUsedAt,
    lastValidatedAt: plain.lastValidatedAt,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function toPlainProvider(doc: any): RedbtnConnectionProvider {
  const plain = doc.toObject ? doc.toObject() : doc;
  return {
    _id: plain._id?.toString() || plain._id,
    providerId: plain.providerId,
    name: plain.name,
    description: plain.description,
    icon: plain.icon,
    color: plain.color,
    authType: plain.authType,
    apiKeyConfig: plain.apiKeyConfig,
    basicAuthConfig: plain.basicAuthConfig,
    oauth2Config: plain.oauth2Config,
  };
}

/**
 * Create a ConnectionFetcher for a specific user
 * 
 * @param userId - The user ID to fetch connections for
 * @returns ConnectionFetcher object with database callbacks
 */
export function createConnectionFetcher(userId: string): ConnectionFetcher {
  return {
    /**
     * Fetch a connection by its connectionId
     */
    fetchConnection: async (connectionId: string) => {
      try {
        const connection = await UserConnection.findOne({
          connectionId,
          userId,
        }).lean();
        
        if (!connection) {
          return null;
        }
        
        const provider = await ConnectionProvider.findOne({
          providerId: connection.providerId,
        }).lean();
        
        if (!provider) {
          console.warn(`[ConnectionFetcher] Provider not found: ${connection.providerId}`);
          return null;
        }
        
        return {
          connection: toPlainConnection(connection),
          provider: toPlainProvider(provider),
        };
      } catch (error) {
        console.error('[ConnectionFetcher] Error fetching connection:', error);
        return null;
      }
    },
    
    /**
     * Fetch the default connection for a provider
     */
    fetchDefaultConnection: async (providerId: string) => {
      try {
        // First try to find the default connection
        let connection = await UserConnection.findOne({
          userId,
          providerId,
          isDefault: true,
          status: 'active',
        }).lean();
        
        // If no default, find any active connection
        if (!connection) {
          connection = await UserConnection.findOne({
            userId,
            providerId,
            status: 'active',
          }).lean();
        }
        
        if (!connection) {
          return null;
        }
        
        const provider = await ConnectionProvider.findOne({
          providerId,
        }).lean();
        
        if (!provider) {
          console.warn(`[ConnectionFetcher] Provider not found: ${providerId}`);
          return null;
        }
        
        return {
          connection: toPlainConnection(connection),
          provider: toPlainProvider(provider),
        };
      } catch (error) {
        console.error('[ConnectionFetcher] Error fetching default connection:', error);
        return null;
      }
    },
    
    /**
     * Refresh an OAuth connection's access token
     */
    refreshConnection: async (connectionId: string) => {
      try {
        const connection = await UserConnection.findOne({
          connectionId,
          userId,
        });
        
        if (!connection) {
          return null;
        }
        
        // Only OAuth connections can be refreshed
        const provider = await ConnectionProvider.findOne({
          providerId: connection.providerId,
        }).lean<IConnectionProvider>();
        
        if (!provider || provider.authType !== 'oauth2' || !provider.oauth2Config) {
          return null;
        }
        
        // Get refresh token (encrypted in DB)
        const refreshToken = connection.credentials.refreshToken 
          ? decryptValue(connection.credentials.refreshToken)
          : null;
          
        if (!refreshToken) {
          console.warn(`[ConnectionFetcher] No refresh token for connection: ${connectionId}`);
          return null;
        }
        
        // Verify provider has OAuth credentials configured
        // Note: clientId and clientSecret are at root level, not in oauth2Config
        if (!provider.clientId || !provider.clientSecret) {
          console.warn(`[ConnectionFetcher] Missing OAuth credentials for provider: ${provider.providerId}`);
          return null;
        }
        
        // Refresh the token - refreshAccessToken handles credential decryption
        const tokens = await refreshAccessToken({
          provider,
          refreshToken,
        });
        
        // Update the connection with new tokens
        connection.credentials.accessToken = encryptValue(tokens.access_token);
        if (tokens.refresh_token) {
          connection.credentials.refreshToken = encryptValue(tokens.refresh_token);
        }
        
        connection.tokenMetadata = {
          ...connection.tokenMetadata,
          expiresAt: tokens.expires_in 
            ? new Date(Date.now() + tokens.expires_in * 1000)
            : undefined,
          issuedAt: new Date(),
          tokenType: tokens.token_type || 'Bearer',
          scopes: tokens.scope ? tokens.scope.split(' ') : connection.tokenMetadata?.scopes,
        };
        
        connection.status = 'active';
        connection.lastValidatedAt = new Date();
        
        await connection.save();
        
        return toPlainConnection(connection);
      } catch (error) {
        console.error('[ConnectionFetcher] Error refreshing connection:', error);
        
        // Mark connection as expired on refresh failure
        try {
          await UserConnection.updateOne(
            { connectionId, userId },
            { $set: { status: 'expired' } }
          );
        } catch {
          // Ignore update error
        }
        
        return null;
      }
    },
  };
}

export default createConnectionFetcher;
