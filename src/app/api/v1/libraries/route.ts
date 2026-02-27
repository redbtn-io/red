/**
 * @file /api/v1/libraries/route.ts
 * @description API routes for Knowledge Libraries - CRUD operations for document collections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import connectToDatabase from '@/lib/database/mongodb';

// --- Type Definitions ---

interface LibraryDocument {
  _id?: mongoose.Types.ObjectId;
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
  archivedAt?: Date;
}

// --- Helper Functions ---

function generateLibraryId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}

function generateVectorCollectionName(userId: string, libraryId: string): string {
  return `lib_${userId.slice(-8)}_${libraryId.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}`;
}

// --- GET: List libraries ---
export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    const { searchParams } = new URL(request.url);
    const includePublic = searchParams.get('includePublic') === 'true';
    const includeShared = searchParams.get('includeShared') !== 'false';
    const includeArchived = searchParams.get('includeArchived') === 'true';

    // Build query for libraries user can access
    const conditions: any[] = [
      { userId: user.userId, isArchived: includeArchived ? { $in: [true, false] } : false },
    ];

    if (includeShared) {
      conditions.push({
        'sharedWith.userId': user.userId,
        isArchived: includeArchived ? { $in: [true, false] } : false,
      });
    }

    if (includePublic) {
      conditions.push({
        access: 'public',
        isArchived: false,
      });
    }

    const libraries = await librariesCollection
      .find({ $or: conditions })
      .sort({ updatedAt: -1 })
      .toArray();

    // Map to response format
    const response = libraries.map(lib => ({
      libraryId: lib.libraryId,
      name: lib.name,
      description: lib.description,
      icon: lib.icon,
      color: lib.color,
      access: lib.access,
      documentCount: lib.documentCount,
      totalChunks: lib.totalChunks,
      totalSize: lib.totalSize,
      searchCount: lib.searchCount,
      lastSearchAt: lib.lastSearchAt?.toISOString(),
      lastUpdatedAt: lib.lastUpdatedAt.toISOString(),
      createdAt: lib.createdAt.toISOString(),
      isArchived: lib.isArchived,
      isOwned: lib.userId === user.userId,
    }));

    return NextResponse.json({ libraries: response });
  } catch (error) {
    console.error('[Libraries API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch libraries' },
      { status: 500 }
    );
  }
}

// --- POST: Create library ---
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, icon, color, access, embeddingModel, chunkSize, chunkOverlap } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json({ error: 'Name too long (max 100 chars)' }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    // Check library limit (e.g., 20 per user)
    const existingCount = await librariesCollection.countDocuments({
      userId: user.userId,
      isArchived: false,
    });

    if (existingCount >= 20) {
      return NextResponse.json(
        { error: 'Library limit reached (20 max)' },
        { status: 400 }
      );
    }

    // Generate IDs
    const libraryId = generateLibraryId(name.trim());
    const vectorCollection = generateVectorCollectionName(user.userId, libraryId);

    // Create library document
    const now = new Date();
    const library: LibraryDocument = {
      libraryId,
      userId: user.userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      icon: icon || 'Library',
      color: color || '#ef4444',
      access: access || 'private',
      sharedWith: [],
      vectorCollection,
      embeddingModel: embeddingModel || 'nomic-embed-text',
      chunkSize: chunkSize || 2000,
      chunkOverlap: chunkOverlap || 200,
      documents: [],
      documentCount: 0,
      totalChunks: 0,
      totalSize: 0,
      searchCount: 0,
      lastUpdatedAt: now,
      createdAt: now,
      updatedAt: now,
      isArchived: false,
    };

    await librariesCollection.insertOne(library);

    console.log(`[Libraries API] Created library: ${libraryId} for user ${user.userId}`);

    return NextResponse.json({
      success: true,
      library: {
        libraryId: library.libraryId,
        name: library.name,
        description: library.description,
        vectorCollection: library.vectorCollection,
        createdAt: library.createdAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Libraries API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create library' },
      { status: 500 }
    );
  }
}

// --- DELETE: Archive a library ---
export async function DELETE(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const libraryId = searchParams.get('libraryId');

    if (!libraryId) {
      return NextResponse.json({ error: 'libraryId required' }, { status: 400 });
    }

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }
    const librariesCollection = db.collection<LibraryDocument>('libraries');

    // Find and verify ownership
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

    console.log(`[Libraries API] Archived library: ${libraryId}`);

    return NextResponse.json({ success: true, archived: true });
  } catch (error) {
    console.error('[Libraries API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to archive library' },
      { status: 500 }
    );
  }
}
