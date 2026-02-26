import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import User from '@/lib/database/models/auth/User';
import { auth, verifyToken } from '@/lib/auth/auth';

/**
 * POST /api/auth/check-session
 * Poll for magic link verification via redAuth
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

    // Poll redAuth for magic link verification status
    const pollResult = await auth.pollSession(sessionId);

    if (pollResult.status === 'expired') {
      return NextResponse.json({
        authenticated: false,
        expired: true,
        message: 'Session expired',
      });
    }

    if (pollResult.status === 'pending') {
      return NextResponse.json({
        authenticated: false,
        message: 'Waiting for magic link verification',
      });
    }

    // Verified! authToken contains the JWT created by verify-link
    if (pollResult.status === 'verified' && pollResult.authToken) {
      const payload = verifyToken(pollResult.authToken);
      if (!payload) {
        return NextResponse.json(
          { error: 'Invalid auth token' },
          { status: 401 }
        );
      }

      await connectToDatabase();
      const user = await User.findById(payload.userId);

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      console.log('[Auth] Session authenticated via magic link:', sessionId, user.email);

      const response = NextResponse.json({
        authenticated: true,
        isNewUser: false,
        profileComplete: user.profileComplete,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          profileComplete: user.profileComplete,
          accountLevel: user.accountLevel,
        },
      });

      // Set httpOnly cookie with the JWT
      response.cookies.set('auth_token', pollResult.authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return response;
    }

    return NextResponse.json({
      authenticated: false,
      message: 'Waiting for magic link verification',
    });
  } catch (error) {
    console.error('[Auth] Check session error:', error);
    return NextResponse.json(
      { error: 'Failed to check session' },
      { status: 500 }
    );
  }
}
