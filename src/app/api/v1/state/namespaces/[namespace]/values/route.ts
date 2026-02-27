/**
 * Global State Values API
 * 
 * GET /api/v1/state/namespaces/[namespace]/values - Get all values as key-value object
 * POST /api/v1/state/namespaces/[namespace]/values - Set a value
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { GlobalStateNamespace } from '@/lib/database/models/state/GlobalState';

interface RouteParams {
  params: Promise<{ namespace: string }>;
}

/**
 * GET /api/v1/state/namespaces/[namespace]/values
 * Get all values as a simple key-value object
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace } = await params;
    await connectToDatabase();

    const values = await GlobalStateNamespace.getAll(user.userId, namespace);

    return NextResponse.json({ values });
  } catch (error) {
    console.error('[API] Error fetching values:', error);
    return NextResponse.json(
      { error: 'Failed to fetch values' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/state/namespaces/[namespace]/values
 * Set a value in the namespace
 * 
 * Body:
 * - key: string (required)
 * - value: any (required)
 * - description?: string
 * - ttlSeconds?: number (optional TTL in seconds)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace } = await params;
    await connectToDatabase();

    const body = await request.json();
    const { key, value, description, ttlSeconds } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Key is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate key format
    const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!keyRegex.test(key)) {
      return NextResponse.json(
        { error: 'Key must start with a letter or underscore and contain only letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    if (key.length > 100) {
      return NextResponse.json(
        { error: 'Key must be 100 characters or less' },
        { status: 400 }
      );
    }

    if (value === undefined) {
      return NextResponse.json(
        { error: 'Value is required' },
        { status: 400 }
      );
    }

    await GlobalStateNamespace.setValue(
      user.userId,
      namespace,
      key,
      value,
      {
        description,
        modifiedBy: 'user',
        ttlSeconds: ttlSeconds ? Number(ttlSeconds) : undefined
      }
    );

    return NextResponse.json({
      success: true,
      key,
      namespace
    });
  } catch (error) {
    console.error('[API] Error setting value:', error);
    return NextResponse.json(
      { error: 'Failed to set value' },
      { status: 500 }
    );
  }
}
