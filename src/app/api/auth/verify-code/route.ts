import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AuthCode from '@/lib/models/AuthCode';
import User, { AccountLevel } from '@/lib/models/User';
import { generateToken } from '@/lib/auth';

/**
 * POST /api/auth/verify-code
 * Verify code and create session (login or signup)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find valid auth code
    const authCode = await AuthCode.findOne({
      email: email.toLowerCase(),
      code,
      expiresAt: { $gt: new Date() },
    });

    if (!authCode) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code' },
        { status: 401 }
      );
    }

    // Delete the used code
    await AuthCode.deleteOne({ _id: authCode._id });

    // Find or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    const isNewUser = !user;

    if (!user) {
      user = await User.create({
        email: email.toLowerCase(),
        profileComplete: false,
        agreedToTerms: false,
        accountLevel: AccountLevel.USER, // Use enum value instead of number
      });
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      accountLevel: user.accountLevel,
    });

    console.log('[Auth] User authenticated:', user.email, isNewUser ? '(new)' : '(existing)', `accountLevel: ${user.accountLevel}`);

    // Create response with token in cookie
    const response = NextResponse.json({
      success: true,
      isNewUser,
      profileComplete: user.profileComplete,
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        profileComplete: user.profileComplete,
        accountLevel: user.accountLevel,
      },
    });

    // Set httpOnly cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[Auth] Verify code error:', error);
    return NextResponse.json(
      { error: 'Failed to verify code' },
      { status: 500 }
    );
  }
}
