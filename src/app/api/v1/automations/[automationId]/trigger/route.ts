/**
 * Automation Trigger API v2
 *
 * DISTRIBUTED ARCHITECTURE VERSION
 *
 * Offloads automation execution to BullMQ workers for horizontal scaling.
 * Creates an AutomationRun record, then submits job to worker queue.
 *
 * @module api/v1/automations/[automationId]/trigger
 */

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
  calculateExpiresAt,
} from '@/lib/database/models/automation';
import { Graph } from '@redbtn/redbtn';
import { submitAutomationJob, initializeRunState } from '@/lib/queue';

interface RouteParams {
  params: Promise<{ automationId: string }>;
}

/**
 * POST /api/v1/automations/[automationId]/trigger
 * Manually trigger an automation using run
 *
 * Request body:
 * {
 *   input?: Record<string, any>;  // Override input mapping
 *   stream?: boolean;             // Whether to stream (default: true)
 * }
 *
 * Response:
 * {
 *   success: true,
 *   runId: string,              // For SSE subscription
 *   streamUrl: string,          // SSE endpoint URL
 *   run: { ... }                // Run details
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
    // Note: In distributed mode, streaming is always enabled (SSE-first)
    // The body.stream option is ignored

    // Find automation
    const automation = await Automation.findOne({
      automationId,
      userId: user.userId,
    }).lean();

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    if (!automation.isEnabled) {
      return NextResponse.json(
        { error: 'Automation is disabled' },
        { status: 400 }
      );
    }

    // Verify graph exists
    const graph = await Graph.findOne({ graphId: automation.graphId });
    if (!graph) {
      return NextResponse.json(
        { error: 'Graph not found for this automation' },
        { status: 404 }
      );
    }

    // Create run record (use provided runId if available, for SSE-first flow)
    const runId = typeof body.runId === 'string' ? body.runId : generateRunId();
    const startedAt = new Date();

    // Merge input mapping with override
    const input = {
      ...(automation.inputMapping || {}),
      ...inputOverride,
    };

    // Create automation run document
    const automationRun = await AutomationRun.create({
      runId,
      automationId: automation.automationId,
      graphId: automation.graphId,
      userId: user.userId,
      triggeredBy: TriggerType.MANUAL,
      triggerData: { triggeredBy: user.userId },
      input,
      status: RunStatus.QUEUED,
      startedAt,
      logs: [
        {
          timestamp: startedAt,
          level: 'info',
          message: 'Manual trigger initiated (distributed)',
        },
      ],
      expiresAt: calculateExpiresAt(30), // 30 day TTL
    });

    console.log(`[Automation] ${new Date().toISOString()} Submitting job runId=${runId}`);

    // Initialize run state in Redis (allows SSE to connect immediately)
    await initializeRunState({
      runId,
      userId: user.userId,
      graphId: automation.graphId,
      graphName: graph.name || 'Automation Graph',
      input,
      // No conversationId for automations
    });

    // Submit job to worker queue
    await submitAutomationJob({
      runId,
      automationId: automation.automationId,
      userId: user.userId,
      triggerType: 'manual',
      input,
    });

    console.log(`[Automation] ${new Date().toISOString()} Job submitted to queue`);

    // Return immediately with run info for SSE subscription
    return NextResponse.json({
      success: true,
      runId,
      streamUrl: `/api/v1/runs/${runId}/stream`,
      run: {
        runId: automationRun.runId,
        automationId: automationRun.automationId,
        graphId: automationRun.graphId,
        status: RunStatus.QUEUED,
        input: automationRun.input,
        startedAt: automationRun.startedAt,
      },
    });
  } catch (error: any) {
    console.error(
      '[Automations API v2] Error triggering automation:',
      error?.message || error
    );
    console.error('[Automations API v2] Stack:', error?.stack);
    return NextResponse.json(
      { error: 'Failed to trigger automation', details: error?.message },
      { status: 500 }
    );
  }
}
