import mongoose, { Schema, Model } from 'mongoose';

export interface IAuthCode {
  _id: string;
  email: string;
  token: string; // Secure random token for magic link
  sessionId: string; // Browser session that initiated the request
  used: boolean; // Whether the link has been used
  expiresAt: Date;
  createdAt: Date;
}

const authCodeSchema = new Schema<IAuthCode>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    used: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      required: true
      // Removed index: true - TTL index below handles indexing
    }
  },
  {
    timestamps: true
  }
);

// TTL index to automatically delete expired codes
authCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent model recompilation in Next.js hot reload
const AuthCode: Model<IAuthCode> = 
  mongoose.models.AuthCode || mongoose.model<IAuthCode>('AuthCode', authCodeSchema);

export default AuthCode;
