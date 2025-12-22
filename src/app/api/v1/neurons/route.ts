import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';
import { getArchivedNeuronIds } from '@/lib/database/models/UserNodePreferences';
import { encryptApiKey } from '@/lib/crypto';

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
 * Neuron document from MongoDB lean query
 */
interface NeuronDocument {
  neuronId: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  role: string;
  tier: number;
  isDefault?: boolean;
  isSystem?: boolean;
  isImmutable?: boolean;
  parentNeuronId?: string;
  userId: string;
  creatorId?: string;
  status?: string;
}

/**
 * Neuron info for Studio dropdowns (without sensitive data)
 */
interface NeuronInfo {
  neuronId: string;
  name: string;
  description?: string;
  provider: string;
  model: string;
  role: string;
  tier: number;
  isSystem: boolean;
  isImmutable?: boolean;
  isOwned?: boolean;
  isArchived?: boolean;
  status?: string;
  parentNeuronId?: string;
  creatorId?: string;
  isDefault: boolean;
}

/**
 * GET /api/v1/neurons
 * List all available neurons for Studio node configuration
 * 
 * Returns neurons accessible to the user based on their tier level.
 * API keys and endpoints are NOT exposed.
 * 
 * Query params:
 * - role: Filter by role (chat, worker, specialist)
 * - provider: Filter by provider (ollama, openai, etc.)
 */
export async function GET(request: NextRequest) {
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

    // Get filters from query params
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');
    const providerFilter = searchParams.get('provider');
    const view = searchParams.get('view'); // null (default), 'archived'

    const userTier = user.accountLevel || 4;

    // Get archived neuron IDs for this user
    const archivedNeuronIds = await getArchivedNeuronIds(user.userId);
    const archivedSet = new Set(archivedNeuronIds);

    // Get or create Neuron model
    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);

    // Build query
    const query: Record<string, unknown> = {
      // Only show active neurons (or legacy ones without status)
      $or: [
        { status: 'active' },
        { status: { $exists: false } }
      ]
    };
    
    // Add visibility filter
    query.$and = [
      {
        $or: [
          { userId: user.userId },                    // User's custom neurons
          { userId: 'system', tier: { $gte: userTier } } // System neurons user can access
        ]
      }
    ];

    if (roleFilter) {
      query.role = roleFilter;
    }
    if (providerFilter) {
      query.provider = providerFilter;
    }

    // Fetch neurons (exclude sensitive fields)
    const neurons = await Neuron.find(query)
      .select('neuronId name description provider model role tier isDefault isSystem isImmutable parentNeuronId userId creatorId status')
      .sort({ tier: 1, isDefault: -1, name: 1 })
      .lean() as unknown as NeuronDocument[];

    // Format response
    let neuronList: NeuronInfo[] = neurons.map((n: NeuronDocument) => {
      const isSystem = n.userId === 'system' || n.isSystem === true;
      const isOwned = n.userId === user.userId || n.creatorId === user.userId;
      return {
        neuronId: n.neuronId,
        name: n.name,
        description: n.description,
        provider: n.provider,
        model: n.model,
        role: n.role,
        tier: n.tier,
        isSystem,
        isImmutable: n.isImmutable,
        isOwned,
        isArchived: archivedSet.has(n.neuronId),
        status: n.status || 'active',
        parentNeuronId: n.parentNeuronId,
        creatorId: n.creatorId,
        isDefault: n.isDefault || false
      };
    });

    // Filter based on view
    if (view === 'archived') {
      // Only show archived neurons
      neuronList = neuronList.filter(n => archivedSet.has(n.neuronId));
    } else {
      // Default: exclude archived neurons
      neuronList = neuronList.filter(n => !archivedSet.has(n.neuronId));
    }

    // Group by role
    const grouped: Record<string, NeuronInfo[]> = {
      chat: neuronList.filter(n => n.role === 'chat'),
      worker: neuronList.filter(n => n.role === 'worker'),
      specialist: neuronList.filter(n => n.role === 'specialist')
    };

    // Get default neuron for each role
    const defaults: Record<string, string | null> = {
      chat: neuronList.find(n => n.role === 'chat' && n.isDefault)?.neuronId || null,
      worker: neuronList.find(n => n.role === 'worker' && n.isDefault)?.neuronId || null,
      specialist: neuronList.find(n => n.role === 'specialist' && n.isDefault)?.neuronId || null
    };

    return NextResponse.json({
      neurons: neuronList,
      grouped,
      defaults,
      total: neuronList.length,
      userTier
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error listing neurons:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/neurons
 * Create a custom neuron (user-owned)
 * 
 * Request body:
 * {
 *   name: string;
 *   description?: string;
 *   provider: 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom';
 *   endpoint?: string;
 *   model: string;
 *   apiKey?: string;
 *   temperature?: number;
 *   maxTokens?: number;
 *   role?: 'chat' | 'worker' | 'specialist';
 * }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, description, provider, endpoint, model, apiKey, temperature, maxTokens, topP, role } = body;

    // Validate required fields
    if (!name || !provider || !model) {
      return NextResponse.json(
        { error: 'Missing required fields: name, provider, model' },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['ollama', 'openai', 'anthropic', 'google', 'custom'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `Invalid provider. Must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate neuronId
    const neuronId = `user-${user.userId}-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    // Get or create Neuron model
    const Neuron = mongoose.models.Neuron || mongoose.model('Neuron', NeuronSchema);

    // Check neuron limit (20 custom neurons per user)
    const userNeuronCount = await Neuron.countDocuments({ userId: user.userId });
    if (userNeuronCount >= 20) {
      return NextResponse.json(
        { error: 'Neuron limit reached (maximum 20 custom neurons per user)' },
        { status: 429 }
      );
    }

    // Create neuron document
    const neuronDoc = {
      neuronId,
      userId: user.userId,
      name,
      description: description || '',
      provider,
      endpoint: endpoint || '',
      model,
      apiKey: encryptApiKey(apiKey || ''),
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 4096,
      topP: topP,
      role: role || 'chat',
      tier: user.accountLevel || 4, // User's own neurons match their tier
      isDefault: false
    };

    const neuron = await Neuron.create(neuronDoc);

    return NextResponse.json({
      neuronId: neuron.neuronId,
      name: neuron.name,
      provider: neuron.provider,
      model: neuron.model,
      role: neuron.role,
      createdAt: neuron.createdAt
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API] Error creating neuron:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
