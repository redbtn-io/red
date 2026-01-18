/**
 * Global State Namespaces API
 * 
 * GET /api/v1/state/namespaces - List all namespaces for the user
 * POST /api/v1/state/namespaces - Create a new namespace
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import connectToDatabase from '@/lib/database/mongodb';
import { GlobalStateNamespace } from '@/lib/database/models/state/GlobalState';

/**
 * GET /api/v1/state/namespaces
 * List all namespaces for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true';
    const namespaces = await GlobalStateNamespace.getNamespaces(user.userId, includeArchived);

    // Transform to summary format for listing
    const namespaceSummaries = namespaces.map(ns => ({
      namespace: ns.namespace,
      description: ns.description,
      keyCount: ns.entries.length,
      lastUpdated: ns.updatedAt,
      createdAt: ns.createdAt,
      isArchived: ns.isArchived
    }));

    return NextResponse.json({ 
      namespaces: namespaceSummaries,
      count: namespaceSummaries.length
    });
  } catch (error) {
    console.error('[API] Error listing namespaces:', error);
    return NextResponse.json(
      { error: 'Failed to list namespaces' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/state/namespaces
 * Create a new namespace
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const body = await request.json();
    const { namespace, description } = body;

    if (!namespace || typeof namespace !== 'string') {
      return NextResponse.json(
        { error: 'Namespace name is required' },
        { status: 400 }
      );
    }

    // Validate namespace format (alphanumeric, hyphens, underscores)
    const namespaceRegex = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
    if (!namespaceRegex.test(namespace)) {
      return NextResponse.json(
        { error: 'Namespace must start with a letter and contain only letters, numbers, hyphens, and underscores' },
        { status: 400 }
      );
    }

    if (namespace.length > 100) {
      return NextResponse.json(
        { error: 'Namespace name must be 100 characters or less' },
        { status: 400 }
      );
    }

    // Check if namespace already exists
    const existing = await GlobalStateNamespace.getNamespace(user.userId, namespace);
    if (existing) {
      return NextResponse.json(
        { error: 'Namespace already exists' },
        { status: 409 }
      );
    }

    // Create namespace
    const newNamespace = await GlobalStateNamespace.create({
      namespace,
      userId: user.userId,
      description: description?.substring(0, 500),
      entries: [],
      isArchived: false
    });

    return NextResponse.json({
      namespace: newNamespace.namespace,
      description: newNamespace.description,
      keyCount: 0,
      createdAt: newNamespace.createdAt
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Error creating namespace:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'Namespace already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create namespace' },
      { status: 500 }
    );
  }
}
