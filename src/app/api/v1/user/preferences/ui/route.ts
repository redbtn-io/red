import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/auth';
import { connectToDatabase } from '@/lib/database/mongodb';
import mongoose from 'mongoose';

// UI Preferences schema - stored in user_ui_preferences collection
const UIPreferencesSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, index: true },
  navOrder: { type: [String], default: null }, // Array of nav item hrefs in order
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const UIPreferences = mongoose.models.UIPreferences || 
  mongoose.model('UIPreferences', UIPreferencesSchema, 'user_ui_preferences');

/**
 * GET /api/v1/user/preferences/ui
 * Get user's UI preferences (nav order, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    
    const prefs = await UIPreferences.findOne({ userId: user.userId }).lean();
    
    return NextResponse.json({
      navOrder: prefs?.navOrder || null,
    });
  } catch (error) {
    console.error('[API] Error getting UI preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/user/preferences/ui
 * Update user's UI preferences
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { navOrder } = body;

    await connectToDatabase();
    
    await UIPreferences.findOneAndUpdate(
      { userId: user.userId },
      { 
        $set: { 
          navOrder: navOrder || null,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error updating UI preferences:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
