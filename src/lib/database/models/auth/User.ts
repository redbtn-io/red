import mongoose, { Schema, Model } from 'mongoose';

// Account levels
export enum AccountLevel {
  ADMIN = 0,       // System administrator with full access
  ENTERPRISE = 1,  // Existing "USER" level - dedicated features
  PRO = 2,         // Shared instance, complex nodes, priority
  BASIC = 3,       // Shared instance, custom neurons
  FREE = 4,        // Shared instance, default neurons only (new user default)
}

// Backward compatibility alias
export const USER = AccountLevel.ENTERPRISE;

export interface IUser {
  _id: string;
  email: string;
  name?: string;
  dateOfBirth?: Date;
  agreedToTerms: boolean;
  profileComplete: boolean;
  accountLevel: AccountLevel;
  defaultNeuronId?: string;        // User's default neuron for chat
  defaultWorkerNeuronId?: string;  // User's default neuron for workers
  defaultGraphId?: string;         // User's default graph configuration (Phase 1)
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      trim: true
    },
    dateOfBirth: {
      type: Date
    },
    agreedToTerms: {
      type: Boolean,
      default: false
    },
    profileComplete: {
      type: Boolean,
      default: false
    },
    accountLevel: {
      type: Number,
      default: AccountLevel.FREE, // New users default to FREE tier
      enum: [
        AccountLevel.ADMIN,
        AccountLevel.ENTERPRISE,
        AccountLevel.PRO,
        AccountLevel.BASIC,
        AccountLevel.FREE
      ],
      index: true
    },
    defaultNeuronId: {
      type: String,
      default: 'red-neuron' // Primary default neuron
    },
    defaultWorkerNeuronId: {
      type: String,
      default: 'red-neuron' // Same default for workers
    },
    defaultGraphId: {
      type: String,
      default: 'red-graph-default' // Default three-tier graph (Phase 1)
    }
  },
  {
    timestamps: true
  }
);

// Helper methods for account level checks
userSchema.methods.isAdmin = function(): boolean {
  return this.accountLevel === AccountLevel.ADMIN;
};

userSchema.methods.isRegularUser = function(): boolean {
  return this.accountLevel === AccountLevel.ENTERPRISE;
};

// Static method to check if user is admin
userSchema.statics.isUserAdmin = async function(userId: string): Promise<boolean> {
  const user = await this.findById(userId);
  return user?.accountLevel === AccountLevel.ADMIN;
};

// Prevent model recompilation in Next.js hot reload
const User: Model<IUser> = 
  mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
