/**
 * Global State Single Value API
 * 
 * GET /api/v1/state/namespaces/[namespace]/values/[key] - Get a single value
 * PUT /api/v1/state/namespaces/[namespace]/values/[key] - Update a single value
 * DELETE /api/v1/state/namespaces/[namespace]/values/[key] - Delete a single value
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { GlobalStateNamespace } from '@/lib/database/models/state/GlobalState';

interface RouteParams {
  params: Promise<{ namespace: string; key: string }>;
}

/**
 * GET /api/v1/state/namespaces/[namespace]/values/[key]
 * Get a single value
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace, key } = await params;
    await connectToDatabase();

    const value = await GlobalStateNamespace.getValue(user.userId, namespace, key);

    if (value === undefined) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    return NextResponse.json({ key, value });
  } catch (error) {
    console.error('[API] Error fetching value:', error);
    return NextResponse.json(
      { error: 'Failed to fetch value' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/state/namespaces/[namespace]/values/[key]
 * Update a single value
 * 
 * Body:
 * - value: any (required)
 * - description?: string
 * - ttlSeconds?: number
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace, key } = await params;
    await connectToDatabase();

    const body = await request.json();
    const { value, description, ttlSeconds } = body;

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
      value,
      namespace
    });
  } catch (error) {
    console.error('[API] Error updating value:', error);
    return NextResponse.json(
      { error: 'Failed to update value' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/state/namespaces/[namespace]/values/[key]
 * Delete a single value
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace, key } = await params;
    await connectToDatabase();

    const deleted = await GlobalStateNamespace.deleteValue(user.userId, namespace, key);

    if (!deleted) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Key "${key}" deleted from namespace "${namespace}"`
    });
  } catch (error) {
    console.error('[API] Error deleting value:', error);
    return NextResponse.json(
      { error: 'Failed to delete value' },
      { status: 500 }
    );
  }
}
