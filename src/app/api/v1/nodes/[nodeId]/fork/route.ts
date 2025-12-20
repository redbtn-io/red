import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

/**
 * POST /api/v1/nodes/[nodeId]/fork
 * Fork/clone a node to create a user's own copy
 * 
 * This is an explicit fork operation - the user wants their own copy
 * of a system or shared node to customize.
 * 
 * Request body:
 * {
 *   newNodeId?: string;  // Optional custom ID for the fork
 *   name?: string;       // Optional custom name
 * }
 * 
 * Response:
 * {
 *   nodeId: string;      // The new forked node's ID
 *   parentNodeId: string; // The source node ID
 *   name: string;
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
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

    const { nodeId } = await params;
    
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }
    
    const { newNodeId, name } = body as { newNodeId?: string; name?: string };

    // Get or create model
    const NodeModel = mongoose.models.Node ||
      mongoose.model('Node', new mongoose.Schema({
        nodeId: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: String,
        tags: [String],
        userId: { type: String, required: true, index: true },
        isSystem: { type: Boolean, default: false },
        isImmutable: { type: Boolean, default: false },
        parentNodeId: { type: String, default: null },
        version: { type: Number, default: 1 },
        steps: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }));

    // Find the source node
    const sourceNode = await NodeModel.findOne({ nodeId });
    
    if (!sourceNode) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Generate fork ID
    const forkedNodeId = newNodeId || `${nodeId}-${user.userId.slice(-6)}`;
    
    // Validate forkedNodeId format
    if (!/^[a-z0-9-]+$/.test(forkedNodeId)) {
      return NextResponse.json(
        { error: 'newNodeId must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Check if fork already exists
    const existingFork = await NodeModel.findOne({ nodeId: forkedNodeId });
    if (existingFork) {
      if (existingFork.userId === user.userId) {
        // User already has this fork
        return NextResponse.json({
          nodeId: existingFork.nodeId,
          parentNodeId: existingFork.parentNodeId,
          name: existingFork.name,
          alreadyExists: true,
          message: 'You already have a fork of this node'
        }, { status: 200 });
      } else {
        return NextResponse.json(
          { error: 'A node with this ID already exists' },
          { status: 409 }
        );
      }
    }

    // Create the fork using raw MongoDB to bypass schema restrictions
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    const forkData = {
      nodeId: forkedNodeId,
      name: name || `${sourceNode.name} (Fork)`,
      description: sourceNode.description,
      tags: sourceNode.tags || [],
      userId: user.userId,
      creatorId: user.userId, // Set creator for abandon/restore tracking
      status: 'active',
      isSystem: false,
      isImmutable: false,
      parentNodeId: nodeId,
      version: 1,
      steps: sourceNode.steps,
      stats: {
        usageCount: 0,
        forkCount: 0,
        lastUsedAt: null
      },
      metadata: {
        ...sourceNode.metadata,
        forkedAt: new Date().toISOString(),
        forkedFrom: nodeId,
        originalName: sourceNode.name
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('nodes').insertOne(forkData);

    // Increment fork count on the source node
    await db.collection('nodes').updateOne(
      { nodeId },
      { $inc: { 'stats.forkCount': 1 } }
    );

    return NextResponse.json({
      nodeId: forkedNodeId,
      parentNodeId: nodeId,
      name: forkData.name,
      description: forkData.description,
      tags: forkData.tags || [],
      stepsCount: forkData.steps.length,
      createdAt: forkData.createdAt
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API] Error forking node:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Check for duplicate key error
    if (errorMessage.includes('duplicate key') || errorMessage.includes('E11000')) {
      return NextResponse.json(
        { error: 'A node with this ID already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
