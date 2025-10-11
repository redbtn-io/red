import { NextRequest, NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import AuthCode from '@/lib/models/AuthCode';
import AuthSession from '@/lib/models/AuthSession';
import { generateMagicToken, sendMagicLinkEmail } from '@/lib/email';
import crypto from 'crypto';

/**
 * POST /api/auth/request-code
 * Request a magic link for login/signup
 */
export async function POST(request: NextRequest) {
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

    // Generate new magic link token
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

    // Send email with magic link
    await sendMagicLinkEmail(email, token, baseUrl);

    console.log('[Auth] Magic link sent to:', email, 'sessionId:', sessionId);

    return NextResponse.json({
      success: true,
      message: 'Magic link sent to your email',
      sessionId, // Return sessionId so frontend can poll for authentication
    });
  } catch (error) {
    console.error('[Auth] Request code error:', error);
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    );
  }
}
