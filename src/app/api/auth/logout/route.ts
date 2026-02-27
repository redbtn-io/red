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
  response.cookies.delete('red_session');

  return response;
}
