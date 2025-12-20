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
 * POST /api/v1/neurons/:neuronId/fork
 * Create a fork (clone) of a neuron for the current user
 * 
 * Request body:
 * {
 *   newNeuronId?: string;  // Optional custom ID for the fork
 *   name?: string;         // Optional custom name
 * }
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

    // Parse request body
    let body: { newNeuronId?: string; name?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK
    }
    const { newNeuronId, name } = body;

    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);

    // Load original neuron
    const neuron = await Neuron.findOne({ neuronId });
    if (!neuron) {
      return NextResponse.json({ error: 'Neuron not found' }, { status: 404 });
    }

    // Generate fork ID
    const forkNeuronId = newNeuronId || `${neuronId}-${user.userId.slice(-6)}`;

    // Validate fork ID format
    if (!/^[a-z0-9-]+$/.test(forkNeuronId)) {
      return NextResponse.json(
        { error: 'newNeuronId must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Check if fork already exists
    const existingFork = await Neuron.findOne({ neuronId: forkNeuronId });
    if (existingFork) {
      return NextResponse.json(
        { error: `A neuron with ID "${forkNeuronId}" already exists`, existingNeuronId: forkNeuronId },
        { status: 409 }
      );
    }

    // Check neuron limit (20 custom neurons per user)
    const userNeuronCount = await Neuron.countDocuments({ userId: user.userId });
    if (userNeuronCount >= 20) {
      return NextResponse.json(
        { error: 'Neuron limit reached (maximum 20 custom neurons per user)' },
        { status: 429 }
      );
    }

    // Create fork
    const forkData = {
      neuronId: forkNeuronId,
      name: name || `${neuron.name} (Fork)`,
      description: neuron.description,
      userId: user.userId,
      creatorId: user.userId, // Set creator for abandon/restore tracking
      status: 'active',
      provider: neuron.provider,
      endpoint: neuron.endpoint,
      model: neuron.model,
      apiKey: neuron.apiKey,
      temperature: neuron.temperature,
      maxTokens: neuron.maxTokens,
      topP: neuron.topP,
      role: neuron.role,
      tier: user.accountLevel || 4,
      isDefault: false,
      isSystem: false,
      isImmutable: false,
      parentNeuronId: neuronId,
      forkCount: 0,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Use raw MongoDB to bypass schema restrictions
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }
    
    await db.collection('neurons').insertOne(forkData);

    // Increment fork count on the source neuron
    await db.collection('neurons').updateOne(
      { neuronId },
      { $inc: { forkCount: 1 } }
    );

    return NextResponse.json({
      success: true,
      neuronId: forkData.neuronId,
      parentNeuronId: neuronId,
      name: forkData.name,
      createdAt: forkData.createdAt,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API] Error forking neuron:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('duplicate key') || errorMessage.includes('E11000')) {
      return NextResponse.json(
        { error: 'A neuron with this ID already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
