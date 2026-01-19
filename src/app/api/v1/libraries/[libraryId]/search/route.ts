/**
 * @file /api/v1/libraries/[libraryId]/search/route.ts
 * @description Semantic search within a library's documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { VectorStoreManager } from '@redbtn/redbtn';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/database/mongodb';

// --- Type Definitions ---

interface LibraryDocument {
  libraryId: string;
  userId: string;
  access: 'private' | 'shared' | 'public';
  sharedWith?: Array<{
    userId: string;
    accessLevel: 'read' | 'write';
  }>;
  vectorCollection: string;
  searchCount: number;
  lastSearchAt?: Date;
}

// --- Helper: Check read access ---
function hasReadAccess(library: LibraryDocument, userId: string): boolean {
  if (library.userId === userId) return true;
  if (library.access === 'public') return true;
  const shared = library.sharedWith?.find(s => s.userId === userId);
  return !!shared;
}

// --- POST: Search library ---
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId } = await params;
    const body = await request.json();

    const { 
      query, 
      limit = 10, 
      threshold = 0.7,
      filter,
      includeMetadata = true,
    } = body;

    // Validation
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    if (query.length > 2000) {
      return NextResponse.json({ error: 'Query too long (max 2000 chars)' }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    // Get library and check access
    const library = await librariesCollection.findOne({ libraryId });

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    if (!hasReadAccess(library, user.userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Perform vector search
    const vectorStore = new VectorStoreManager();
    
    const startTime = Date.now();
    const results = await vectorStore.search(
      library.vectorCollection,
      query,
      {
        topK: Math.min(limit, 50), // Max 50 results
        threshold: Math.max(0, Math.min(1, threshold)), // Clamp 0-1
        filter,
        includeEmbeddings: false,
      }
    );
    const searchTime = Date.now() - startTime;

    // Update search stats
    await librariesCollection.updateOne(
      { libraryId },
      {
        $inc: { searchCount: 1 },
        $set: { lastSearchAt: new Date() },
      }
    );

    console.log(`[Search API] Library ${libraryId}: "${query.slice(0, 50)}..." -> ${results.length} results in ${searchTime}ms`);

    // Format results
    const formattedResults = results.map(r => ({
      id: r.id,
      text: r.text,
      score: Math.round(r.score * 1000) / 1000, // 3 decimal places
      ...(includeMetadata ? { metadata: r.metadata } : {}),
    }));

    return NextResponse.json({
      query,
      results: formattedResults,
      count: results.length,
      searchTime,
      libraryId,
    });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}
