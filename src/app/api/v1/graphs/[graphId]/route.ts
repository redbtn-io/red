import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { Graph} from '@redbtn/ai';
import connectToDatabase from '@/lib/database/mongodb';

/**
 * Graph document type for lean queries
 */
interface GraphDoc {
  graphId: string;
  userId: string;
  name: string;
  description?: string;
  tier: number;
  isDefault: boolean;
  isSystem?: boolean;
  isImmutable?: boolean;
  parentGraphId?: string;
  nodes: Array<{ id: string; type: string; config?: Record<string, unknown> }>;
  edges: Array<{ from: string; to?: string; condition?: string }>;
  version?: string;
  layout?: Map<string, { x: number; y: number }>;
  createdAt?: Date;
  updatedAt?: Date;
}

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
    const graph = await Graph.findOne({ graphId }).lean() as GraphDoc | null;
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
        isSystem: graph.isSystem || graph.userId === 'system',
        isImmutable: graph.isImmutable,
        isOwned: graph.userId === user.userId,
        parentGraphId: graph.parentGraphId,
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
 * Update an existing graph
 * 
 * If the user doesn't own the graph or it's a system/immutable graph,
 * a clone will be created instead of modifying the original.
 * 
 * Request body (all optional):
 * {
 *   name?: string;
 *   description?: string;
 *   nodes?: Array<{ id: string; type: GraphNodeType; config?: any }>;
 *   edges?: Array<{ from: string; to: string; condition?: string }>;
 *   tier?: number;
 *   newGraphId?: string;  // Custom ID for clone
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
    const body = await request.json();
    const { name, description, nodes, edges, tier, newGraphId } = body;

    // Load graph
    const graph = await Graph.findOne({ graphId });
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Check if user can edit directly
    const isSystem = graph.isSystem || graph.userId === 'system';
    const canEditDirectly = graph.userId === user.userId && !isSystem && !graph.isImmutable;

    if (canEditDirectly) {
      // Direct edit - validate and apply updates
      if (tier !== undefined) {
        const userTier = user.accountLevel || 4;
        if (tier < userTier) {
          return NextResponse.json(
            { error: `Tier ${tier} requires account level ${tier} or higher` },
            { status: 403 }
          );
        }
      }

      if (nodes !== undefined && (!Array.isArray(nodes) || nodes.length === 0)) {
        return NextResponse.json({ error: 'nodes must be a non-empty array' }, { status: 400 });
      }

      if (edges !== undefined && !Array.isArray(edges)) {
        return NextResponse.json({ error: 'edges must be an array' }, { status: 400 });
      }

      // Apply updates
      if (name !== undefined) graph.name = name;
      if (description !== undefined) graph.description = description;
      if (nodes !== undefined) graph.nodes = nodes;
      if (edges !== undefined) graph.edges = edges;
      if (tier !== undefined) graph.tier = tier;

      await graph.save();

      return NextResponse.json({
        graphId: graph.graphId,
        cloned: false,
        name: graph.name,
        updatedAt: graph.updatedAt,
      }, { status: 200 });
    } else {
      // Clone the graph for this user
      const clonedGraphId = newGraphId || `${graphId}-${user.userId.slice(-6)}`;

      // Validate clone ID format
      if (!/^[a-z0-9-]+$/.test(clonedGraphId)) {
        return NextResponse.json(
          { error: 'newGraphId must contain only lowercase letters, numbers, and hyphens' },
          { status: 400 }
        );
      }

      // Check if clone already exists
      const existingClone = await Graph.findOne({ graphId: clonedGraphId, userId: user.userId });
      
      if (existingClone) {
        // Update existing clone
        if (name !== undefined) existingClone.name = name;
        if (description !== undefined) existingClone.description = description;
        if (nodes !== undefined) existingClone.nodes = nodes;
        if (edges !== undefined) existingClone.edges = edges;
        if (tier !== undefined) existingClone.tier = tier;

        await existingClone.save();

        return NextResponse.json({
          graphId: existingClone.graphId,
          cloned: false,
          parentGraphId: existingClone.parentGraphId,
          name: existingClone.name,
          updatedAt: existingClone.updatedAt,
        }, { status: 200 });
      }

      // Create new clone
      const cloneData = {
        graphId: clonedGraphId,
        name: name || `${graph.name} (Custom)`,
        description: description || graph.description,
        userId: user.userId,
        tier: tier || graph.tier,
        isDefault: false,
        isSystem: false,
        isImmutable: false,
        parentGraphId: graphId,
        nodes: nodes || graph.nodes,
        edges: edges || graph.edges,
        version: '1.0.0',
        config: graph.config,
        neuronAssignments: graph.neuronAssignments,
      };

      const newGraph = await Graph.create(cloneData);

      return NextResponse.json({
        graphId: newGraph.graphId,
        cloned: true,
        parentGraphId: graphId,
        name: newGraph.name,
        createdAt: newGraph.createdAt,
      }, { status: 201 });
    }

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
 * Cannot delete system graphs or graphs owned by other users.
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

    // Check if system graph
    const isSystem = graph.isSystem || graph.userId === 'system';
    if (isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system graphs' },
        { status: 403 }
      );
    }

    if (graph.userId !== user.userId) {
      return NextResponse.json(
        { error: 'You can only delete your own graphs' },
        { status: 403 }
      );
    }

    // Delete graph
    await Graph.deleteOne({ graphId });

    return NextResponse.json({
      success: true,
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
