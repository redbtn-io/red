import mongoose, { Schema, Model } from 'mongoose';

export interface IAuthSession {
  _id: string;
  sessionId: string;
  email: string;
  authenticated: boolean;
  userId?: string;
  isNewUser?: boolean;
  profileComplete?: boolean;
  expiresAt: Date;
  createdAt: Date;
}

const authSessionSchema = new Schema<IAuthSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    authenticated: {
      type: Boolean,
      default: false
    },
    userId: {
      type: String
    },
    isNewUser: {
      type: Boolean
    },
    profileComplete: {
      type: Boolean
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// TTL index to automatically delete expired sessions
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Prevent model recompilation in Next.js hot reload
const AuthSession: Model<IAuthSession> = 
  mongoose.models.AuthSession || mongoose.model<IAuthSession>('AuthSession', authSessionSchema);

export default AuthSession;
