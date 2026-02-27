import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import User from '@/lib/database/models/auth/User';
import { getUserFromRequest, auth } from '@/lib/auth/auth';

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Look up user in shared redauth DB
    const authUser = await auth.getUserById(userPayload.userId);
    if (!authUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Sync to local DB for app-specific fields
    await connectToDatabase();
    let localUser = await User.findOne({ email: authUser.email });
    if (!localUser) {
      localUser = await User.create({ email: authUser.email, accountLevel: (authUser as unknown as { accountLevel?: number }).accountLevel ?? 3 });
    }

    return NextResponse.json({
      user: {
        id: authUser._id.toString(),
        email: authUser.email,
        name: localUser.name,
        dateOfBirth: localUser.dateOfBirth,
        profileComplete: localUser.profileComplete,
        accountLevel: (authUser as unknown as { accountLevel?: number }).accountLevel ?? localUser.accountLevel,
        defaultGraphId: localUser.defaultGraphId,
        defaultNeuronId: localUser.defaultNeuronId,
        createdAt: localUser.createdAt,
      },
    });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
