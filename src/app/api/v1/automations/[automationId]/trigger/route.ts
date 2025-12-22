import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { 
  Automation,
  AutomationRun,
  RunStatus,
  TriggerType,
  generateRunId,
  calculateExpiresAt
} from '@/lib/database/models/automation';
import { getRed } from '@/lib/red';
import { Graph } from '@redbtn/ai';

interface RouteParams {
  params: Promise<{ automationId: string }>;
}

/**
 * POST /api/v1/automations/[automationId]/trigger
 * Manually trigger an automation
 * 
 * Request body:
 * {
 *   input?: Record<string, any>;  // Override input mapping
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    await connectToDatabase();
    
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { automationId } = await params;
    let body: Record<string, any> = {};
    
    try {
      body = await request.json();
    } catch {
      // Empty body is OK for manual trigger
    }

    const inputOverride = body.input || {};

    // Find automation
    const automation = await Automation.findOne({
      automationId,
      userId: user.userId
    });

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    if (!automation.isEnabled) {
      return NextResponse.json(
        { error: 'Automation is disabled' },
        { status: 400 }
      );
    }

    // Get graph
    const graph = await Graph.findOne({ graphId: automation.graphId });
    if (!graph) {
      return NextResponse.json(
        { error: 'Graph not found for this automation' },
        { status: 404 }
      );
    }

    // Create run record
    const runId = generateRunId();
    const startedAt = new Date();
    
    // Merge input mapping with override
    const input = {
      ...automation.inputMapping,
      ...inputOverride
    };

    // Create automation run
    const automationRun = await AutomationRun.create({
      runId,
      automationId: automation.automationId,
      graphId: automation.graphId,
      userId: user.userId,
      triggeredBy: TriggerType.MANUAL,
      triggerData: { triggeredBy: user.userId },
      input,
      status: RunStatus.RUNNING,
      startedAt,
      logs: [{
        timestamp: startedAt,
        level: 'info',
        message: 'Manual trigger initiated'
      }],
      expiresAt: calculateExpiresAt(30) // 30 day TTL
    });

    try {
      // Get Red instance and run
      const red = await getRed();

      const result = await red.run(input, {
        userId: user.userId,
        graphId: automation.graphId,
        automationId: automation.automationId,
        runId,
        skipConversation: true,
        triggerType: TriggerType.MANUAL
      });

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      // Update run as completed
      automationRun.status = RunStatus.COMPLETED;
      automationRun.completedAt = completedAt;
      automationRun.durationMs = durationMs;
      automationRun.output = result;
      automationRun.logs.push({
        timestamp: completedAt,
        level: 'info',
        message: `Run completed in ${durationMs}ms`
      });
      await automationRun.save();

      // Update automation stats
      await Automation.updateOne(
        { automationId },
        {
          $inc: {
            'stats.runCount': 1,
            'stats.successCount': 1
          },
          $set: { lastRunAt: completedAt }
        }
      );

      return NextResponse.json({
        success: true,
        run: {
          runId: automationRun.runId,
          automationId: automationRun.automationId,
          status: automationRun.status,
          input: automationRun.input,
          output: automationRun.output,
          durationMs: automationRun.durationMs,
          startedAt: automationRun.startedAt,
          completedAt: automationRun.completedAt
        }
      });

    } catch (runError: any) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      // Update run as failed
      automationRun.status = RunStatus.FAILED;
      automationRun.completedAt = completedAt;
      automationRun.durationMs = durationMs;
      automationRun.error = runError.message || 'Unknown error';
      automationRun.errorStack = runError.stack;
      automationRun.logs.push({
        timestamp: completedAt,
        level: 'error',
        message: `Run failed: ${runError.message}`,
        metadata: { stack: runError.stack }
      });
      await automationRun.save();

      // Update automation stats
      await Automation.updateOne(
        { automationId },
        {
          $inc: {
            'stats.runCount': 1,
            'stats.failureCount': 1
          },
          $set: {
            lastRunAt: completedAt,
            'stats.lastError': runError.message
          }
        }
      );

      return NextResponse.json({
        success: false,
        run: {
          runId: automationRun.runId,
          automationId: automationRun.automationId,
          status: automationRun.status,
          input: automationRun.input,
          error: automationRun.error,
          durationMs: automationRun.durationMs,
          startedAt: automationRun.startedAt,
          completedAt: automationRun.completedAt
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Automations API] Error triggering automation:', error);
    return NextResponse.json(
      { error: 'Failed to trigger automation' },
      { status: 500 }
    );
  }
}
