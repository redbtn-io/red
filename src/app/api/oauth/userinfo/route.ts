import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import OAuthAccessToken from '@/lib/models/OAuthAccessToken';
import User from '@/lib/models/User';

/**
 * GET /api/oauth/userinfo
 * Get user profile information using an access token
 * 
 * Spec: OpenID Connect UserInfo Endpoint
 * 
 * Authorization: Bearer <access_token>
 * 
 * Response depends on granted scopes:
 * - profile: name, dateOfBirth
 * - email: email
 * - admin: accountLevel
 */
export async function GET(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.slice(7);

    await connectToDatabase();

    // Find and validate access token
    const tokenDoc = await OAuthAccessToken.findOne({ accessToken });
    if (!tokenDoc) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token not found or expired' },
        { status: 401 }
      );
    }

    // Check if token is expired
    const now = new Date();
    if (tokenDoc.expiresAt < now) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Token expired' },
        { status: 401 }
      );
    }

    // Get user
    const user = await User.findById(tokenDoc.userId);
    if (!user) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'User not found' },
        { status: 401 }
      );
    }

    // Build response based on scopes
    const scopes = tokenDoc.scopes;
    const userInfo: Record<string, any> = {
      sub: user._id.toString(), // Subject (user ID) - always included
    };

    // Profile scope
    if (scopes.includes('profile') || scopes.includes('read')) {
      userInfo.name = user.name;
      if (user.dateOfBirth) {
        userInfo.birthdate = user.dateOfBirth.toISOString().split('T')[0]; // YYYY-MM-DD format
      }
      userInfo.profile_complete = user.profileComplete;
    }

    // Email scope
    if (scopes.includes('email') || scopes.includes('read')) {
      userInfo.email = user.email;
      userInfo.email_verified = user.profileComplete; // Consider profile complete as email verified
    }

    // Admin scope
    if (scopes.includes('admin')) {
      userInfo.account_level = user.accountLevel;
      userInfo.is_admin = user.accountLevel === 0;
    }

    console.log('[OAuth] UserInfo request:', {
      userId: user._id,
      scopes,
      clientId: tokenDoc.clientId,
    });

    return NextResponse.json(userInfo);
  } catch (error) {
    console.error('[OAuth] UserInfo error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to get user info' },
      { status: 500 }
    );
  }
}
