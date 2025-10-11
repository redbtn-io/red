import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import AuthSession from '@/lib/database/models/auth/AuthSession';
import User from '@/lib/database/models/auth/User';
import { generateToken } from '@/lib/auth/auth';

/**
 * POST /api/auth/check-session
 * Check if a session has been authenticated via magic link
 * Frontend polls this endpoint after sending magic link
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Find the auth session
    const authSession = await AuthSession.findOne({ sessionId });

    if (!authSession) {
      return NextResponse.json({
        authenticated: false,
        message: 'Session not found',
      });
    }

    // Check if session has expired
    if (authSession.expiresAt < new Date()) {
      return NextResponse.json({
        authenticated: false,
        expired: true,
        message: 'Session expired',
      });
    }

    // Check if session has been authenticated
    if (!authSession.authenticated) {
      return NextResponse.json({
        authenticated: false,
        message: 'Waiting for magic link verification',
      });
    }

    // Session is authenticated! Get user and create JWT
    const user = await User.findById(authSession.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      accountLevel: user.accountLevel,
    });

    console.log('[Auth] Session authenticated via magic link:', sessionId, user.email);

    // Create response with token in cookie
    const response = NextResponse.json({
      authenticated: true,
      isNewUser: authSession.isNewUser,
      profileComplete: authSession.profileComplete,
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

    // Delete the session after successful authentication
    await AuthSession.deleteOne({ sessionId });

    return response;
  } catch (error) {
    console.error('[Auth] Check session error:', error);
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}
