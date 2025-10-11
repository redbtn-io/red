import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import User from '@/lib/models/User';
import { getUserFromRequest } from '@/lib/auth';

/**
 * POST /api/auth/complete-profile
 * Complete user profile (for new users)
 */
export async function POST(request: NextRequest) {
  try {
    const userPayload = getUserFromRequest(request);
    if (!userPayload) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, dateOfBirth, agreedToTerms } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!dateOfBirth) {
      return NextResponse.json(
        { error: 'Date of birth is required' },
        { status: 400 }
      );
    }

    if (!agreedToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the terms and conditions' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Update user profile
    const user = await User.findByIdAndUpdate(
      userPayload.userId,
      {
        name: name.trim(),
        dateOfBirth: new Date(dateOfBirth),
        agreedToTerms: true,
        profileComplete: true,
      },
      { new: true }
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('[Auth] Profile completed for:', user.email);

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        dateOfBirth: user.dateOfBirth,
        profileComplete: user.profileComplete,
        accountLevel: user.accountLevel,
      },
    });
  } catch (error) {
    console.error('[Auth] Complete profile error:', error);
    return NextResponse.json(
      { error: 'Failed to complete profile' },
      { status: 500 }
    );
  }
}
