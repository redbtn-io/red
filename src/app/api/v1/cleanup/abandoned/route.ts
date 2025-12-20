/**
 * Cleanup Abandoned Nodes and Neurons API
 * 
 * This endpoint deletes abandoned nodes and neurons that:
 * 1. Have status = 'abandoned'
 * 2. Have scheduledDeletionAt date in the past
 * 3. Have forkCount = 0 AND usageCount = 0 (safety check)
 * 
 * This should be called via a cron job (e.g., daily at midnight)
 * POST /api/v1/cleanup/abandoned
 * 
 * Requires admin authentication or a valid cron secret
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

// Schemas for cleanup operations
const NodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  creatorId: { type: String, index: true },
  status: { type: String, enum: ['active', 'abandoned', 'deleted'], default: 'active', index: true },
  abandonedAt: { type: Date, default: null },
  scheduledDeletionAt: { type: Date, default: null, index: true },
  name: { type: String, required: true },
  forkCount: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 },
}, { strict: false });

const NeuronSchema = new mongoose.Schema({
  neuronId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  creatorId: { type: String, index: true },
  status: { type: String, enum: ['active', 'abandoned', 'deleted'], default: 'active', index: true },
  abandonedAt: { type: Date, default: null },
  scheduledDeletionAt: { type: Date, default: null, index: true },
  name: { type: String, required: true },
  forkCount: { type: Number, default: 0 },
  usageCount: { type: Number, default: 0 },
}, { strict: false });

interface CleanupResult {
  nodesDeleted: number;
  neuronsDeleted: number;
  nodesMarkedDeleted: number;
  neuronsMarkedDeleted: number;
  errors: string[];
  deletedNodeIds: string[];
  deletedNeuronIds: string[];
}

/**
 * POST /api/v1/cleanup/abandoned
 * 
 * Cleans up abandoned nodes and neurons past their scheduled deletion date.
 * 
 * Query params:
 * - dryRun: If 'true', only reports what would be deleted without actually deleting
 * - hardDelete: If 'true', permanently removes from database. Otherwise marks as 'deleted'
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Check for cron secret or admin auth
    const cronSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;
    
    let isAuthorized = false;
    
    // Check cron secret first
    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isAuthorized = true;
    }
    
    // If no cron secret, check for admin user
    if (!isAuthorized) {
      const user = await verifyAuth(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      // Check if user is admin (account level 1 or has admin role)
      if (user.accountLevel !== 1 && !(user as any).roles?.includes('admin')) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }
      
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get('dryRun') === 'true';
    const hardDelete = searchParams.get('hardDelete') === 'true';

    await connectToDatabase();

    const Node = mongoose.models.Node || mongoose.model('Node', NodeSchema);
    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);

    const now = new Date();
    const result: CleanupResult = {
      nodesDeleted: 0,
      neuronsDeleted: 0,
      nodesMarkedDeleted: 0,
      neuronsMarkedDeleted: 0,
      errors: [],
      deletedNodeIds: [],
      deletedNeuronIds: []
    };

    // Find abandoned nodes past their scheduled deletion date
    const abandonedNodes = await Node.find({
      status: 'abandoned',
      scheduledDeletionAt: { $lte: now },
      forkCount: { $lte: 0 },
      usageCount: { $lte: 0 }
    }).select('nodeId name forkCount usageCount scheduledDeletionAt').lean();

    // Find abandoned neurons past their scheduled deletion date
    const abandonedNeurons = await Neuron.find({
      status: 'abandoned',
      scheduledDeletionAt: { $lte: now },
      forkCount: { $lte: 0 },
      usageCount: { $lte: 0 }
    }).select('neuronId name forkCount usageCount scheduledDeletionAt').lean();

    if (dryRun) {
      // Just report what would be deleted
      return NextResponse.json({
        success: true,
        dryRun: true,
        wouldDelete: {
          nodes: abandonedNodes.map((n: any) => ({
            nodeId: n.nodeId,
            name: n.name,
            scheduledDeletionAt: n.scheduledDeletionAt
          })),
          neurons: abandonedNeurons.map((n: any) => ({
            neuronId: n.neuronId,
            name: n.name,
            scheduledDeletionAt: n.scheduledDeletionAt
          })),
          totalNodes: abandonedNodes.length,
          totalNeurons: abandonedNeurons.length
        }
      });
    }

    // Process nodes
    for (const node of abandonedNodes as any[]) {
      try {
        if (hardDelete) {
          // Permanently remove from database
          await Node.deleteOne({ nodeId: node.nodeId });
          result.nodesDeleted++;
        } else {
          // Mark as deleted (soft delete)
          await Node.updateOne(
            { nodeId: node.nodeId },
            { 
              $set: { 
                status: 'deleted',
                deletedAt: now
              } 
            }
          );
          result.nodesMarkedDeleted++;
        }
        result.deletedNodeIds.push(node.nodeId);
      } catch (err) {
        result.errors.push(`Failed to delete node ${node.nodeId}: ${err}`);
      }
    }

    // Process neurons
    for (const neuron of abandonedNeurons as any[]) {
      try {
        if (hardDelete) {
          // Permanently remove from database
          await Neuron.deleteOne({ neuronId: neuron.neuronId });
          result.neuronsDeleted++;
        } else {
          // Mark as deleted (soft delete)
          await Neuron.updateOne(
            { neuronId: neuron.neuronId },
            { 
              $set: { 
                status: 'deleted',
                deletedAt: now
              } 
            }
          );
          result.neuronsMarkedDeleted++;
        }
        result.deletedNeuronIds.push(neuron.neuronId);
      } catch (err) {
        result.errors.push(`Failed to delete neuron ${neuron.neuronId}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      result,
      hardDelete,
      message: hardDelete 
        ? `Hard deleted ${result.nodesDeleted} nodes and ${result.neuronsDeleted} neurons`
        : `Soft deleted ${result.nodesMarkedDeleted} nodes and ${result.neuronsMarkedDeleted} neurons`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to run cleanup', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/cleanup/abandoned
 * 
 * Get statistics about what would be cleaned up
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check auth
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    if (user.accountLevel !== 1 && !(user as any).roles?.includes('admin')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    await connectToDatabase();

    const Node = mongoose.models.Node || mongoose.model('Node', NodeSchema);
    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);

    const now = new Date();

    // Count abandoned items ready for deletion
    const nodesReadyForDeletion = await Node.countDocuments({
      status: 'abandoned',
      scheduledDeletionAt: { $lte: now },
      forkCount: { $lte: 0 },
      usageCount: { $lte: 0 }
    });

    const neuronsReadyForDeletion = await Neuron.countDocuments({
      status: 'abandoned',
      scheduledDeletionAt: { $lte: now },
      forkCount: { $lte: 0 },
      usageCount: { $lte: 0 }
    });

    // Count total abandoned items
    const totalAbandonedNodes = await Node.countDocuments({ status: 'abandoned' });
    const totalAbandonedNeurons = await Neuron.countDocuments({ status: 'abandoned' });

    // Count already deleted items
    const deletedNodes = await Node.countDocuments({ status: 'deleted' });
    const deletedNeurons = await Neuron.countDocuments({ status: 'deleted' });

    // Get items pending deletion (abandoned but not yet past scheduled date)
    const nodesPendingDeletion = await Node.find({
      status: 'abandoned',
      scheduledDeletionAt: { $gt: now }
    }).select('nodeId name scheduledDeletionAt forkCount usageCount').lean();

    const neuronsPendingDeletion = await Neuron.find({
      status: 'abandoned',
      scheduledDeletionAt: { $gt: now }
    }).select('neuronId name scheduledDeletionAt forkCount usageCount').lean();

    return NextResponse.json({
      success: true,
      statistics: {
        readyForDeletion: {
          nodes: nodesReadyForDeletion,
          neurons: neuronsReadyForDeletion
        },
        totalAbandoned: {
          nodes: totalAbandonedNodes,
          neurons: totalAbandonedNeurons
        },
        alreadyDeleted: {
          nodes: deletedNodes,
          neurons: deletedNeurons
        },
        pendingDeletion: {
          nodes: nodesPendingDeletion.map((n: any) => ({
            nodeId: n.nodeId,
            name: n.name,
            scheduledDeletionAt: n.scheduledDeletionAt,
            forkCount: n.forkCount,
            usageCount: n.usageCount,
            willBePreserved: (n.forkCount || 0) > 0 || (n.usageCount || 0) > 0
          })),
          neurons: neuronsPendingDeletion.map((n: any) => ({
            neuronId: n.neuronId,
            name: n.name,
            scheduledDeletionAt: n.scheduledDeletionAt,
            forkCount: n.forkCount,
            usageCount: n.usageCount,
            willBePreserved: (n.forkCount || 0) > 0 || (n.usageCount || 0) > 0
          }))
        }
      }
    });

  } catch (error) {
    console.error('Cleanup stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cleanup stats', details: String(error) },
      { status: 500 }
    );
  }
}
