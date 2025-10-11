import mongoose, { Schema, Model } from 'mongoose';

// Account levels
export enum AccountLevel {
  ADMIN = 0,      // Administrator with full access
  USER = 1,       // Regular user (default)
  // Future levels can be added here:
  // PREMIUM = 2,
  // ENTERPRISE = 3,
}

export interface IUser {
  _id: string;
  email: string;
  name?: string;
  dateOfBirth?: Date;
  agreedToTerms: boolean;
  profileComplete: boolean;
  accountLevel: AccountLevel;
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
      default: AccountLevel.USER,
      enum: [AccountLevel.ADMIN, AccountLevel.USER], // Use actual enum values, not Object.values
      index: true
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
  return this.accountLevel === AccountLevel.USER;
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
