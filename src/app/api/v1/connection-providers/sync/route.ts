/**
 * POST /api/v1/connection-providers/sync
 * 
 * Syncs connection providers from JSON file to database.
 * Requires admin authentication.
 */

import { NextResponse } from 'next/server';
import { syncConnectionProviders } from '@/lib/sync-connection-providers';

export async function POST(request: Request) {
  try {
    // Simple auth check - require internal service key or admin token
    const authHeader = request.headers.get('authorization');
    const internalKey = process.env.INTERNAL_SERVICE_KEY;
    
    // Allow if internal service key matches
    const isAuthorized = 
      (authHeader === `Bearer ${internalKey}`) ||
      (authHeader === `Bearer ${process.env.BEARER_TOKEN}`);
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await syncConnectionProviders();
    
    return NextResponse.json({
      ...result,
      message: `Synced ${result.synced}/${result.total} providers (${result.withCredentials} with credentials)`,
    });
  } catch (error) {
    console.error('Provider sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync providers', details: String(error) },
      { status: 500 }
    );
  }
}
