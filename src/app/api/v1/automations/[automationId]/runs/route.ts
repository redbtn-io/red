import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { AutomationRun, RunStatus } from '@/lib/database/models/automation';

interface RouteParams {
  params: Promise<{ automationId: string }>;
}

/**
 * GET /api/v1/automations/[automationId]/runs
 * List runs for an automation
 * 
 * Query params:
 * - status?: RunStatus
 * - limit?: number (default 50)
 * - offset?: number (default 0)
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
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    const query: Record<string, any> = {
      automationId,
      userId: user.userId
    };

    if (status && Object.values(RunStatus).includes(status as RunStatus)) {
      query.status = status;
    }

    // Fetch runs
    const [runs, total] = await Promise.all([
      AutomationRun.find(query)
        .sort({ startedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      AutomationRun.countDocuments(query)
    ]);

    return NextResponse.json({
      success: true,
      runs: runs.map(r => ({
        runId: r.runId,
        automationId: r.automationId,
        status: r.status,
        triggeredBy: r.triggeredBy,
        input: r.input,
        output: r.output,
        error: r.error,
        durationMs: r.durationMs,
        startedAt: r.startedAt,
        completedAt: r.completedAt
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + runs.length < total
      }
    });

  } catch (error) {
    console.error('[Automations API] Error listing runs:', error);
    return NextResponse.json(
      { error: 'Failed to list runs' },
      { status: 500 }
    );
  }
}
