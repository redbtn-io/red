import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import User from '@/lib/database/models/auth/User';
import { getUserFromRequest } from '@/lib/auth/auth';

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

    await connectToDatabase();

    const user = await User.findById(userPayload.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        profileComplete: user.profileComplete,
        accountLevel: user.accountLevel,
        defaultGraphId: user.defaultGraphId,
        defaultNeuronId: user.defaultNeuronId,
        createdAt: user.createdAt,
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
