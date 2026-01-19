import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import mongoose from 'mongoose';

const ToolSetSchema = new mongoose.Schema({
  toolSetId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'wrench' },
  color: { type: String, default: '#3B82F6' },
  tools: [{ type: String }],
  isSystem: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ToolSet = mongoose.models.ToolSet || mongoose.model('ToolSet', ToolSetSchema);

interface RouteParams {
  params: Promise<{ toolSetId: string }>;
}

/**
 * GET /api/v1/toolsets/[toolSetId]
 * Get a specific toolset
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toolSetId } = await params;
    await connectToDatabase();

    const toolset = await ToolSet.findOne({
      toolSetId,
      $or: [
        { userId: user.userId },
        { isPublic: true },
        { isSystem: true },
      ],
    }).lean();

    if (!toolset) {
      return NextResponse.json({ error: 'Toolset not found' }, { status: 404 });
    }

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
        isOwned: toolset.userId === user.userId,
        createdAt: toolset.createdAt,
        updatedAt: toolset.updatedAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/v1/toolsets/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch toolset' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/toolsets/[toolSetId]
 * Update a toolset
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toolSetId } = await params;
    const body = await request.json();
    const { name, description, icon, color, tools, isPublic } = body;

    await connectToDatabase();

    // Find toolset - must be owned by user
    const toolset = await ToolSet.findOne({ toolSetId, userId: user.userId });
    if (!toolset) {
      return NextResponse.json({ error: 'Toolset not found or not owned' }, { status: 404 });
    }

    // Can't edit system toolsets
    if (toolset.isSystem) {
      return NextResponse.json({ error: 'Cannot edit system toolsets' }, { status: 403 });
    }

    // Check for duplicate name (excluding current)
    if (name && name !== toolset.name) {
      const existing = await ToolSet.findOne({ 
        userId: user.userId, 
        name: name.trim(),
        toolSetId: { $ne: toolSetId },
      });
      if (existing) {
        return NextResponse.json({ error: 'A toolset with this name already exists' }, { status: 409 });
      }
    }

    // Update fields
    if (name !== undefined) toolset.name = name.trim();
    if (description !== undefined) toolset.description = description.trim();
    if (icon !== undefined) toolset.icon = icon;
    if (color !== undefined) toolset.color = color;
    if (tools !== undefined) toolset.tools = tools.filter((t: unknown) => typeof t === 'string');
    if (isPublic !== undefined) toolset.isPublic = isPublic;
    toolset.updatedAt = new Date();

    await toolset.save();

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
    });
  } catch (error) {
    console.error('[PUT /api/v1/toolsets/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update toolset' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/toolsets/[toolSetId]
 * Delete a toolset
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { toolSetId } = await params;
    await connectToDatabase();

    // Find toolset - must be owned by user
    const toolset = await ToolSet.findOne({ toolSetId, userId: user.userId });
    if (!toolset) {
      return NextResponse.json({ error: 'Toolset not found or not owned' }, { status: 404 });
    }

    // Can't delete system toolsets
    if (toolset.isSystem) {
      return NextResponse.json({ error: 'Cannot delete system toolsets' }, { status: 403 });
    }

    await ToolSet.deleteOne({ toolSetId });

    return NextResponse.json({
      success: true,
      message: 'Toolset deleted',
    });
  } catch (error) {
    console.error('[DELETE /api/v1/toolsets/:id] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete toolset' },
      { status: 500 }
    );
  }
}
