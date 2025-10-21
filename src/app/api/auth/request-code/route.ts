import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/database/mongodb';
import AuthCode from '@/lib/database/models/auth/AuthCode';
import AuthSession from '@/lib/database/models/auth/AuthSession';
import { generateMagicToken, sendMagicLinkEmail } from '@/lib/email/email';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';

/**
 * POST /api/auth/request-code
 * Request a sign in link for login/signup
 */
export async function POST(request: NextRequest) {
  // Apply strict rate limiting for auth endpoints
  const rateLimitResult = await rateLimitAPI(request, RateLimits.AUTH);
  if (rateLimitResult) return rateLimitResult;
  
  try {
    const body = await request.json();
    const { email, sessionId } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Delete any existing codes for this email
    await AuthCode.deleteMany({ email: email.toLowerCase() });

    // Generate new sign in link token
    const token = generateMagicToken();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create auth session to track this login attempt
    await AuthSession.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        email: email.toLowerCase(),
        authenticated: false,
        expiresAt,
      },
      { upsert: true, new: true }
    );

    // Save token to database
    await AuthCode.create({
      email: email.toLowerCase(),
      token,
      sessionId,
      used: false,
      expiresAt,
    });

    // Get base URL from environment or fall back to request URL
    const baseUrl = process.env.BASE_URL || `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    // Send email with sign in link
    await sendMagicLinkEmail(email, token, baseUrl);

    console.log('[Auth] Sign in link sent to:', email, 'sessionId:', sessionId);

    return NextResponse.json({
      success: true,
      message: 'Sign in link sent to your email',
      sessionId, // Return sessionId so frontend can poll for authentication
    });
  } catch (error) {
    console.error('[Auth] Request code error:', error);
    return NextResponse.json(
      { error: 'Failed to send sign in link' },
      { status: 500 }
    );
  }
}
