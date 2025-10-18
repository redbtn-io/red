import mongoose, { Schema, Model } from 'mongoose';

export interface IOAuthClient {
  _id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  description?: string;
  redirectUris: string[];
  scopes: string[];
  userId: string; // Owner of the OAuth client
  trusted: boolean; // Skip consent screen if true
  createdAt: Date;
  updatedAt: Date;
}

// Instance methods
interface IOAuthClientMethods {
  verifySecret(secret: string): boolean;
}

// Model type with instance methods
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type OAuthClientModel = Model<IOAuthClient, {}, IOAuthClientMethods>;

const oauthClientSchema = new Schema<IOAuthClient, OAuthClientModel, IOAuthClientMethods>(
  {
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    clientSecret: {
      type: String,
      required: true,
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
    redirectUris: {
      type: [String],
      required: true,
      validate: {
        validator: (uris: string[]) => uris.length > 0,
        message: 'At least one redirect URI is required',
      },
    },
    scopes: {
      type: [String],
      default: ['profile', 'email'],
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    trusted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Instance method: verify client secret
oauthClientSchema.methods.verifySecret = function (secret: string): boolean {
  return this.clientSecret === secret;
};

// Prevent model recompilation in Next.js hot reload
const OAuthClient: OAuthClientModel =
  (mongoose.models.OAuthClient as OAuthClientModel) || 
  mongoose.model<IOAuthClient, OAuthClientModel>('OAuthClient', oauthClientSchema);

export default OAuthClient;
