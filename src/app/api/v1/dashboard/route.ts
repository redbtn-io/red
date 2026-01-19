import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { Graph } from '@redbtn/redbtn';
import { Conversation } from '@/lib/database/models/conversation';
import { Automation, AutomationRun } from '@/lib/database/models/automation';
import User from '@/lib/database/models/auth/User';

/**
 * GET /api/v1/dashboard
 * Returns dashboard data for the user's home page
 * 
 * Includes:
 * - User stats (conversations, graphs, automations)
 * - Recent activity
 * - Available agent graphs for quick access
 * - Automation status overview
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await rateLimitAPI(request, RateLimits.STANDARD);
  if (rateLimitResult) return rateLimitResult;

  try {
    // Ensure database connection
    await connectToDatabase();
    
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userTier = user.accountLevel || 4;

    // Fetch data in parallel
    const [
      conversationCount,
      recentConversations,
      systemGraphs,
      userGraphs,
      automations,
      recentRuns,
      fullUser,
    ] = await Promise.all([
      // Total conversation count
      Conversation.countDocuments({ userId: user.userId }),
      
      // Recent conversations (last 5)
      Conversation.find({ userId: user.userId })
        .select('title updatedAt messages')
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean(),
      
      // System graphs accessible by tier (agent type only)
      Graph.find({
        userId: 'system',
        tier: { $gte: userTier },
        graphType: { $in: ['agent', undefined] }, // Include undefined for backwards compatibility
      })
        .select('graphId name description tier graphType isDefault')
        .sort({ isDefault: -1, name: 1 })
        .lean(),
      
      // User's custom graphs (agent type)
      Graph.find({
        userId: user.userId,
        graphType: { $in: ['agent', undefined] },
      })
        .select('graphId name description tier graphType')
        .sort({ createdAt: -1 })
        .lean(),
      
      // User's automations
      Automation.find({ userId: user.userId })
        .select('automationId name isEnabled stats lastRunAt')
        .sort({ createdAt: -1 })
        .lean(),
      
      // Recent automation runs (last 10)
      AutomationRun.find({ userId: user.userId })
        .select('runId automationId status durationMs startedAt')
        .sort({ startedAt: -1 })
        .limit(10)
        .lean(),
      
      // Fetch full user for preferences
      User.findById(user.userId).select('defaultGraphId').lean() as Promise<{ defaultGraphId?: string } | null>,
    ]);

    // Calculate stats
    const totalGraphs = systemGraphs.length + userGraphs.length;
    const activeAutomations = automations.filter((a) => a.isEnabled).length;
    const totalRuns = automations.reduce((sum, a) => sum + (a.stats?.runCount || 0), 0);
    const successfulRuns = automations.reduce((sum, a) => sum + (a.stats?.successCount || 0), 0);
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

    // Get user's preferred default graph
    const userDefaultGraphId = fullUser?.defaultGraphId || 'red-assistant';

    // Combine and format graphs for selection
    const availableAgents = [
      ...systemGraphs.map((g: any) => ({
        graphId: g.graphId,
        name: g.name,
        description: g.description,
        isSystem: true,
        isDefault: g.graphId === userDefaultGraphId,
      })),
      ...userGraphs.map((g: any) => ({
        graphId: g.graphId,
        name: g.name,
        description: g.description,
        isSystem: false,
        isDefault: g.graphId === userDefaultGraphId,
      })),
    ];

    // Format recent conversations
    const formattedConversations = recentConversations.map((c: any) => ({
      id: c._id?.toString() || c.id,
      title: c.title || 'Untitled',
      updatedAt: c.updatedAt,
      messageCount: c.messages?.length || c.metadata?.messageCount || 0,
    }));

    // Format automation summary
    const automationSummary = automations.slice(0, 5).map((a: any) => ({
      id: a.automationId,
      name: a.name,
      isEnabled: a.isEnabled,
      runCount: a.stats?.runCount || 0,
      successCount: a.stats?.successCount || 0,
      lastRunAt: a.lastRunAt,
    }));

    // Get automation IDs for filtering orphaned runs
    const automationIds = new Set(automations.map((a: any) => a.automationId));

    return NextResponse.json({
      stats: {
        conversations: conversationCount,
        graphs: totalGraphs,
        automations: automations.length,
        activeAutomations,
        totalRuns,
        successRate,
      },
      recentConversations: formattedConversations,
      availableAgents,
      automationSummary,
      recentRuns: recentRuns
        .filter((r: any) => automationIds.has(r.automationId)) // Filter out orphaned runs
        .map((r: any) => {
          // Find automation name
          const automation = automations.find((a: any) => a.automationId === r.automationId);
          return {
            id: r.runId,
            automationId: r.automationId,
            automationName: automation?.name || 'Deleted',
            status: r.status,
            durationMs: r.durationMs,
            startedAt: r.startedAt,
          };
        }),
      user: {
        name: user.email.split('@')[0], // Use email prefix as fallback name
        email: user.email,
        tier: userTier,
      },
    });

  } catch (error: unknown) {
    console.error('[API] Error fetching dashboard:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
