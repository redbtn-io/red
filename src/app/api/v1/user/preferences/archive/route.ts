import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import {
  archiveNodeForUser,
  unarchiveNodeForUser,
  archiveNeuronForUser,
  unarchiveNeuronForUser,
  getArchivedNodeIds,
  getArchivedNeuronIds,
} from '@/lib/database/models/UserNodePreferences';

/**
 * GET /api/v1/user/preferences/archive
 * Get user's archived nodes and neurons
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();

    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [archivedNodes, archivedNeurons] = await Promise.all([
      getArchivedNodeIds(user.userId),
      getArchivedNeuronIds(user.userId),
    ]);

    return NextResponse.json({
      archivedNodes,
      archivedNeurons,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error getting archived items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/user/preferences/archive
 * Archive a node or neuron
 * 
 * Request body:
 * {
 *   type: 'node' | 'neuron';
 *   id: string;
 * }
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();

    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required fields: type, id' },
        { status: 400 }
      );
    }

    if (!['node', 'neuron'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "node" or "neuron"' },
        { status: 400 }
      );
    }

    if (type === 'node') {
      await archiveNodeForUser(user.userId, id);
    } else {
      await archiveNeuronForUser(user.userId, id);
    }

    return NextResponse.json({
      success: true,
      type,
      id,
      action: 'archive',
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error archiving item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/user/preferences/archive
 * Unarchive a node or neuron
 * 
 * Query params:
 * - type: 'node' | 'neuron'
 * - id: string
 */
export async function DELETE(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();

    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required query params: type, id' },
        { status: 400 }
      );
    }

    if (!['node', 'neuron'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be "node" or "neuron"' },
        { status: 400 }
      );
    }

    if (type === 'node') {
      await unarchiveNodeForUser(user.userId, id);
    } else {
      await unarchiveNeuronForUser(user.userId, id);
    }

    return NextResponse.json({
      success: true,
      type,
      id,
      action: 'unarchive',
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error unarchiving item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
