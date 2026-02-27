import { NextRequest, NextResponse } from 'next/server';
import { getModelsList } from '@/lib/api/api-helpers';
import { verifyAuth } from '@/lib/auth/auth';

export async function GET(request: NextRequest) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(getModelsList());
}
