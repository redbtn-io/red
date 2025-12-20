import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

/**
 * Neuron schema matching the AI package
 */
const NeuronSchema = new mongoose.Schema({
  neuronId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  creatorId: { type: String, index: true },
  status: { type: String, enum: ['active', 'abandoned', 'deleted'], default: 'active', index: true },
  abandonedAt: { type: Date, default: null },
  scheduledDeletionAt: { type: Date, default: null, index: true },
  isDefault: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  isImmutable: { type: Boolean, default: false },
  parentNeuronId: { type: String, default: null },
  name: { type: String, required: true },
  description: String,
  provider: { type: String, enum: ['ollama', 'openai', 'anthropic', 'google', 'custom'], required: true },
  endpoint: String,
  model: { type: String, required: true },
  apiKey: String,
  temperature: { type: Number, default: 0.7 },
  maxTokens: { type: Number, default: 4096 },
  topP: Number,
  role: { type: String, enum: ['chat', 'worker', 'specialist'], default: 'chat' },
  tier: { type: Number, default: 4, min: 0, max: 4 },
  usageCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

/**
 * POST /api/v1/neurons/:neuronId/abandon
 * Abandon a neuron (transfer ownership to 'abandoned' user)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ neuronId: string }> }
) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();

    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { neuronId } = await params;
    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);

    // Find the neuron
    const neuron = await Neuron.findOne({ neuronId }).lean();
    if (!neuron) {
      return NextResponse.json({ error: 'Neuron not found' }, { status: 404 });
    }

    // Check ownership
    if (neuron.userId !== user.userId) {
      return NextResponse.json({ error: 'You can only abandon neurons you own' }, { status: 403 });
    }

    // Can't abandon system neurons
    if (neuron.isSystem || neuron.userId === 'system') {
      return NextResponse.json({ error: 'Cannot abandon system neurons' }, { status: 400 });
    }

    // Check if already abandoned
    if (neuron.status === 'abandoned') {
      return NextResponse.json({ error: 'Neuron is already abandoned' }, { status: 400 });
    }

    // Calculate scheduled deletion date (90 days from now)
    const abandonedAt = new Date();
    const scheduledDeletionAt = new Date(abandonedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Get usage count for warning
    const usageCount = neuron.usageCount || 0;

    // Count forks (neurons with parentNeuronId = this neuronId)
    const forkCount = await Neuron.countDocuments({ parentNeuronId: neuronId });

    // Update the neuron
    await Neuron.updateOne(
      { neuronId },
      {
        $set: {
          status: 'abandoned',
          abandonedAt,
          scheduledDeletionAt,
          creatorId: neuron.creatorId || neuron.userId,
          userId: 'abandoned',
          updatedAt: new Date(),
        }
      }
    );

    return NextResponse.json({
      success: true,
      neuronId,
      abandonedAt,
      scheduledDeletionAt,
      forkCount,
      usageCount,
      message: forkCount > 0 || usageCount > 0
        ? `Neuron abandoned. It has ${forkCount} forks and ${usageCount} uses. It will remain available to others but removed from your list.`
        : `Neuron abandoned. It will be permanently deleted on ${scheduledDeletionAt.toLocaleDateString()} if unused.`
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error abandoning neuron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
