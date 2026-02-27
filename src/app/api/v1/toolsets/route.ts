import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

/**
 * ToolSet Schema - Groups of tools that can be referenced by nodes
 */
const ToolSetSchema = new mongoose.Schema({
  toolSetId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'wrench' },
  color: { type: String, default: '#3B82F6' },
  tools: [{ type: String }], // Array of tool names
  isSystem: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Create indexes
ToolSetSchema.index({ userId: 1, name: 1 }, { unique: true });

const ToolSet = mongoose.models.ToolSet || mongoose.model('ToolSet', ToolSetSchema);

interface ToolSetDocument {
  toolSetId: string;
  userId: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  tools: string[];
  isSystem: boolean;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * GET /api/v1/toolsets
 * List all toolsets accessible to the user
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();

    // Get user's toolsets and public/system toolsets
    const toolsets = await ToolSet.find({
      $or: [
        { userId: user.userId },
        { isPublic: true },
        { isSystem: true },
      ],
    }).sort({ name: 1 }).lean() as ToolSetDocument[];

    return NextResponse.json({
      success: true,
      count: toolsets.length,
      toolsets: toolsets.map(ts => ({
        toolSetId: ts.toolSetId,
        name: ts.name,
        description: ts.description,
        icon: ts.icon,
        color: ts.color,
        tools: ts.tools,
        toolCount: ts.tools.length,
        isSystem: ts.isSystem,
        isPublic: ts.isPublic,
        isOwned: ts.userId === user.userId,
        createdAt: ts.createdAt,
        updatedAt: ts.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[GET /api/v1/toolsets] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch toolsets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/toolsets
 * Create a new toolset
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, tools } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!tools || !Array.isArray(tools)) {
      return NextResponse.json({ error: 'Tools array is required' }, { status: 400 });
    }

    await connectToDatabase();

    // Check for duplicate name
    const existing = await ToolSet.findOne({ userId: user.userId, name: name.trim() });
    if (existing) {
      return NextResponse.json({ error: 'A toolset with this name already exists' }, { status: 409 });
    }

    // Generate unique ID
    const toolSetId = `toolset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const toolset = await ToolSet.create({
      toolSetId,
      userId: user.userId,
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon || 'wrench',
      color: color || '#3B82F6',
      tools: tools.filter((t: unknown) => typeof t === 'string'),
      isSystem: false,
      isPublic: false,
    });

    return NextResponse.json({
      success: true,
      toolset: {
        toolSetId: toolset.toolSetId,
        name: toolset.name,
        description: toolset.description,
        icon: toolset.icon,
        color: toolset.color,
        tools: toolset.tools,
        toolCount: toolset.tools.length,
        isSystem: toolset.isSystem,
        isPublic: toolset.isPublic,
        isOwned: true,
        createdAt: toolset.createdAt,
        updatedAt: toolset.updatedAt,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/v1/toolsets] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create toolset' },
      { status: 500 }
    );
  }
}
