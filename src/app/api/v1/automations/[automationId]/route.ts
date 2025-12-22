import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { 
  Automation, 
  AutomationStatus,
  TriggerType
} from '@/lib/database/models/automation';

interface RouteParams {
  params: Promise<{ automationId: string }>;
}

/**
 * GET /api/v1/automations/[automationId]
 * Get automation details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();
    
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { automationId } = await params;

    const automation = await Automation.findOne({
      automationId,
      userId: user.userId
    }).lean();

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      automation: {
        automationId: automation.automationId,
        name: automation.name,
        description: automation.description,
        graphId: automation.graphId,
        trigger: automation.trigger,
        inputMapping: automation.inputMapping,
        outputActions: automation.outputActions,
        status: automation.status,
        isEnabled: automation.isEnabled,
        stats: automation.stats,
        lastRunAt: automation.lastRunAt,
        nextRunAt: automation.nextRunAt,
        createdAt: automation.createdAt,
        updatedAt: automation.updatedAt
      }
    });

  } catch (error) {
    console.error('[Automations API] Error getting automation:', error);
    return NextResponse.json(
      { error: 'Failed to get automation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/automations/[automationId]
 * Update automation
 * 
 * Request body (all optional):
 * {
 *   name?: string;
 *   description?: string;
 *   trigger?: { type: TriggerType; config?: object };
 *   inputMapping?: Record<string, any>;
 *   outputActions?: Array<{ type: string; config: object }>;
 *   isEnabled?: boolean;
 * }
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();
    
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { automationId } = await params;
    const body = await request.json();
    const { name, description, trigger, inputMapping, outputActions, isEnabled } = body;

    // Find automation
    const automation = await Automation.findOne({
      automationId,
      userId: user.userId
    });

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    // Build update object
    const updates: Record<string, any> = {};

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (inputMapping !== undefined) updates.inputMapping = inputMapping;
    if (outputActions !== undefined) updates.outputActions = outputActions;
    
    if (trigger !== undefined) {
      if (trigger.type && !Object.values(TriggerType).includes(trigger.type)) {
        return NextResponse.json(
          { error: `Invalid trigger type. Must be one of: ${Object.values(TriggerType).join(', ')}` },
          { status: 400 }
        );
      }
      updates.trigger = {
        type: trigger.type || automation.trigger.type,
        config: trigger.config !== undefined ? trigger.config : automation.trigger.config
      };
    }

    if (isEnabled !== undefined) {
      updates.isEnabled = isEnabled;
      updates.status = isEnabled ? AutomationStatus.ACTIVE : AutomationStatus.PAUSED;
    }

    // Apply updates
    Object.assign(automation, updates);
    await automation.save();

    return NextResponse.json({
      success: true,
      automation: {
        automationId: automation.automationId,
        name: automation.name,
        description: automation.description,
        graphId: automation.graphId,
        trigger: automation.trigger,
        inputMapping: automation.inputMapping,
        outputActions: automation.outputActions,
        status: automation.status,
        isEnabled: automation.isEnabled,
        stats: automation.stats,
        updatedAt: automation.updatedAt
      }
    });

  } catch (error) {
    console.error('[Automations API] Error updating automation:', error);
    return NextResponse.json(
      { error: 'Failed to update automation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/automations/[automationId]
 * Delete automation
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();
    
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { automationId } = await params;

    const result = await Automation.deleteOne({
      automationId,
      userId: user.userId
    });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Automation deleted successfully'
    });

  } catch (error) {
    console.error('[Automations API] Error deleting automation:', error);
    return NextResponse.json(
      { error: 'Failed to delete automation' },
      { status: 500 }
    );
  }
}
