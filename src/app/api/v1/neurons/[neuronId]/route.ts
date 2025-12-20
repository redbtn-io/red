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
 * GET /api/v1/neurons/:neuronId
 * Get details for a specific neuron
 */
export async function GET(
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

    const neuron = await Neuron.findOne({ neuronId }).lean();
    if (!neuron) {
      return NextResponse.json({ error: 'Neuron not found' }, { status: 404 });
    }

    // Check access
    const isSystem = neuron.isSystem || neuron.userId === 'system';
    if (!isSystem && neuron.userId !== user.userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      neuron: {
        neuronId: neuron.neuronId,
        name: neuron.name,
        description: neuron.description,
        provider: neuron.provider,
        model: neuron.model,
        role: neuron.role,
        tier: neuron.tier,
        temperature: neuron.temperature,
        maxTokens: neuron.maxTokens,
        topP: neuron.topP,
        isSystem,
        isImmutable: neuron.isImmutable,
        isOwned: neuron.userId === user.userId,
        parentNeuronId: neuron.parentNeuronId,
        isDefault: neuron.isDefault,
        createdAt: neuron.createdAt,
        updatedAt: neuron.updatedAt,
        // Don't expose apiKey or endpoint
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error getting neuron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/neurons/:neuronId
 * Update a neuron (auto-clones if system/immutable/not owned)
 */
export async function PATCH(
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
    const body = await request.json();
    const { name, description, temperature, maxTokens, topP, newNeuronId } = body;

    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);
    const neuron = await Neuron.findOne({ neuronId });
    
    if (!neuron) {
      return NextResponse.json({ error: 'Neuron not found' }, { status: 404 });
    }

    // Check if user can edit directly
    const isSystem = neuron.isSystem || neuron.userId === 'system';
    const canEditDirectly = neuron.userId === user.userId && !isSystem && !neuron.isImmutable;

    if (canEditDirectly) {
      // Direct edit
      if (name !== undefined) neuron.name = name;
      if (description !== undefined) neuron.description = description;
      if (temperature !== undefined) neuron.temperature = temperature;
      if (maxTokens !== undefined) neuron.maxTokens = maxTokens;
      if (topP !== undefined) neuron.topP = topP;
      neuron.updatedAt = new Date();

      await neuron.save();

      return NextResponse.json({
        neuronId: neuron.neuronId,
        cloned: false,
        name: neuron.name,
        updatedAt: neuron.updatedAt,
      }, { status: 200 });
    } else {
      // Clone for this user
      const clonedNeuronId = newNeuronId || `${neuronId}-${user.userId.slice(-6)}`;

      if (!/^[a-z0-9-]+$/.test(clonedNeuronId)) {
        return NextResponse.json(
          { error: 'newNeuronId must contain only lowercase letters, numbers, and hyphens' },
          { status: 400 }
        );
      }

      // Check for existing clone
      const existingClone = await Neuron.findOne({ neuronId: clonedNeuronId, userId: user.userId });
      
      if (existingClone) {
        // Update existing clone
        if (name !== undefined) existingClone.name = name;
        if (description !== undefined) existingClone.description = description;
        if (temperature !== undefined) existingClone.temperature = temperature;
        if (maxTokens !== undefined) existingClone.maxTokens = maxTokens;
        if (topP !== undefined) existingClone.topP = topP;
        existingClone.updatedAt = new Date();

        await existingClone.save();

        return NextResponse.json({
          neuronId: existingClone.neuronId,
          cloned: false,
          parentNeuronId: existingClone.parentNeuronId,
          name: existingClone.name,
          updatedAt: existingClone.updatedAt,
        }, { status: 200 });
      }

      // Create new clone
      const cloneData = {
        neuronId: clonedNeuronId,
        name: name || `${neuron.name} (Custom)`,
        description: description || neuron.description,
        userId: user.userId,
        provider: neuron.provider,
        endpoint: neuron.endpoint,
        model: neuron.model,
        apiKey: neuron.apiKey,
        temperature: temperature ?? neuron.temperature,
        maxTokens: maxTokens ?? neuron.maxTokens,
        topP: topP ?? neuron.topP,
        role: neuron.role,
        tier: user.accountLevel || 4,
        isDefault: false,
        isSystem: false,
        isImmutable: false,
        parentNeuronId: neuronId,
      };

      const newNeuron = await Neuron.create(cloneData);

      return NextResponse.json({
        neuronId: newNeuron.neuronId,
        cloned: true,
        parentNeuronId: neuronId,
        name: newNeuron.name,
        createdAt: newNeuron.createdAt,
      }, { status: 201 });
    }

  } catch (error: unknown) {
    console.error('[API] Error updating neuron:', error);
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

/**
 * DELETE /api/v1/neurons/:neuronId
 * Delete a user-owned neuron
 */
export async function DELETE(
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

    const neuron = await Neuron.findOne({ neuronId });
    if (!neuron) {
      return NextResponse.json({ error: 'Neuron not found' }, { status: 404 });
    }

    const isSystem = neuron.isSystem || neuron.userId === 'system';
    if (isSystem) {
      return NextResponse.json(
        { error: 'Cannot delete system neurons' },
        { status: 403 }
      );
    }

    if (neuron.userId !== user.userId) {
      return NextResponse.json(
        { error: 'You can only delete your own neurons' },
        { status: 403 }
      );
    }

    await Neuron.deleteOne({ neuronId });

    return NextResponse.json({
      success: true,
      neuronId,
      message: 'Neuron deleted successfully'
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error deleting neuron:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
