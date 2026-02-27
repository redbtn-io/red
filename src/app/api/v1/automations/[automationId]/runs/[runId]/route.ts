import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { AutomationRun } from '@/lib/database/models/automation';

interface RouteParams {
  params: Promise<{ automationId: string; runId: string }>;
}

/**
 * GET /api/v1/automations/[automationId]/runs/[runId]
 * Get specific run details
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

    const { automationId, runId } = await params;

    const run = await AutomationRun.findOne({
      runId,
      automationId,
      userId: user.userId
    }).lean();

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      run: {
        runId: run.runId,
        automationId: run.automationId,
        graphId: run.graphId,
        status: run.status,
        triggeredBy: run.triggeredBy,
        triggerData: run.triggerData,
        input: run.input,
        output: run.output,
        error: run.error,
        errorStack: run.errorStack,
        retryCount: run.retryCount,
        logs: run.logs,
        durationMs: run.durationMs,
        tokensUsed: run.tokensUsed,
        conversationId: run.conversationId,
        generationId: run.generationId,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        expiresAt: run.expiresAt
      }
    });

  } catch (error) {
    console.error('[Automations API] Error getting run:', error);
    return NextResponse.json(
      { error: 'Failed to get run' },
      { status: 500 }
    );
  }
}
