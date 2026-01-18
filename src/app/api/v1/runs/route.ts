/**
 * Runs API - List all graph runs for the current user
 * 
 * GET /api/v1/runs
 * 
 * Query params:
 * - status: Filter by status (pending, running, completed, error)
 * - graphId: Filter by graph ID
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import Redis from 'ioredis';

export const dynamic = 'force-dynamic';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface RunSummary {
  runId: string;
  graphId: string;
  graphName: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  conversationId?: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  nodesExecuted: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  // Verify authentication
  const user = await verifyAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = searchParams.get('status');
  const graphIdFilter = searchParams.get('graphId');
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  let redis: Redis | null = null;

  try {
    redis = new Redis(REDIS_URL);

    // Get all run IDs for this user
    const userRunsKey = `run:user:${user.userId}`;
    const runIds = await redis.smembers(userRunsKey);

    if (runIds.length === 0) {
      return NextResponse.json({
        runs: [],
        total: 0,
        limit,
        offset,
      });
    }

    // Fetch run states in parallel (batch)
    const runs: RunSummary[] = [];
    
    // Use pipeline for efficiency
    const pipeline = redis.pipeline();
    for (const runId of runIds) {
      pipeline.get(`run:${runId}`);
    }
    const results = await pipeline.exec();

    for (let i = 0; i < runIds.length; i++) {
      const result = results?.[i];
      if (result && result[1]) {
        try {
          const state = JSON.parse(result[1] as string);
          
          // Apply filters
          if (statusFilter && state.status !== statusFilter) continue;
          if (graphIdFilter && state.graphId !== graphIdFilter) continue;

          runs.push({
            runId: state.runId,
            graphId: state.graphId,
            graphName: state.graphName,
            status: state.status,
            conversationId: state.conversationId,
            startedAt: state.startedAt,
            completedAt: state.completedAt,
            duration: state.completedAt ? state.completedAt - state.startedAt : undefined,
            nodesExecuted: state.graph?.nodesExecuted || 0,
            error: state.error,
          });
        } catch {
          // Skip malformed entries
        }
      }
    }

    // Sort by startedAt descending (most recent first)
    runs.sort((a, b) => b.startedAt - a.startedAt);

    // Apply pagination
    const paginatedRuns = runs.slice(offset, offset + limit);

    return NextResponse.json({
      runs: paginatedRuns,
      total: runs.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[Runs API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch runs' },
      { status: 500 }
    );
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
