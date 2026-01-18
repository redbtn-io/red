/**
 * API endpoint to get logging system stats
 * GET /api/v1/logs/stats
 * 
 * Returns statistics about the logging system
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRed, getDatabase } from '@/lib/red';
import { LogEntry } from '@redbtn/ai';
import { verifyAuth } from '@/lib/auth/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    
    if (conversationId) {
      // Verify ownership
      const db = getDatabase();
      const conversation = await db.getConversation(conversationId);
      if (conversation?.userId && conversation.userId !== user.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const red = await getRed();
      
      // Stats for a specific conversation
      const logs = await red.logger.getConversationLogs(conversationId);
      const state = await red.logger.getConversationGenerationState(conversationId);
      
      // Count by level
      const byLevel = logs.reduce((acc: Record<string, number>, log: LogEntry) => {
        acc[log.level] = (acc[log.level] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Count by category
      const byCategory = logs.reduce((acc: Record<string, number>, log: LogEntry) => {
        acc[log.category] = (acc[log.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return NextResponse.json({
        conversationId,
        totalLogs: logs.length,
        generationCount: state?.generationCount || 0,
        isGenerating: !!state?.currentGenerationId,
        byLevel,
        byCategory,
      });
    }
    
    // Global stats would require scanning all Redis keys
    // For now, return minimal info
    return NextResponse.json({
      status: 'operational',
      message: 'Logging system is running. Provide conversationId for detailed stats.',
    });
  } catch (error) {
    console.error('[API] Error fetching logging stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
