import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import { Automation, AutomationStatus } from '@/lib/database/models/automation';

interface RouteParams {
  params: Promise<{ automationId: string }>;
}

/**
 * POST /api/v1/automations/[automationId]/enable
 * Enable an automation
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

    const automation = await Automation.findOneAndUpdate(
      { automationId, userId: user.userId },
      {
        $set: {
          isEnabled: true,
          status: AutomationStatus.ACTIVE
        }
      },
      { new: true }
    );

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      automation: {
        automationId: automation.automationId,
        name: automation.name,
        isEnabled: automation.isEnabled,
        status: automation.status
      }
    });

  } catch (error) {
    console.error('[Automations API] Error enabling automation:', error);
    return NextResponse.json(
      { error: 'Failed to enable automation' },
      { status: 500 }
    );
  }
}
