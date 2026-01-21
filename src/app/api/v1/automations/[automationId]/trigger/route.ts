/**
 * Automation Trigger API v2
 *
 * Uses the run system with RunPublisher for clean execution.
 * No skipConversation hacks - automations don't use conversations.
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
import { getRed } from '@/lib/red';
import {
  Graph,
  run,
  isStreamingResult,
  type RunResult,
  type StreamingRunResult,
} from '@redbtn/redbtn';
import { createConnectionFetcher } from '@/lib/connections';

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
    const shouldStream = body.stream !== false; // Default to streaming

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
      status: RunStatus.RUNNING,
      startedAt,
      logs: [
        {
          timestamp: startedAt,
          level: 'info',
          message: 'Manual trigger initiated (v2)',
        },
      ],
      expiresAt: calculateExpiresAt(30), // 30 day TTL
    });

    // Get Red instance
    const red = await getRed();

    // Create connection fetcher for this user
    const connectionFetcher = createConnectionFetcher(user.userId);

    // Start run execution
    const result = await run(red, input, {
      userId: user.userId,
      graphId: automation.graphId,
      runId,
      stream: shouldStream,
      source: { application: 'automation' },
      connectionFetcher, // Provide connection access during graph execution
    });

    if (shouldStream && isStreamingResult(result)) {
      const streamingResult = result as StreamingRunResult;

      // Set up completion callback to update automation run
      streamingResult.completion
        .then(async (finalResult: RunResult) => {
          const completedAt = new Date();
          const durationMs = completedAt.getTime() - startedAt.getTime();

          // Update run as completed
          await AutomationRun.updateOne(
            { runId },
            {
              status: RunStatus.COMPLETED,
              completedAt,
              durationMs,
              output: {
                content: finalResult.content,
                data: finalResult.data,
                graphId: finalResult.graphId,
                graphName: finalResult.graphName,
                executionPath: finalResult.metadata.executionPath,
                nodesExecuted: finalResult.metadata.nodesExecuted,
              },
              $push: {
                logs: {
                  timestamp: completedAt,
                  level: 'info',
                  message: `Run completed in ${durationMs}ms`,
                },
              },
            }
          );

          // Update automation stats
          await Automation.updateOne(
            { automationId },
            {
              $inc: {
                'stats.runCount': 1,
                'stats.successCount': 1,
              },
              $set: { lastRunAt: completedAt },
            }
          );

          console.log(
            `[Automation v2] Run ${runId} completed successfully in ${durationMs}ms`
          );
        })
        .catch(async (error: Error) => {
          const completedAt = new Date();
          const durationMs = completedAt.getTime() - startedAt.getTime();

          // Update run as failed
          await AutomationRun.updateOne(
            { runId },
            {
              status: RunStatus.FAILED,
              completedAt,
              durationMs,
              error: error.message || 'Unknown error',
              errorStack: error.stack,
              $push: {
                logs: {
                  timestamp: completedAt,
                  level: 'error',
                  message: `Run failed: ${error.message}`,
                  metadata: { stack: error.stack },
                },
              },
            }
          );

          // Update automation stats
          await Automation.updateOne(
            { automationId },
            {
              $inc: {
                'stats.runCount': 1,
                'stats.failureCount': 1,
              },
              $set: {
                lastRunAt: completedAt,
                'stats.lastError': error.message,
              },
            }
          );

          console.error(`[Automation v2] Run ${runId} failed:`, error.message);
        });

      // Return immediately with run info for SSE subscription
      return NextResponse.json({
        success: true,
        runId: streamingResult.runId,
        streamUrl: `/api/v1/runs/${streamingResult.runId}/stream`,
        run: {
          runId: automationRun.runId,
          automationId: automationRun.automationId,
          graphId: automationRun.graphId,
          status: RunStatus.RUNNING,
          input: automationRun.input,
          startedAt: automationRun.startedAt,
        },
      });
    }

    // Non-streaming: wait for completion
    const finalResult = result as RunResult;
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Update run as completed
    await AutomationRun.updateOne(
      { runId },
      {
        status:
          finalResult.status === 'completed'
            ? RunStatus.COMPLETED
            : RunStatus.FAILED,
        completedAt,
        durationMs,
        output: {
          content: finalResult.content,
          data: finalResult.data,
          graphId: finalResult.graphId,
          graphName: finalResult.graphName,
          executionPath: finalResult.metadata.executionPath,
          nodesExecuted: finalResult.metadata.nodesExecuted,
        },
        error: finalResult.error,
        $push: {
          logs: {
            timestamp: completedAt,
            level: finalResult.status === 'completed' ? 'info' : 'error',
            message:
              finalResult.status === 'completed'
                ? `Run completed in ${durationMs}ms`
                : `Run failed: ${finalResult.error}`,
          },
        },
      }
    );

    // Update automation stats
    await Automation.updateOne(
      { automationId },
      {
        $inc: {
          'stats.runCount': 1,
          [`stats.${finalResult.status === 'completed' ? 'successCount' : 'failureCount'}`]: 1,
        },
        $set: {
          lastRunAt: completedAt,
          ...(finalResult.status === 'error' && {
            'stats.lastError': finalResult.error,
          }),
        },
      }
    );

    return NextResponse.json({
      success: finalResult.status === 'completed',
      runId: finalResult.runId,
      run: {
        runId: automationRun.runId,
        automationId: automationRun.automationId,
        graphId: automationRun.graphId,
        status:
          finalResult.status === 'completed'
            ? RunStatus.COMPLETED
            : RunStatus.FAILED,
        input: automationRun.input,
        output: {
          content: finalResult.content,
          data: finalResult.data,
        },
        startedAt: automationRun.startedAt,
        completedAt,
        durationMs,
        error: finalResult.error,
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
