/**
 * @file /api/v1/libraries/[libraryId]/documents/route.ts
 * @description API routes for managing documents within a library
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
  name: string;
  access: 'private' | 'shared' | 'public';
  sharedWith?: Array<{
    userId: string;
    accessLevel: 'read' | 'write';
  }>;
  vectorCollection: string;
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  documents: Array<{
    documentId: string;
    title: string;
    sourceType: string;
    source?: string;
    mimeType?: string;
    fileSize?: number;
    chunkCount: number;
    charCount: number;
    addedAt: Date;
    addedBy?: string;
    metadata?: Record<string, unknown>;
  }>;
  documentCount: number;
  totalChunks: number;
  totalSize: number;
}

// --- Helper: Check write access ---
function hasWriteAccess(library: LibraryDocument, userId: string): boolean {
  if (library.userId === userId) return true;
  const shared = library.sharedWith?.find(s => s.userId === userId);
  return shared?.accessLevel === 'write';
}

// --- Helper: Generate document ID ---
function generateDocumentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `doc_${timestamp}_${random}`;
}

// --- POST: Add document(s) to library ---
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

    const { title, content, sourceType, source, mimeType, metadata } = body;

    // Validation
    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    if (!sourceType || !['file', 'url', 'text', 'api', 'conversation'].includes(sourceType)) {
      return NextResponse.json({ error: 'Valid sourceType required' }, { status: 400 });
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

    if (!hasWriteAccess(library, user.userId)) {
      return NextResponse.json({ error: 'Write access denied' }, { status: 403 });
    }

    // Check document limit per library (e.g., 500)
    if (library.documentCount >= 500) {
      return NextResponse.json(
        { error: 'Document limit reached (500 max per library)' },
        { status: 400 }
      );
    }

    // Initialize vector store
    const vectorStore = new VectorStoreManager();

    // Chunk and add to vector store
    const documentId = generateDocumentId();
    const charCount = content.length;
    
    let chunkCount = 0;
    try {
      // The VectorStoreManager handles chunking internally
      chunkCount = await vectorStore.addDocument(
        library.vectorCollection,
        content,
        {
          documentId,
          libraryId,
          title,
          source,
          sourceType,
          addedBy: user.userId,
          ...metadata,
        },
        {
          chunkSize: library.chunkSize,
          chunkOverlap: library.chunkOverlap,
        }
      );
    } catch (vectorError) {
      console.error('[Documents API] Vector store error:', vectorError);
      return NextResponse.json(
        { error: 'Failed to add to vector store', details: String(vectorError) },
        { status: 500 }
      );
    }

    // Add document metadata to library
    const newDocument = {
      documentId,
      title: title.trim(),
      sourceType,
      source: source?.trim(),
      mimeType,
      fileSize: Buffer.byteLength(content, 'utf8'),
      chunkCount,
      charCount,
      addedAt: new Date(),
      addedBy: user.userId,
      metadata: metadata || {},
    };

    await librariesCollection.updateOne(
      { libraryId },
      {
        $push: { documents: newDocument },
        $inc: { 
          documentCount: 1, 
          totalChunks: chunkCount,
          totalSize: newDocument.fileSize,
        },
        $set: { 
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log(`[Documents API] Added document ${documentId} to library ${libraryId} (${chunkCount} chunks)`);

    return NextResponse.json({
      success: true,
      document: {
        documentId,
        title: newDocument.title,
        chunkCount,
        charCount,
        addedAt: newDocument.addedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Documents API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add document' },
      { status: 500 }
    );
  }
}

// --- DELETE: Remove document from library ---
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId } = await params;
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');

    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
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

    if (!hasWriteAccess(library, user.userId)) {
      return NextResponse.json({ error: 'Write access denied' }, { status: 403 });
    }

    // Find the document to remove
    const docToRemove = library.documents.find(d => d.documentId === documentId);
    if (!docToRemove) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Remove from vector store
    const vectorStore = new VectorStoreManager();
    try {
      await vectorStore.deleteByFilter(library.vectorCollection, { documentId });
    } catch (vectorError) {
      console.error('[Documents API] Vector delete error:', vectorError);
      // Continue anyway - metadata removal is more important
    }

    // Remove document metadata from library
    await librariesCollection.updateOne(
      { libraryId },
      {
        $pull: { documents: { documentId } },
        $inc: { 
          documentCount: -1, 
          totalChunks: -docToRemove.chunkCount,
          totalSize: -(docToRemove.fileSize || 0),
        },
        $set: { 
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log(`[Documents API] Removed document ${documentId} from library ${libraryId}`);

    return NextResponse.json({ success: true, deleted: documentId });
  } catch (error) {
    console.error('[Documents API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
