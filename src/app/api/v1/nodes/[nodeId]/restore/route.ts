import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

// Full schema with all fields including abandon-related ones
const NodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  tags: [String],
  userId: { type: String, required: true, index: true },
  creatorId: { type: String, index: true },
  status: { type: String, enum: ['active', 'abandoned', 'deleted'], default: 'active' },
  abandonedAt: { type: Date, default: null },
  scheduledDeletionAt: { type: Date, default: null },
  isSystem: { type: Boolean, default: false },
  isImmutable: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: true },
  parentNodeId: String,
  version: { type: Number, default: 1 },
  steps: [mongoose.Schema.Types.Mixed],
  stats: {
    usageCount: { type: Number, default: 0 },
    forkCount: { type: Number, default: 0 },
    lastUsedAt: Date,
  },
}, { strict: false });

/**
 * POST /api/v1/nodes/:nodeId/restore
 * Restore an abandoned node (reclaim ownership)
 * 
 * Only the original creator can restore a node they abandoned.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();

    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { nodeId } = await params;
    // Use our full schema or get existing model
    const NodeModel = mongoose.models.Node || mongoose.model('Node', NodeSchema);

    // Use raw MongoDB for reading to bypass schema restrictions
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    // Find the node using raw query to get all fields
    const node = await db.collection('nodes').findOne({ nodeId }) as any;
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Check if user is the original creator
    if (node.creatorId !== user.userId) {
      return NextResponse.json({ error: 'Only the original creator can restore this node' }, { status: 403 });
    }

    // Check if abandoned
    if (node.status !== 'abandoned') {
      return NextResponse.json({ error: 'Node is not abandoned' }, { status: 400 });
    }

    // Restore the node using raw MongoDB operation
    await db.collection('nodes').updateOne(
      { nodeId },
      {
        $set: {
          status: 'active',
          abandonedAt: null,
          scheduledDeletionAt: null,
          userId: user.userId,
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      nodeId,
      message: 'Node restored successfully'
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error restoring node:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
