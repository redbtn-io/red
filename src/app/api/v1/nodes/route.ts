import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';
import { searchNodes, getAllTags } from '@redbtn/ai';
import { getUserNodePreferences } from '@/lib/database/models/UserNodePreferences';

/**
 * Helper to safely convert date to ISO string
 */
function toISOString(date: Date | string | undefined | null): string | undefined {
  if (!date) return undefined;
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  // Handle MongoDB date objects that aren't proper Date instances
  if (typeof date === 'object' && '$date' in date) {
    return new Date((date as { $date: string }).$date).toISOString();
  }
  return undefined;
}

/**
 * Node type information for Studio palette and Explore
 */
interface NodeTypeInfo {
  nodeId: string;
  name: string;
  description?: string;
  tags: string[];
  isSystem: boolean;
  isImmutable?: boolean;
  isPublic?: boolean;
  isOwned?: boolean;  // true if current user owns this node
  isSaved?: boolean;  // true if user has saved this node
  isFavorited?: boolean;  // true if user has favorited this node
  isArchived?: boolean;  // true if user has archived this node
  status?: string;  // active, abandoned, deleted
  parentNodeId?: string;  // source node if this is a clone
  ownerName?: string;
  creatorId?: string;  // original creator (for abandoned nodes)
  tier: number;
  icon?: string;
  color?: string;
  inputs: string[];
  outputs: string[];
  stats?: {
    usageCount: number;
    forkCount: number;
    lastUsedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Universal node document from MongoDB
 */
interface UniversalNodeDocument {
  nodeId: string;
  name: string;
  description?: string;
  tags?: string[];
  userId?: string;
  creatorId?: string;
  ownerName?: string;
  isSystem: boolean;
  isImmutable?: boolean;
  isPublic?: boolean;
  status?: string;
  parentNodeId?: string;
  stats?: {
    usageCount: number;
    forkCount: number;
    lastUsedAt?: Date;
  };
  metadata?: {
    icon?: string;
    color?: string;
    inputs?: string[];
    outputs?: string[];
  };
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * GET /api/v1/nodes
 * List and search node types for the Studio palette and Explore page
 * 
 * Query params:
 * - q: Text search query (searches name, description, tags)
 * - tags: Comma-separated list of tags to filter by
 * - owner: Filter by owner userId (use "me" for current user, "system" for system nodes)
 * - view: Special view filters ("saved", "favorited", "recent")
 * - sortBy: Sort field (name, createdAt, updatedAt, usageCount, forkCount, lastUsedAt)
 * - sortOrder: Sort direction (asc, desc)
 * - limit: Max results (default 50)
 * - offset: Pagination offset (default 0)
 * - includeSystem: Include system nodes (default true)
 * - includePublic: Include public nodes from other users (default true)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || undefined;
    const tagsParam = searchParams.get('tags');
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : undefined;
    const ownerParam = searchParams.get('owner');
    const view = searchParams.get('view'); // saved, favorited, recent
    const sortBy = (searchParams.get('sortBy') || 'name') as 'name' | 'createdAt' | 'updatedAt' | 'usageCount' | 'forkCount' | 'lastUsedAt';
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const includeSystem = searchParams.get('includeSystem') !== 'false';
    const includePublic = searchParams.get('includePublic') !== 'false';

    const userTier = user.accountLevel || 4;

    // Get user preferences for saved/favorited/archived status
    let userPrefs: { savedNodes?: string[]; favoritedNodes?: string[]; archivedNodes?: string[] } = {};
    try {
      userPrefs = await getUserNodePreferences(user.userId);
    } catch {
      // Preferences don't exist yet, that's fine
    }
    
    const savedSet = new Set(userPrefs.savedNodes || []);
    const favoritedSet = new Set(userPrefs.favoritedNodes || []);
    const archivedSet = new Set(userPrefs.archivedNodes || []);

    // Handle special view filters
    if (view === 'saved' || view === 'favorited' || view === 'recent' || view === 'archived') {
      const NodeModel = mongoose.models.Node;
      let nodeIds: string[] = [];
      
      if (view === 'saved') {
        nodeIds = userPrefs.savedNodes || [];
      } else if (view === 'favorited') {
        nodeIds = userPrefs.favoritedNodes || [];
      } else if (view === 'archived') {
        nodeIds = userPrefs.archivedNodes || [];
      } else if (view === 'recent') {
        const recentNodes = (userPrefs as { recentNodes?: { nodeId: string }[] }).recentNodes || [];
        nodeIds = recentNodes.slice(0, limit).map((r: { nodeId: string }) => r.nodeId);
      }
      
      if (nodeIds.length === 0) {
        return NextResponse.json({
          nodes: [],
          total: 0,
          availableTags: []
        }, { status: 200 });
      }
      
      const nodes = await NodeModel.find({ nodeId: { $in: nodeIds } }).lean() as unknown as UniversalNodeDocument[];
      
      const allNodes: NodeTypeInfo[] = nodes.map((node: UniversalNodeDocument) => {
        // Tags might be at top-level or in metadata (legacy)
        const tags = node.tags || (node.metadata as Record<string, unknown>)?.tags as string[] || [];
        return {
          nodeId: node.nodeId,
          name: node.name,
          description: node.description,
          tags,
          isSystem: node.isSystem,
          isImmutable: node.isImmutable,
          isPublic: node.isPublic,
          isOwned: node.userId === user.userId || node.creatorId === user.userId,
          isSaved: savedSet.has(node.nodeId),
          isFavorited: favoritedSet.has(node.nodeId),
          isArchived: archivedSet.has(node.nodeId),
          status: node.status || 'active',
          parentNodeId: node.parentNodeId,
          ownerName: node.ownerName || (node.isSystem ? 'System' : 'Unknown'),
          creatorId: node.creatorId,
          tier: node.isSystem ? 4 : userTier,
          icon: node.metadata?.icon || getIconForTags(tags),
          color: node.metadata?.color || getColorForTags(tags),
          inputs: node.metadata?.inputs || ['state'],
          outputs: node.metadata?.outputs || ['state'],
          stats: node.stats ? {
            usageCount: node.stats.usageCount,
            forkCount: node.stats.forkCount,
            lastUsedAt: toISOString(node.stats.lastUsedAt)
          } : undefined,
          createdAt: toISOString(node.createdAt),
          updatedAt: toISOString(node.updatedAt)
        };
      });
      
      // Maintain order for recent view
      if (view === 'recent') {
        const nodeMap = new Map(allNodes.map(n => [n.nodeId, n]));
        const orderedNodes = nodeIds.map(id => nodeMap.get(id)).filter(Boolean) as NodeTypeInfo[];
        return NextResponse.json({
          nodes: orderedNodes,
          total: orderedNodes.length,
          availableTags: await getAllTags(user.userId)
        }, { status: 200 });
      }
      
      return NextResponse.json({
        nodes: allNodes,
        total: allNodes.length,
        availableTags: await getAllTags(user.userId)
      }, { status: 200 });
    }

    // Build search options
    const searchOptions: Parameters<typeof searchNodes>[0] = {
      query,
      tags,
      userId: ownerParam === 'me' ? user.userId : ownerParam === 'system' ? undefined : user.userId,
      includeSystem: ownerParam === 'system' ? true : (ownerParam === 'me' ? false : includeSystem),
      includePublic: ownerParam === 'me' || ownerParam === 'system' ? false : includePublic,
      sortBy,
      sortOrder,
      limit,
      offset
    };

    // Special handling for owner filter
    if (ownerParam === 'system') {
      // Only system nodes
      searchOptions.userId = undefined;
      searchOptions.includePublic = false;
    }

    const { nodes, total } = await searchNodes(searchOptions);

    // Convert nodes to NodeTypeInfo format
    const allNodes: NodeTypeInfo[] = (nodes as UniversalNodeDocument[]).map((node: UniversalNodeDocument) => {
      // Tags might be at top-level or in metadata (legacy)
      const tags = node.tags || (node.metadata as Record<string, unknown>)?.tags as string[] || [];
      return {
        nodeId: node.nodeId,
        name: node.name,
        description: node.description,
        tags,
        isSystem: node.isSystem,
        isImmutable: node.isImmutable,
        isPublic: node.isPublic,
        isOwned: node.userId === user.userId || node.creatorId === user.userId,
        isSaved: savedSet.has(node.nodeId),
        isFavorited: favoritedSet.has(node.nodeId),
        isArchived: archivedSet.has(node.nodeId),
        status: node.status || 'active',
        parentNodeId: node.parentNodeId,
        ownerName: node.ownerName || (node.isSystem ? 'System' : 'Unknown'),
        creatorId: node.creatorId,
        tier: node.isSystem ? 4 : userTier,
        icon: node.metadata?.icon || getIconForTags(tags),
        color: node.metadata?.color || getColorForTags(tags),
        inputs: node.metadata?.inputs || ['state'],
        outputs: node.metadata?.outputs || ['state'],
        stats: node.stats ? {
          usageCount: node.stats.usageCount,
          forkCount: node.stats.forkCount,
          lastUsedAt: toISOString(node.stats.lastUsedAt)
        } : undefined,
        createdAt: toISOString(node.createdAt),
        updatedAt: toISOString(node.updatedAt)
      };
    });

    // Filter by tier access and exclude user-archived nodes (unless viewing archived)
    let accessibleNodes = allNodes.filter(n => n.tier >= userTier);
    
    // Filter out user-archived nodes from non-archived views
    accessibleNodes = accessibleNodes.filter(n => !archivedSet.has(n.nodeId));

    // Get all available tags for filter UI
    const availableTags = await getAllTags(user.userId);

    return NextResponse.json({
      nodes: accessibleNodes,
      total,
      offset,
      limit,
      availableTags
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
 * Helper: Get icon name based on tags
 */
function getIconForTags(tags: string[]): string {
  const iconMap: Record<string, string> = {
    routing: 'GitBranch',
    communication: 'MessageSquare',
    execution: 'Play',
    planning: 'ListTodo',
    transformation: 'Shuffle',
    tools: 'Wrench',
    infrastructure: 'Database',
    utility: 'Blocks',
    system: 'Settings',
    ai: 'Brain',
    search: 'Search',
    web: 'Globe'
  };
  for (const tag of tags) {
    if (iconMap[tag]) return iconMap[tag];
  }
  return 'Box';
}

/**
 * Helper: Get color based on tags
 */
function getColorForTags(tags: string[]): string {
  const colorMap: Record<string, string> = {
    routing: '#8B5CF6',
    communication: '#10B981',
    execution: '#EF4444',
    planning: '#EC4899',
    transformation: '#F59E0B',
    tools: '#3B82F6',
    infrastructure: '#6366F1',
    utility: '#6B7280',
    system: '#64748B',
    ai: '#8B5CF6',
    search: '#0EA5E9',
    web: '#14B8A6'
  };
  for (const tag of tags) {
    if (colorMap[tag]) return colorMap[tag];
  }
  return '#6B7280';
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
 *   steps: Array<{ type: string; config: object }>;
 *   metadata?: { icon?: string; color?: string; inputs?: string[]; outputs?: string[]; tags?: string[] };
 *   isPublic?: boolean; // Default true. Private nodes require PRO tier or better.
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
    const { nodeId, name, description, steps, metadata, isPublic, parameters } = body;
    // Tags can be at top level or in metadata for backward compatibility
    const tags: string[] = body.tags || metadata?.tags || [];

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
    const NodeModel = mongoose.models.Node || 
      mongoose.model('Node', new mongoose.Schema({
        nodeId: { type: String, required: true, unique: true },
        name: { type: String, required: true },
        description: String,
        tags: [String],
        userId: { type: String, required: true, index: true },
        isSystem: { type: Boolean, default: false },
        isPublic: { type: Boolean, default: true },
        steps: [mongoose.Schema.Types.Mixed],
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
      }));

    // Check if nodeId already exists for this user
    const existing = await NodeModel.findOne({ nodeId });
    if (existing) {
      return NextResponse.json(
        { error: 'A node with this ID already exists' },
        { status: 409 }
      );
    }

    // Determine node visibility
    // Private nodes are a paid feature (PRO tier = 2 or better)
    const userTier = user.accountLevel || 4; // Default to FREE tier
    const canCreatePrivateNodes = userTier <= 2; // ADMIN, ENTERPRISE, or PRO
    
    let nodeIsPublic = isPublic !== undefined ? isPublic : true; // Default to public
    
    // If user requested private but doesn't have the tier, force public
    if (!nodeIsPublic && !canCreatePrivateNodes) {
      // Silently default to public (could also return an error here)
      nodeIsPublic = true;
    }

    // Create the node
    const newNode = await NodeModel.create({
      nodeId,
      name,
      description: description || '',
      userId: user.userId,
      isSystem: false,
      isPublic: nodeIsPublic,
      steps,
      parameters: parameters || undefined,
      tags,
      metadata: {
        icon: metadata?.icon || getIconForTags(tags),
        color: metadata?.color || getColorForTags(tags),
        inputs: metadata?.inputs || ['state'],
        outputs: metadata?.outputs || ['state'],
      },
    });

    return NextResponse.json({
      nodeId: newNode.nodeId,
      name: newNode.name,
      description: newNode.description,
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
