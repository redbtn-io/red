import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { sendMagicLinkEmail } from '@/lib/email/email';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { createMagicLink as createML } from 'red-auth';

/**
 * POST /api/auth/request-code
 * Request a sign in link for login/signup (powered by redAuth)
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.AUTH);
  if (rateLimitResult) return rateLimitResult;
  
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // sessionId is generated server-side by redAuth
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Create sign in link via redAuth
    const conn = await auth.getConnection();
    const result = await createML({
      email: email.toLowerCase(),
      appName: 'redbtn',
      expirySeconds: 10 * 60, // 10 minutes
      conn,
    });

    // Compute base URL
    function computeBaseUrl(req: NextRequest) {
      if (process.env.BASE_URL) return process.env.BASE_URL;
      const forwardedProto = req.headers.get('x-forwarded-proto');
      const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
      if (forwardedHost) {
        const proto = forwardedProto || req.nextUrl.protocol || 'https';
        return `${proto}://${forwardedHost}`;
      }
      return `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    }

    const baseUrl = computeBaseUrl(request);
    console.log('[Auth] using baseUrl for sign in link:', baseUrl);

    // Send email with sign in link (using app's existing email template)
    await sendMagicLinkEmail(email, result.token, baseUrl);

    console.log('[Auth] Sign in link sent to:', email, 'sessionId:', result.sessionId);

    return NextResponse.json({
      success: true,
      message: 'Sign in link sent to your email',
      sessionId: result.sessionId,
    });
  } catch (error) {
    console.error('[Auth] Request code error:', error);
    return NextResponse.json(
      { error: 'Failed to send sign in link' },
      { status: 500 }
    );
  }
}
