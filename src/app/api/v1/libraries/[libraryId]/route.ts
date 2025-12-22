/**
 * @file /api/v1/libraries/[libraryId]/route.ts
 * @description API routes for individual library operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/database/mongodb';

// --- Type Definitions ---

interface LibraryDocument {
  libraryId: string;
  userId: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  access: 'private' | 'shared' | 'public';
  sharedWith?: Array<{
    userId: string;
    email?: string;
    accessLevel: 'read' | 'write';
    grantedAt: Date;
    grantedBy: string;
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
    processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    processingError?: string;
    metadata?: Record<string, unknown>;
  }>;
  documentCount: number;
  totalChunks: number;
  totalSize: number;
  searchCount: number;
  lastSearchAt?: Date;
  lastUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
}

// --- Helper: Check access ---
function hasAccess(
  library: LibraryDocument, 
  userId: string, 
  requiredLevel: 'read' | 'write' = 'read'
): boolean {
  // Owner has full access
  if (library.userId === userId) return true;
  
  // Public libraries are read-only
  if (library.access === 'public' && requiredLevel === 'read') return true;
  
  // Check shared access
  const shared = library.sharedWith?.find(s => s.userId === userId);
  if (shared) {
    if (requiredLevel === 'read') return true;
    return shared.accessLevel === 'write';
  }
  
  return false;
}

// --- GET: Get library details ---
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { libraryId } = await params;

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    const library = await librariesCollection.findOne({ libraryId });

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    if (!hasAccess(library, user.userId, 'read')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      libraryId: library.libraryId,
      name: library.name,
      description: library.description,
      icon: library.icon,
      color: library.color,
      access: library.access,
      embeddingModel: library.embeddingModel,
      chunkSize: library.chunkSize,
      chunkOverlap: library.chunkOverlap,
      documents: library.documents.map(doc => ({
        documentId: doc.documentId,
        title: doc.title,
        sourceType: doc.sourceType,
        source: doc.source,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        chunkCount: doc.chunkCount,
        charCount: doc.charCount,
        addedAt: doc.addedAt,
        addedBy: doc.addedBy,
        processingStatus: doc.processingStatus,
        processingError: doc.processingError,
      })),
      documentCount: library.documentCount,
      totalChunks: library.totalChunks,
      totalSize: library.totalSize,
      searchCount: library.searchCount,
      lastSearchAt: library.lastSearchAt?.toISOString(),
      lastUpdatedAt: library.lastUpdatedAt.toISOString(),
      createdAt: library.createdAt.toISOString(),
      isOwned: library.userId === user.userId,
      canWrite: hasAccess(library, user.userId, 'write'),
    });
  } catch (error) {
    console.error('[Library API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch library' },
      { status: 500 }
    );
  }
}

// --- PATCH: Update library settings ---
export async function PATCH(
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

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    // Only owner can update settings
    const library = await librariesCollection.findOne({
      libraryId,
      userId: user.userId,
    });

    if (!library) {
      return NextResponse.json(
        { error: 'Library not found or not authorized' },
        { status: 404 }
      );
    }

    // Allowed updates
    const allowedFields = ['name', 'description', 'icon', 'color', 'access'];
    const updates: Record<string, any> = { updatedAt: new Date() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Validate name
    if (updates.name && (typeof updates.name !== 'string' || updates.name.length > 100)) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    await librariesCollection.updateOne(
      { libraryId, userId: user.userId },
      { $set: updates }
    );

    return NextResponse.json({ success: true, updated: Object.keys(updates) });
  } catch (error) {
    console.error('[Library API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update library' },
      { status: 500 }
    );
  }
}

// --- DELETE: Permanently delete library ---
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
    const permanent = searchParams.get('permanent') === 'true';

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    // Verify ownership
    const library = await librariesCollection.findOne({
      libraryId,
      userId: user.userId,
    });

    if (!library) {
      return NextResponse.json(
        { error: 'Library not found or not authorized' },
        { status: 404 }
      );
    }

    if (permanent) {
      // TODO: Also delete from vector store
      await librariesCollection.deleteOne({ libraryId, userId: user.userId });
      console.log(`[Library API] Permanently deleted library: ${libraryId}`);
      return NextResponse.json({ success: true, deleted: true });
    } else {
      // Soft delete (archive)
      await librariesCollection.updateOne(
        { libraryId, userId: user.userId },
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
      console.log(`[Library API] Archived library: ${libraryId}`);
      return NextResponse.json({ success: true, archived: true });
    }
  } catch (error) {
    console.error('[Library API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete library' },
      { status: 500 }
    );
  }
}
