import mongoose, { Schema, Model } from 'mongoose';

export interface IOAuthAccessToken {
  _id: string;
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  userId: string;
  scopes: string[];
  expiresAt: Date;
  refreshExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const oauthAccessTokenSchema = new Schema<IOAuthAccessToken>(
  {
    accessToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    refreshToken: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    scopes: {
      type: [String],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true
      // Removed index: true - TTL index below handles indexing
    },
    refreshExpiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired tokens
oauthAccessTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent model recompilation in Next.js hot reload
const OAuthAccessToken: Model<IOAuthAccessToken> =
  mongoose.models.OAuthAccessToken ||
  mongoose.model<IOAuthAccessToken>('OAuthAccessToken', oauthAccessTokenSchema);

export default OAuthAccessToken;
