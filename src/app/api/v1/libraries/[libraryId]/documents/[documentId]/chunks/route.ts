/**
 * @file /api/v1/libraries/[libraryId]/documents/[documentId]/chunks/route.ts
 * @description Get all chunks for a specific document
 */

import { NextRequest, NextResponse } from 'next/server';
import { VectorStoreManager } from '@redbtn/ai';
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
  documents: Array<{
    documentId: string;
    title: string;
    chunkCount: number;
  }>;
}

// --- Helper: Check read access ---
function hasReadAccess(library: LibraryDocument, userId: string): boolean {
  if (library.userId === userId) return true;
  if (library.access === 'public') return true;
  const shared = library.sharedWith?.find(s => s.userId === userId);
  return !!shared;
}

// --- GET: Get document chunks ---
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; documentId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId, documentId } = await params;

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

    // Verify document exists in library
    const doc = library.documents.find(d => d.documentId === documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Query ChromaDB for all chunks with this documentId using VectorStoreManager
    const vectorStore = new VectorStoreManager();
    
    const results = await vectorStore.getDocumentsByFilter(
      library.vectorCollection,
      { documentId: documentId }
    );

    // Format results
    const chunks: Array<{ id: string; text: string; chunkIndex: number; metadata: Record<string, unknown> }> = [];
    
    for (const result of results) {
      chunks.push({
        id: result.id,
        text: result.text,
        chunkIndex: (result.metadata?.chunkIndex as number) ?? 0,
        metadata: result.metadata,
      });
    }

    // Sort by chunk index
    chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

    console.log(`[Chunks API] Document ${documentId}: ${chunks.length} chunks retrieved`);

    return NextResponse.json({
      documentId,
      title: doc.title,
      chunks,
      count: chunks.length,
    });
  } catch (error) {
    console.error('[Chunks API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get document chunks', details: String(error) },
      { status: 500 }
    );
  }
}
