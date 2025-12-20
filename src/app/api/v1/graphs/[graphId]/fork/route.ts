import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import { Graph } from '@redbtn/ai';
import connectToDatabase from '@/lib/database/mongodb';

/**
 * POST /api/v1/graphs/:graphId/fork
 * Create a fork (clone) of a graph for the current user
 * 
 * Request body:
 * {
 *   newGraphId?: string;  // Optional custom ID for the fork
 *   name?: string;        // Optional custom name
 * }
 */
export async function POST(
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

    // Parse request body
    let body: { newGraphId?: string; name?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK
    }
    const { newGraphId, name } = body;

    // Load original graph
    const graph = await Graph.findOne({ graphId });
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Generate fork ID
    const forkGraphId = newGraphId || `${graphId}-${user.userId.slice(-6)}`;

    // Validate fork ID format
    if (!/^[a-z0-9-]+$/.test(forkGraphId)) {
      return NextResponse.json(
        { error: 'newGraphId must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Check if fork already exists
    const existingFork = await Graph.findOne({ graphId: forkGraphId });
    if (existingFork) {
      return NextResponse.json(
        { error: `A graph with ID "${forkGraphId}" already exists`, existingGraphId: forkGraphId },
        { status: 409 }
      );
    }

    // Create fork
    const forkData = {
      graphId: forkGraphId,
      name: name || `${graph.name} (Fork)`,
      description: graph.description,
      userId: user.userId,
      tier: graph.tier,
      isDefault: false,
      isSystem: false,
      isImmutable: false,
      parentGraphId: graphId,
      nodes: graph.nodes,
      edges: graph.edges,
      version: '1.0.0',
      config: graph.config,
      neuronAssignments: graph.neuronAssignments,
      tags: graph.tags || [],
    };

    const newGraph = await Graph.create(forkData);

    return NextResponse.json({
      success: true,
      graphId: newGraph.graphId,
      parentGraphId: graphId,
      name: newGraph.name,
      createdAt: newGraph.createdAt,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API] Error forking graph:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for duplicate key error
    if (errorMessage.includes('duplicate key') || errorMessage.includes('E11000')) {
      return NextResponse.json(
        { error: 'A graph with this ID already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
