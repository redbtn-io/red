/**
 * UserConnection Model
 * 
 * Stores user's connected accounts for third-party services.
 * All credentials are encrypted at rest using AES-256-GCM.
 * 
 * Collection name: userconnections
 */

import mongoose, { Schema, Model, Document } from 'mongoose';

// ============================================================================
// Type Definitions
// ============================================================================

export interface IAccountInfo {
  email?: string;
  name?: string;
  avatar?: string;
  providerUserId?: string;
  providerAccountId?: string;
  metadata?: Record<string, string>;
}

export interface ICredentials {
  // OAuth 2.0
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  
  // API Key
  apiKey?: string;
  
  // Basic Auth
  username?: string;
  password?: string;
  
  // Multi-credential
  multiCredentials?: Record<string, string>;
  
  // Custom auth
  customCredentials?: Record<string, string>;
}

export interface ITokenMetadata {
  expiresAt?: Date;
  issuedAt?: Date;
  scopes?: string[];
  tokenType?: string;
  refreshExpiresAt?: Date;
}

export type ConnectionStatus = 'active' | 'expired' | 'revoked' | 'error' | 'pending';

export interface IUserConnection {
  _id: string;
  connectionId: string;
  userId: string;
  providerId: string;
  
  label: string;
  
  accountInfo?: IAccountInfo;
  credentials: ICredentials;
  tokenMetadata?: ITokenMetadata;
  
  status: ConnectionStatus;
  lastUsedAt?: Date;
  lastValidatedAt?: Date;
  lastRefreshedAt?: Date;
  lastError?: string;
  errorCount: number;
  usageCount: number;
  
  isDefault: boolean;
  autoRefresh: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserConnectionDocument extends Omit<IUserConnection, '_id'>, Document {}

// ============================================================================
// Sub-Schemas
// ============================================================================

const AccountInfoSchema = new Schema<IAccountInfo>({
  email: { type: String, trim: true },
  name: { type: String, trim: true },
  avatar: { type: String },
  providerUserId: { type: String },
  providerAccountId: { type: String },
  metadata: { type: Map, of: String },
}, { _id: false });

const CredentialsSchema = new Schema<ICredentials>({
  // OAuth 2.0
  accessToken: { type: String },
  refreshToken: { type: String },
  idToken: { type: String },
  
  // API Key
  apiKey: { type: String },
  
  // Basic Auth
  username: { type: String },
  password: { type: String },
  
  // Multi-credential
  multiCredentials: { type: Map, of: String },
  
  // Custom auth
  customCredentials: { type: Map, of: String },
}, { _id: false });

const TokenMetadataSchema = new Schema<ITokenMetadata>({
  expiresAt: { type: Date },
  issuedAt: { type: Date },
  scopes: { type: [String] },
  tokenType: { type: String, default: 'Bearer' },
  refreshExpiresAt: { type: Date },
}, { _id: false });

// ============================================================================
// Main Schema
// ============================================================================

const UserConnectionSchema = new Schema<IUserConnectionDocument>(
  {
    connectionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    providerId: {
      type: String,
      required: true,
      index: true,
    },
    
    label: {
      type: String,
      required: true,
      trim: true,
    },
    
    accountInfo: { type: AccountInfoSchema },
    credentials: { 
      type: CredentialsSchema,
      required: true,
    },
    tokenMetadata: { type: TokenMetadataSchema },
    
    status: {
      type: String,
      enum: ['active', 'expired', 'revoked', 'error', 'pending'],
      default: 'active',
      index: true,
    },
    lastUsedAt: { type: Date },
    lastValidatedAt: { type: Date },
    lastRefreshedAt: { type: Date },
    lastError: { type: String },
    errorCount: {
      type: Number,
      default: 0,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    
    isDefault: {
      type: Boolean,
      default: false,
    },
    autoRefresh: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'userconnections',
  }
);

// ============================================================================
// Indexes
// ============================================================================

// User's connections by provider
UserConnectionSchema.index({ userId: 1, providerId: 1 });

// User's connections by status
UserConnectionSchema.index({ userId: 1, status: 1 });

// For token refresh worker - find expiring tokens
UserConnectionSchema.index(
  { 'tokenMetadata.expiresAt': 1 },
  { 
    sparse: true,
    partialFilterExpression: { 
      status: 'active',
      autoRefresh: true,
      'tokenMetadata.expiresAt': { $exists: true }
    }
  }
);

// Ensure only one default per user per provider
UserConnectionSchema.index(
  { userId: 1, providerId: 1, isDefault: 1 },
  { 
    unique: true,
    partialFilterExpression: { isDefault: true }
  }
);

// ============================================================================
// Middleware
// ============================================================================

// Pre-save: ensure only one default connection per provider
UserConnectionSchema.pre('save', async function() {
  if (this.isDefault && this.isModified('isDefault')) {
    // Remove default flag from other connections for same provider
    await mongoose.model('UserConnection').updateMany(
      {
        userId: this.userId,
        providerId: this.providerId,
        connectionId: { $ne: this.connectionId },
        isDefault: true,
      },
      { $set: { isDefault: false } }
    );
  }
});

// ============================================================================
// Model Export
// ============================================================================

type UserConnectionModel = Model<IUserConnectionDocument>;

const UserConnection: UserConnectionModel =
  (mongoose.models.UserConnection as UserConnectionModel) ||
  mongoose.model<IUserConnectionDocument>('UserConnection', UserConnectionSchema);

export default UserConnection;
