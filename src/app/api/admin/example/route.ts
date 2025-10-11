import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, requireAdmin } from '@/lib/auth/auth';

/**
 * GET /api/admin/users
 * Admin-only endpoint to list all users
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    
    // Require admin access
    try {
      requireAdmin(user);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unauthorized' },
        { status: 403 }
      );
    }

    // Admin access granted - implement admin functionality here
    return NextResponse.json({
      message: 'Admin access granted',
      user: {
        id: user?.userId,
        email: user?.email,
        accountLevel: user?.accountLevel,
      },
    });
  } catch (error) {
    console.error('[Admin] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
