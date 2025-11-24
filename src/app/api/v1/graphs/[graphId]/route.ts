import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { Graph } from '@redbtn/ai';
import connectToDatabase from '@/lib/database/mongodb';

/**
 * GET /api/v1/graphs/:graphId
 * Get details for a specific graph
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ graphId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();
    
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { graphId } = await params;

    // Load graph
    const graph = await Graph.findOne({ graphId }).lean();
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Check access (system graphs OR user's own graphs)
    if (graph.userId !== 'system' && graph.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Access denied - you can only view your own graphs or system graphs' },
        { status: 403 }
      );
    }

    // Check tier restriction
    const userTier = user.accountLevel || 4;
    if (graph.tier < userTier) {
      return NextResponse.json(
        { error: `This graph requires tier ${graph.tier} or higher (you have tier ${userTier})` },
        { status: 403 }
      );
    }

    // Return full graph details
    return NextResponse.json({
      graph: {
        graphId: graph.graphId,
        name: graph.name,
        description: graph.description,
        userId: graph.userId,
        tier: graph.tier,
        isDefault: graph.isDefault,
        isSystem: graph.userId === 'system',
        nodes: graph.nodes,
        edges: graph.edges,
        version: graph.version,
        createdAt: graph.createdAt,
        updatedAt: graph.updatedAt,
      },
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error getting graph:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/graphs/:graphId
 * Update an existing custom graph
 * 
 * Request body (all optional):
 * {
 *   name?: string;
 *   description?: string;
 *   nodes?: Array<{ id: string; type: GraphNodeType; config?: any }>;
 *   edges?: Array<{ from: string; to: string; condition?: string }>;
 *   tier?: number;
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ graphId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();
    
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { graphId } = await params;

    // Load graph
    const graph = await Graph.findOne({ graphId });
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Check ownership (can't update system graphs)
    if (graph.userId === 'system') {
      return NextResponse.json(
        { error: 'Cannot modify system graphs' },
        { status: 403 }
      );
    }

    if (graph.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Access denied - you can only update your own graphs' },
        { status: 403 }
      );
    }

    // Parse update fields
    const body = await request.json();
    const { name, description, nodes, edges, tier } = body;

    // Validate tier if provided
    if (tier !== undefined) {
      const userTier = user.accountLevel || 4;
      if (tier < userTier) {
        return NextResponse.json(
          { error: `Tier ${tier} requires account level ${tier} or higher (you have tier ${userTier})` },
          { status: 403 }
        );
      }
    }

    // Validate nodes/edges if provided
    if (nodes !== undefined) {
      if (!Array.isArray(nodes) || nodes.length === 0) {
        return NextResponse.json(
          { error: 'nodes must be a non-empty array' },
          { status: 400 }
        );
      }
    }

    if (edges !== undefined) {
      if (!Array.isArray(edges)) {
        return NextResponse.json(
          { error: 'edges must be an array' },
          { status: 400 }
        );
      }
    }

    // Build update object (only include provided fields)
    const updates: Partial<{
      name: string;
      description: string;
      nodes: any[];
      edges: any[];
      tier: number;
    }> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (nodes !== undefined) updates.nodes = nodes;
    if (edges !== undefined) updates.edges = edges;
    if (tier !== undefined) updates.tier = tier;

    // Update graph
    Object.assign(graph, updates);
    await graph.save();

    return NextResponse.json({
      graphId: graph.graphId,
      name: graph.name,
      description: graph.description,
      tier: graph.tier,
      updatedAt: graph.updatedAt,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error updating graph:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for validation errors
    if (errorMessage.includes('validation')) {
      return NextResponse.json(
        { error: 'Invalid graph configuration', message: errorMessage },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/graphs/:graphId
 * Delete a custom graph
 * 
 * Cannot delete system graphs.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ graphId: string }> }
) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();
    
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { graphId } = await params;

    // Load graph
    const graph = await Graph.findOne({ graphId });
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Check ownership (can't delete system graphs)
    if (graph.userId === 'system') {
      return NextResponse.json(
        { error: 'Cannot delete system graphs' },
        { status: 403 }
      );
    }

    if (graph.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Access denied - you can only delete your own graphs' },
        { status: 403 }
      );
    }

    // Delete graph
    await Graph.deleteOne({ graphId });

    // Note: GraphRegistry cache will be invalidated on next access
    // or we could expose a cache clear method if needed

    return NextResponse.json({
      message: 'Graph deleted successfully',
      graphId,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error deleting graph:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
