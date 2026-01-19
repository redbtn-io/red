import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { 
  Automation, 
  TriggerType, 
  AutomationStatus, 
  generateAutomationId 
} from '@/lib/database/models/automation';
import { Graph } from '@redbtn/redbtn';

/**
 * POST /api/v1/automations
 * Create a new automation
 * 
 * Request body:
 * {
 *   name: string;
 *   description?: string;
 *   graphId: string;
 *   trigger: { type: TriggerType; config?: object };
 *   inputMapping?: Record<string, any>;
 *   outputActions?: Array<{ type: string; config: object }>;
 * }
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();
    
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, graphId, trigger, inputMapping, outputActions } = body;

    // Validate required fields
    if (!name || !graphId || !trigger?.type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, graphId, trigger.type' },
        { status: 400 }
      );
    }

    // Validate trigger type
    if (!Object.values(TriggerType).includes(trigger.type)) {
      return NextResponse.json(
        { error: `Invalid trigger type. Must be one of: ${Object.values(TriggerType).join(', ')}` },
        { status: 400 }
      );
    }

    // Verify graph exists and user has access
    const graph = await Graph.findOne({ graphId });
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    // Automations can only use workflow graphs, not agent graphs
    if (graph.graphType !== 'workflow') {
      return NextResponse.json(
        { error: 'Automations can only use workflow graphs. Agent graphs are designed for interactive chat and cannot be used in automations.' },
        { status: 400 }
      );
    }

    // Check graph ownership or if it's a public/default graph
    if (graph.userId && graph.userId !== user.userId && !graph.isDefault) {
      return NextResponse.json(
        { error: 'You do not have access to this graph' },
        { status: 403 }
      );
    }

    // Check automation limit (20 automations per user)
    const userAutomationCount = await Automation.countDocuments({ userId: user.userId });
    if (userAutomationCount >= 20) {
      return NextResponse.json(
        { error: 'Automation limit reached (maximum 20 automations per user)' },
        { status: 429 }
      );
    }

    // Build automation document
    const automationId = generateAutomationId();
    const automationDoc = {
      automationId,
      userId: user.userId,
      name,
      description: description || '',
      graphId,
      trigger: {
        type: trigger.type,
        config: trigger.config || {}
      },
      inputMapping: inputMapping || {},
      outputActions: outputActions || [],
      status: AutomationStatus.ACTIVE,
      isEnabled: true,
      stats: {
        runCount: 0,
        successCount: 0,
        failureCount: 0
      }
    };

    const automation = await Automation.create(automationDoc);

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
        createdAt: automation.createdAt
      }
    }, { status: 201 });

  } catch (error) {
    console.error('[Automations API] Error creating automation:', error);
    return NextResponse.json(
      { error: 'Failed to create automation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/automations
 * List user's automations
 * 
 * Query params:
 * - status?: 'active' | 'paused' | 'disabled' | 'error'
 * - triggerType?: TriggerType
 * - limit?: number (default 50)
 * - offset?: number (default 0)
 */
export async function GET(request: NextRequest) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();
    
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const triggerType = searchParams.get('triggerType');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    const query: Record<string, any> = { userId: user.userId };
    
    if (status && Object.values(AutomationStatus).includes(status as AutomationStatus)) {
      query.status = status;
    }
    
    if (triggerType && Object.values(TriggerType).includes(triggerType as TriggerType)) {
      query['trigger.type'] = triggerType;
    }

    // Fetch automations
    const [automations, total] = await Promise.all([
      Automation.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      Automation.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      automations: automations.map(a => ({
        automationId: a.automationId,
        name: a.name,
        description: a.description,
        graphId: a.graphId,
        trigger: a.trigger,
        status: a.status,
        isEnabled: a.isEnabled,
        stats: a.stats,
        lastRunAt: a.lastRunAt,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + automations.length < total
      }
    });

  } catch (error) {
    console.error('[Automations API] Error listing automations:', error);
    return NextResponse.json(
      { error: 'Failed to list automations' },
      { status: 500 }
    );
  }
}
