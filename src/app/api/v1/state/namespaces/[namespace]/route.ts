/**
 * Global State Namespace Detail API
 * 
 * GET /api/v1/state/namespaces/[namespace] - Get all entries in a namespace
 * PATCH /api/v1/state/namespaces/[namespace] - Update namespace metadata
 * DELETE /api/v1/state/namespaces/[namespace] - Delete a namespace
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { GlobalStateNamespace } from '@/lib/database/models/state/GlobalState';

interface RouteParams {
  params: Promise<{ namespace: string }>;
}

/**
 * GET /api/v1/state/namespaces/[namespace]
 * Get all entries in a namespace
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace } = await params;
    await connectToDatabase();

    const ns = await GlobalStateNamespace.getNamespace(user.userId, namespace);
    if (!ns) {
      return NextResponse.json({ error: 'Namespace not found' }, { status: 404 });
    }

    // Clean up expired entries and return valid ones
    const now = new Date();
    const validEntries = ns.entries.filter(entry => {
      if (entry.expiresAt && entry.expiresAt < now) {
        return false;
      }
      return true;
    });

    return NextResponse.json({
      namespace: ns.namespace,
      description: ns.description,
      entries: validEntries.map(entry => ({
        key: entry.key,
        value: entry.value,
        valueType: entry.valueType,
        description: entry.description,
        lastModifiedAt: entry.lastModifiedAt,
        lastModifiedBy: entry.lastModifiedBy,
        expiresAt: entry.expiresAt,
        accessCount: entry.accessCount,
        lastAccessedAt: entry.lastAccessedAt
      })),
      keyCount: validEntries.length,
      createdAt: ns.createdAt,
      updatedAt: ns.updatedAt,
      isArchived: ns.isArchived
    });
  } catch (error) {
    console.error('[API] Error fetching namespace:', error);
    return NextResponse.json(
      { error: 'Failed to fetch namespace' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/state/namespaces/[namespace]
 * Update namespace metadata (description, archive status)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace } = await params;
    await connectToDatabase();

    const body = await request.json();
    const { description, isArchived } = body;

    const ns = await GlobalStateNamespace.getNamespace(user.userId, namespace);
    if (!ns) {
      return NextResponse.json({ error: 'Namespace not found' }, { status: 404 });
    }

    // Update fields
    if (description !== undefined) {
      ns.description = description?.substring(0, 500);
    }
    if (isArchived !== undefined) {
      ns.isArchived = Boolean(isArchived);
    }

    await ns.save();

    return NextResponse.json({
      namespace: ns.namespace,
      description: ns.description,
      isArchived: ns.isArchived,
      updatedAt: ns.updatedAt
    });
  } catch (error) {
    console.error('[API] Error updating namespace:', error);
    return NextResponse.json(
      { error: 'Failed to update namespace' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/state/namespaces/[namespace]
 * Delete a namespace and all its entries
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { namespace } = await params;
    await connectToDatabase();

    const result = await GlobalStateNamespace.deleteOne({ 
      userId: user.userId, 
      namespace 
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Namespace not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true,
      message: `Namespace "${namespace}" deleted`
    });
  } catch (error) {
    console.error('[API] Error deleting namespace:', error);
    return NextResponse.json(
      { error: 'Failed to delete namespace' },
      { status: 500 }
    );
  }
}
