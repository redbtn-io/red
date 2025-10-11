import mongoose, { Schema, Model } from 'mongoose';

export interface IOAuthAuthorizationCode {
  _id: string;
  code: string;
  clientId: string;
  userId: string;
  redirectUri: string;
  scopes: string[];
  expiresAt: Date;
  createdAt: Date;
}

const oauthAuthorizationCodeSchema = new Schema<IOAuthAuthorizationCode>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
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
    redirectUri: {
      type: String,
      required: true,
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
  },
  {
    timestamps: true,
  }
);

// TTL index to automatically delete expired codes
oauthAuthorizationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent model recompilation in Next.js hot reload
const OAuthAuthorizationCode: Model<IOAuthAuthorizationCode> =
  mongoose.models.OAuthAuthorizationCode ||
  mongoose.model<IOAuthAuthorizationCode>('OAuthAuthorizationCode', oauthAuthorizationCodeSchema);

export default OAuthAuthorizationCode;
