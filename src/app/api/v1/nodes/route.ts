import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

/**
 * Node type information for Studio palette
 */
interface NodeTypeInfo {
  nodeId: string;
  name: string;
  description?: string;
  category: string;
  isSystem: boolean;
  tier: number;
  icon?: string;
  color?: string;
  inputs: string[];
  outputs: string[];
}

/**
 * Universal node document from MongoDB
 */
interface UniversalNodeDocument {
  nodeId: string;
  name: string;
  description?: string;
  category?: string;
  isSystem: boolean;
  metadata?: {
    icon?: string;
    color?: string;
    tags?: string[];
    inputs?: string[];
    outputs?: string[];
  };
}

/**
 * GET /api/v1/nodes
 * List all available node types for the Studio palette
 * 
 * Returns universal nodes from MongoDB (universalnodeconfigs collection)
 * All nodes are now universal - no more hardcoded built-in nodes.
 * 
 * Query params:
 * - category: Filter by category
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

    // Get category filter
    const { searchParams } = new URL(request.url);
    const categoryFilter = searchParams.get('category');

    const userTier = user.accountLevel || 4;

    // Load universal nodes from MongoDB
    const UniversalNodeConfig = mongoose.models.UniversalNodeConfig || 
      mongoose.model('UniversalNodeConfig', new mongoose.Schema({
        nodeId: String,
        name: String,
        description: String,
        category: String,
        userId: String,
        isSystem: Boolean,
        steps: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed
      }));

    const mongoQuery: Record<string, unknown> = {
      $or: [
        { isSystem: true },
        { userId: user.userId }
      ]
    };

    const universalNodes = await UniversalNodeConfig.find(mongoQuery)
      .select('nodeId name description category isSystem metadata')
      .lean() as unknown as UniversalNodeDocument[];

    // Convert universal nodes to NodeTypeInfo format
    let allNodes: NodeTypeInfo[] = universalNodes.map((node: UniversalNodeDocument) => ({
      nodeId: node.nodeId,
      name: node.name,
      description: node.description,
      category: node.category || 'utility',
      isSystem: node.isSystem,
      tier: node.isSystem ? 4 : userTier,
      icon: node.metadata?.icon || getIconForCategory(node.category || 'utility'),
      color: node.metadata?.color || getColorForCategory(node.category || 'utility'),
      inputs: node.metadata?.inputs || ['state'],
      outputs: node.metadata?.outputs || ['state']
    }));

    // Filter by category if specified
    if (categoryFilter) {
      allNodes = allNodes.filter(n => n.category === categoryFilter);
    }

    // Filter by tier access
    allNodes = allNodes.filter(n => n.tier >= userTier);

    // Group by category
    const categories = ['routing', 'communication', 'execution', 'transformation', 'tools', 'infrastructure', 'utility'];
    const groupedNodes: Record<string, NodeTypeInfo[]> = {};
    
    for (const cat of categories) {
      const nodesInCategory = allNodes.filter(n => n.category === cat);
      if (nodesInCategory.length > 0) {
        groupedNodes[cat] = nodesInCategory;
      }
    }

    return NextResponse.json({
      nodes: allNodes,
      grouped: groupedNodes,
      total: allNodes.length,
      categories: Object.keys(groupedNodes)
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error listing node types:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get icon name for category
 */
function getIconForCategory(category: string): string {
  const iconMap: Record<string, string> = {
    routing: 'GitBranch',
    communication: 'MessageSquare',
    execution: 'Play',
    transformation: 'Shuffle',
    tools: 'Wrench',
    infrastructure: 'Database',
    utility: 'Blocks'
  };
  return iconMap[category] || 'Box';
}

/**
 * Helper: Get color for category
 */
function getColorForCategory(category: string): string {
  const colorMap: Record<string, string> = {
    routing: '#8B5CF6',
    communication: '#10B981',
    execution: '#EF4444',
    transformation: '#F59E0B',
    tools: '#3B82F6',
    infrastructure: '#6366F1',
    utility: '#6B7280'
  };
  return colorMap[category] || '#6B7280';
}

/**
 * POST /api/v1/nodes
 * Create a new universal node configuration
 * 
 * Request body:
 * {
 *   nodeId: string;
 *   name: string;
 *   description?: string;
 *   category?: string;
 *   steps: Array<{ type: string; config: object }>;
 *   metadata?: { icon?: string; color?: string; inputs?: string[]; outputs?: string[] };
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
    const { nodeId, name, description, category, steps, metadata } = body;

    // Validate required fields
    if (!nodeId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields: nodeId, name' },
        { status: 400 }
      );
    }

    if (!steps || !Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json(
        { error: 'At least one step is required' },
        { status: 400 }
      );
    }

    // Validate nodeId format
    if (!/^[a-z0-9-]+$/.test(nodeId)) {
      return NextResponse.json(
        { error: 'nodeId must contain only lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Get or create model
    const UniversalNodeConfig = mongoose.models.UniversalNodeConfig || 
      mongoose.model('UniversalNodeConfig', new mongoose.Schema({
        nodeId: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: String,
        category: { type: String, default: 'utility' },
        userId: { type: String, required: true, index: true },
        isSystem: { type: Boolean, default: false },
        steps: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }));

    // Check if nodeId already exists for this user
    const existing = await UniversalNodeConfig.findOne({ nodeId });
    if (existing) {
      return NextResponse.json(
        { error: 'A node with this ID already exists' },
        { status: 409 }
      );
    }

    // Create the node
    const newNode = await UniversalNodeConfig.create({
      nodeId,
      name,
      description: description || '',
      category: category || 'utility',
      userId: user.userId,
      isSystem: false,
      steps,
      metadata: {
        icon: metadata?.icon || getIconForCategory(category || 'utility'),
        color: metadata?.color || getColorForCategory(category || 'utility'),
        inputs: metadata?.inputs || ['state'],
        outputs: metadata?.outputs || ['state'],
        tags: metadata?.tags || [],
      },
    });

    return NextResponse.json({
      nodeId: newNode.nodeId,
      name: newNode.name,
      description: newNode.description,
      category: newNode.category,
      stepsCount: steps.length,
      createdAt: newNode.createdAt,
    }, { status: 201 });

  } catch (error: unknown) {
    console.error('[API] Error creating node:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
