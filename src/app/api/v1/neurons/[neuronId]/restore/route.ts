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
 * POST /api/v1/neurons/:neuronId/restore
 * Restore an abandoned neuron (reclaim ownership)
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

    // Check if user is the original creator
    if (neuron.creatorId !== user.userId) {
      return NextResponse.json({ error: 'Only the original creator can restore this neuron' }, { status: 403 });
    }

    // Check if abandoned
    if (neuron.status !== 'abandoned') {
      return NextResponse.json({ error: 'Neuron is not abandoned' }, { status: 400 });
    }

    // Restore the neuron
    await Neuron.updateOne(
      { neuronId },
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
      neuronId,
      message: 'Neuron restored successfully'
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error restoring neuron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
