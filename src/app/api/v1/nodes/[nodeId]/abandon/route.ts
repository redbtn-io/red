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
  isPublic: { type: Boolean, default: false },
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
 * POST /api/v1/nodes/:nodeId/abandon
 * Abandon a node (transfer ownership to 'abandoned' user)
 * 
 * This marks the node as abandoned while preserving:
 * - Attribution (creatorId remains the original owner)
 * - Functionality for users who have forked it
 * - Existing graph references
 * 
 * After 90 days, if forkCount and usageCount are 0, the node will be hard deleted.
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

    // Find the node
    const node = await NodeModel.findOne({ nodeId }).lean();
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // Check ownership
    if (node.userId !== user.userId) {
      return NextResponse.json({ error: 'You can only abandon nodes you own' }, { status: 403 });
    }

    // Can't abandon system nodes
    if (node.isSystem) {
      return NextResponse.json({ error: 'Cannot abandon system nodes' }, { status: 400 });
    }

    // Check if already abandoned
    if (node.status === 'abandoned') {
      return NextResponse.json({ error: 'Node is already abandoned' }, { status: 400 });
    }

    // Calculate scheduled deletion date (90 days from now)
    const abandonedAt = new Date();
    const scheduledDeletionAt = new Date(abandonedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Get fork and usage counts for warning
    const forkCount = node.stats?.forkCount || 0;
    const usageCount = node.stats?.usageCount || 0;

    // Update the node using raw MongoDB operation to bypass schema restrictions
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    await db.collection('nodes').updateOne(
      { nodeId },
      {
        $set: {
          status: 'abandoned',
          abandonedAt,
          scheduledDeletionAt,
          // Set creatorId if not already set (for migration)
          creatorId: node.creatorId || node.userId,
          // Transfer ownership to 'abandoned' pseudo-user
          userId: 'abandoned',
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      nodeId,
      abandonedAt,
      scheduledDeletionAt,
      forkCount,
      usageCount,
      message: forkCount > 0 || usageCount > 0
        ? `Node abandoned. It has ${forkCount} forks and ${usageCount} uses. It will remain available to others but removed from your list.`
        : `Node abandoned. It will be permanently deleted on ${scheduledDeletionAt.toLocaleDateString()} if unused.`
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error abandoning node:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
