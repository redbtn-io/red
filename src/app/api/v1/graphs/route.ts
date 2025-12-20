import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { Graph } from '@redbtn/ai';
import connectToDatabase from '@/lib/database/mongodb';

/**
 * POST /api/v1/graphs
 * Create a new custom graph
 * 
 * Request body:
 * {
 *   name: string;
 *   description?: string;
 *   nodes: Array<{ id: string; type: GraphNodeType; config?: any }>;
 *   edges: Array<{ from: string; to: string; condition?: string }>;
 *   tier?: number;
 * }
 */
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();
    
    // 1. Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { name, description, nodes, edges, tier } = body;

    // 3. Validate required fields
    if (!name || !nodes || !edges) {
      return NextResponse.json(
        { error: 'Missing required fields: name, nodes, edges' },
        { status: 400 }
      );
    }

    // Validate nodes is an array with at least one node
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return NextResponse.json(
        { error: 'nodes must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate edges is an array
    if (!Array.isArray(edges)) {
      return NextResponse.json(
        { error: 'edges must be an array' },
        { status: 400 }
      );
    }

    // 4. Check tier enforcement
    const userTier = user.accountLevel || 4;
    const graphTier = tier || userTier;
    
    if (graphTier < userTier) {
      return NextResponse.json(
        { error: `Tier ${graphTier} requires account level ${graphTier} or higher (you have tier ${userTier})` },
        { status: 403 }
      );
    }

    // 5. Generate graphId
    const graphId = `user-${user.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // 6. Check graph limit (50 graphs per user)
    const userGraphCount = await Graph.countDocuments({ userId: user.userId });
    if (userGraphCount >= 50) {
      return NextResponse.json(
        { error: 'Graph limit reached (maximum 50 custom graphs per user)' },
        { status: 429 }
      );
    }

    // 7. Build graph document
    const graphDoc = {
      graphId,
      userId: user.userId,
      name,
      description: description || '',
      nodes,
      edges,
      tier: graphTier,
      version: '1.0.0',
      isDefault: false,
    };

    // 8. Save to MongoDB
    const graph = await Graph.create(graphDoc);

    // 9. Return success
    return NextResponse.json({
      graphId: graph.graphId,
      name: graph.name,
      description: graph.description,
      tier: graph.tier,
      createdAt: graph.createdAt,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API] Error creating graph:', error);
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
 * GET /api/v1/graphs
 * List all graphs accessible to the user
 * 
 * Returns system graphs (filtered by user tier) + user's custom graphs
 * 
 * Query params:
 * - limit: number (default 100)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();
    
    // 1. Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3. Load user's tier
    const userTier = user.accountLevel || 4;

    // 4. Get system graphs (accessible by tier)
    // User can access graphs at their tier or higher (lower tier numbers = higher privilege)
    const systemGraphs = await Graph.find({
      userId: 'system',
      tier: { $gte: userTier },
    })
      .select('graphId name description tier isDefault isSystem isImmutable parentGraphId nodes edges version createdAt updatedAt')
      .sort({ tier: 1, name: 1 })
      .lean();

    // 5. Get user's custom graphs
    const userGraphs = await Graph.find({
      userId: user.userId,
    })
      .select('graphId name description tier isDefault isSystem isImmutable parentGraphId nodes edges version createdAt updatedAt')
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // 6. Combine and format
    const allGraphs = [
      ...systemGraphs.map(g => ({
        graphId: g.graphId,
        name: g.name,
        description: g.description,
        tier: g.tier,
        isDefault: g.isDefault,
        isSystem: g.isSystem || true,
        isImmutable: g.isImmutable,
        isOwned: false,
        parentGraphId: g.parentGraphId,
        nodeCount: g.nodes?.length || 0,
        edgeCount: g.edges?.length || 0,
        version: g.version,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
      ...userGraphs.map(g => ({
        graphId: g.graphId,
        name: g.name,
        description: g.description,
        tier: g.tier,
        isDefault: g.isDefault,
        isSystem: false,
        isImmutable: g.isImmutable,
        isOwned: true,
        parentGraphId: g.parentGraphId,
        nodeCount: g.nodes?.length || 0,
        edgeCount: g.edges?.length || 0,
        version: g.version,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      })),
    ];

    // 7. Return list
    return NextResponse.json({
      graphs: allGraphs,
      total: allGraphs.length,
      limit,
      offset,
      userTier,
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error listing graphs:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
