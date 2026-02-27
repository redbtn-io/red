import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import connectToDatabase from '@/lib/database/mongodb';
import User from '@/lib/database/models/auth/User';
import { Graph } from '@redbtn/redbtn';

/**
 * PUT /api/v1/user/preferences/default-graph
 * Set user's default graph for chat
 */
export async function PUT(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { graphId } = body;

    if (!graphId || typeof graphId !== 'string') {
      return NextResponse.json({ error: 'graphId is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Verify the graph exists and user has access to it
    const graph = await Graph.findOne({ graphId }).lean() as { isSystem?: boolean; userId?: string } | null;
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Check if user has access (system graphs are accessible to all, otherwise check ownership)
    if (!graph.isSystem && graph.userId !== authUser.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Update user's default graph
    await User.findByIdAndUpdate(
      authUser.userId,
      { $set: { defaultGraphId: graphId } },
      { new: true }
    );

    return NextResponse.json({ 
      success: true, 
      defaultGraphId: graphId 
    });
  } catch (error) {
    console.error('[API] Error setting default graph:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/v1/user/preferences/default-graph
 * Get user's current default graph
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(authUser.userId)
      .select('defaultGraphId')
      .lean() as { defaultGraphId?: string } | null;

    return NextResponse.json({ 
      defaultGraphId: user?.defaultGraphId || 'red-assistant' 
    });
  } catch (error) {
    console.error('[API] Error getting default graph:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
