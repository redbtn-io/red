/**
 * ConnectionProvider Model
 * 
 * Defines third-party service providers that users can connect to.
 * Supports OAuth 2.0, API Key, Basic Auth, and custom auth types.
 * 
 * System providers are created via seed script.
 * Users can create custom API key providers.
 * 
 * Collection name: connectionproviders
 */

import mongoose, { Schema, Model, Document } from 'mongoose';

// ============================================================================
// Type Definitions
// ============================================================================

export interface IOAuth2Scope {
  name: string;
  description: string;
  required?: boolean;
  default?: boolean;
}

export interface IOAuth2Config {
  authorizationUrl: string;
  tokenUrl: string;
  revokeUrl?: string;
  userinfoUrl?: string;
  tokenAuthMethod: 'client_secret_basic' | 'client_secret_post';
  pkceRequired: boolean;
  pkceMethod?: 'S256' | 'plain';
  scopes: IOAuth2Scope[];
  extraAuthParams?: Record<string, string>;
  refreshTokenRotates?: boolean;
  defaultTokenLifetime?: number;
}

export interface IApiKeyConfig {
  headerName: string;
  headerFormat: string;
  keyLabel?: string;
  instructions: string;
  testEndpoint?: string;
  testMethod?: 'GET' | 'POST';
  testExpectedStatus?: number;
}

export interface IBasicAuthConfig {
  usernameLabel: string;
  passwordLabel: string;
  instructions: string;
  headerFormat: 'basic' | 'custom';
  customHeaderName?: string;
  customHeaderFormat?: string;
  testEndpoint?: string;
  testMethod?: 'GET' | 'POST';
  testExpectedStatus?: number;
}

export interface IMultiCredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface IMultiCredentialConfig {
  credentials: IMultiCredentialField[];
  instructions: string;
  headerBuilder: string;
  testEndpoint?: string;
  testMethod?: 'GET' | 'POST';
  testExpectedStatus?: number;
}

export interface ICustomAuthField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  required: boolean;
  options?: string[];
}

export interface ICustomAuthConfig {
  type: string;
  instructions: string;
  fields: ICustomAuthField[];
}

export interface IRateLimits {
  requestsPerMinute?: number;
  requestsPerDay?: number;
  notes?: string;
}

export type AuthType = 'oauth2' | 'oauth1' | 'api_key' | 'basic' | 'multi_credential' | 'custom';
export type ProviderStatus = 'active' | 'beta' | 'coming_soon' | 'deprecated' | 'disabled';

export interface IConnectionProvider {
  _id: string;
  providerId: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  category: string;
  website?: string;
  docsUrl?: string;
  
  authType: AuthType;
  
  oauth2Config?: IOAuth2Config;
  apiKeyConfig?: IApiKeyConfig;
  basicAuthConfig?: IBasicAuthConfig;
  multiCredentialConfig?: IMultiCredentialConfig;
  customAuthConfig?: ICustomAuthConfig;
  
  // App credentials (encrypted) - for OAuth providers
  clientId?: string;
  clientSecret?: string;
  
  // Metadata
  capabilities: string[];
  mcpToolIds?: string[];
  tags: string[];
  status: ProviderStatus;
  tier: number;
  isSystem: boolean;
  allowUserCustomization: boolean;
  createdBy?: string;
  
  rateLimits?: IRateLimits;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IConnectionProviderDocument extends Omit<IConnectionProvider, '_id'>, Document {}

// ============================================================================
// Sub-Schemas
// ============================================================================

const OAuth2ScopeSchema = new Schema<IOAuth2Scope>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  required: { type: Boolean, default: false },
  default: { type: Boolean, default: false },
}, { _id: false });

const OAuth2ConfigSchema = new Schema<IOAuth2Config>({
  authorizationUrl: { type: String, required: true },
  tokenUrl: { type: String, required: true },
  revokeUrl: { type: String },
  userinfoUrl: { type: String },
  tokenAuthMethod: { 
    type: String, 
    enum: ['client_secret_basic', 'client_secret_post'],
    default: 'client_secret_post'
  },
  pkceRequired: { type: Boolean, default: false },
  pkceMethod: { type: String, enum: ['S256', 'plain'] },
  scopes: { type: [OAuth2ScopeSchema], default: [] },
  extraAuthParams: { type: Map, of: String },
  refreshTokenRotates: { type: Boolean, default: false },
  defaultTokenLifetime: { type: Number },
}, { _id: false });

const ApiKeyConfigSchema = new Schema<IApiKeyConfig>({
  headerName: { type: String, required: true },
  headerFormat: { type: String, required: true },
  keyLabel: { type: String, default: 'API Key' },
  instructions: { type: String, required: true },
  testEndpoint: { type: String },
  testMethod: { type: String, enum: ['GET', 'POST'] },
  testExpectedStatus: { type: Number },
}, { _id: false });

const BasicAuthConfigSchema = new Schema<IBasicAuthConfig>({
  usernameLabel: { type: String, required: true },
  passwordLabel: { type: String, required: true },
  instructions: { type: String, required: true },
  headerFormat: { type: String, enum: ['basic', 'custom'], default: 'basic' },
  customHeaderName: { type: String },
  customHeaderFormat: { type: String },
  testEndpoint: { type: String },
  testMethod: { type: String, enum: ['GET', 'POST'] },
  testExpectedStatus: { type: Number },
}, { _id: false });

const MultiCredentialFieldSchema = new Schema<IMultiCredentialField>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'password'], required: true },
  required: { type: Boolean, default: true },
  placeholder: { type: String },
  helpText: { type: String },
}, { _id: false });

const MultiCredentialConfigSchema = new Schema<IMultiCredentialConfig>({
  credentials: { type: [MultiCredentialFieldSchema], required: true },
  instructions: { type: String, required: true },
  headerBuilder: { type: String, required: true },
  testEndpoint: { type: String },
  testMethod: { type: String, enum: ['GET', 'POST'] },
  testExpectedStatus: { type: Number },
}, { _id: false });

const CustomAuthFieldSchema = new Schema<ICustomAuthField>({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'password', 'url', 'select'], required: true },
  required: { type: Boolean, default: true },
  options: { type: [String] },
}, { _id: false });

const CustomAuthConfigSchema = new Schema<ICustomAuthConfig>({
  type: { type: String, required: true },
  instructions: { type: String, required: true },
  fields: { type: [CustomAuthFieldSchema], required: true },
}, { _id: false });

const RateLimitsSchema = new Schema<IRateLimits>({
  requestsPerMinute: { type: Number },
  requestsPerDay: { type: Number },
  notes: { type: String },
}, { _id: false });

// ============================================================================
// Main Schema
// ============================================================================

const ConnectionProviderSchema = new Schema<IConnectionProviderDocument>(
  {
    providerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    website: {
      type: String,
      trim: true,
    },
    docsUrl: {
      type: String,
      trim: true,
    },
    
    authType: {
      type: String,
      required: true,
      enum: ['oauth2', 'oauth1', 'api_key', 'basic', 'multi_credential', 'custom'],
      index: true,
    },
    
    oauth2Config: { type: OAuth2ConfigSchema },
    apiKeyConfig: { type: ApiKeyConfigSchema },
    basicAuthConfig: { type: BasicAuthConfigSchema },
    multiCredentialConfig: { type: MultiCredentialConfigSchema },
    customAuthConfig: { type: CustomAuthConfigSchema },
    
    clientId: { type: String },
    clientSecret: { type: String },
    
    capabilities: {
      type: [String],
      default: [],
      index: true,
    },
    mcpToolIds: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'beta', 'deprecated', 'disabled'],
      default: 'active',
      index: true,
    },
    tier: {
      type: Number,
      default: 0,
      index: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    allowUserCustomization: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: String,
      index: true,
    },
    
    rateLimits: { type: RateLimitsSchema },
  },
  {
    timestamps: true,
    collection: 'connectionproviders',
  }
);

// ============================================================================
// Indexes
// ============================================================================

// Compound indexes for common queries
ConnectionProviderSchema.index({ status: 1, tier: 1 });
ConnectionProviderSchema.index({ isSystem: 1, status: 1 });
ConnectionProviderSchema.index({ category: 1, status: 1 });

// ============================================================================
// Model Export
// ============================================================================

type ConnectionProviderModel = Model<IConnectionProviderDocument>;

const ConnectionProvider: ConnectionProviderModel =
  (mongoose.models.ConnectionProvider as ConnectionProviderModel) ||
  mongoose.model<IConnectionProviderDocument>('ConnectionProvider', ConnectionProviderSchema);

export default ConnectionProvider;
