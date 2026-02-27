import { NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Clear authentication cookie
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  // Clear auth cookie
  response.cookies.set('red_session', '', {
    httpOnly: true,
    maxAge: 0,
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.redbtn.io' : undefined,
  });

  return response;
}
