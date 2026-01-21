/**
 * Connection models barrel export
 */

export { default as ConnectionProvider } from './ConnectionProvider';
export type {
  IConnectionProvider,
  IConnectionProviderDocument,
  IOAuth2Config,
  IOAuth2Scope,
  IApiKeyConfig,
  IBasicAuthConfig,
  IMultiCredentialConfig,
  IMultiCredentialField,
  ICustomAuthConfig,
  ICustomAuthField,
  IRateLimits,
  AuthType,
  ProviderStatus,
} from './ConnectionProvider';

export { default as UserConnection } from './UserConnection';
export type {
  IUserConnection,
  IUserConnectionDocument,
  IAccountInfo,
  ICredentials,
  ITokenMetadata,
  ConnectionStatus,
} from './UserConnection';
