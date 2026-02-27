import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { rateLimitAPI } from '@/lib/rate-limit/rate-limit-helpers';
import { RateLimits } from '@/lib/rate-limit/rate-limit';
import connectToDatabase from '@/lib/database/mongodb';
import {
  getUserNodePreferences,
  saveNodeForUser,
  unsaveNodeForUser,
  favoriteNodeForUser,
  unfavoriteNodeForUser,
  updateViewPreferences
} from '@/lib/database/models/UserNodePreferences';

/**
 * GET /api/v1/nodes/preferences
 * Get user's node preferences (saved, favorited nodes, view settings)
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

    const preferences = await getUserNodePreferences(user.userId);

    return NextResponse.json({
      savedNodes: preferences.savedNodes || [],
      favoritedNodes: preferences.favoritedNodes || [],
      recentNodes: preferences.recentNodes || [],
      tagPreferences: preferences.tagPreferences || { pinnedTags: [], hiddenTags: [] },
      viewPreferences: preferences.viewPreferences || {
        defaultSortBy: 'name',
        defaultSortOrder: 'asc',
        showSystemNodes: true,
        showPublicNodes: true
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error('[API] Error getting node preferences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/nodes/preferences
 * Update user's node preferences
 * 
 * Request body:
 * {
 *   action: 'save' | 'unsave' | 'favorite' | 'unfavorite' | 'updateView';
 *   nodeId?: string;  // required for save/unsave/favorite/unfavorite
 *   viewPreferences?: { ... };  // required for updateView
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
    const { action, nodeId, viewPreferences } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'save':
        if (!nodeId) {
          return NextResponse.json({ error: 'Missing nodeId' }, { status: 400 });
        }
        await saveNodeForUser(user.userId, nodeId);
        return NextResponse.json({ success: true, action: 'saved', nodeId }, { status: 200 });

      case 'unsave':
        if (!nodeId) {
          return NextResponse.json({ error: 'Missing nodeId' }, { status: 400 });
        }
        await unsaveNodeForUser(user.userId, nodeId);
        return NextResponse.json({ success: true, action: 'unsaved', nodeId }, { status: 200 });

      case 'favorite':
        if (!nodeId) {
          return NextResponse.json({ error: 'Missing nodeId' }, { status: 400 });
        }
        await favoriteNodeForUser(user.userId, nodeId);
        return NextResponse.json({ success: true, action: 'favorited', nodeId }, { status: 200 });

      case 'unfavorite':
        if (!nodeId) {
          return NextResponse.json({ error: 'Missing nodeId' }, { status: 400 });
        }
        await unfavoriteNodeForUser(user.userId, nodeId);
        return NextResponse.json({ success: true, action: 'unfavorited', nodeId }, { status: 200 });

      case 'updateView':
        if (!viewPreferences) {
          return NextResponse.json({ error: 'Missing viewPreferences' }, { status: 400 });
        }
        await updateViewPreferences(user.userId, viewPreferences);
        return NextResponse.json({ success: true, action: 'viewUpdated' }, { status: 200 });

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error: unknown) {
    console.error('[API] Error updating node preferences:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', message: errorMessage },
      { status: 500 }
    );
  }
}
