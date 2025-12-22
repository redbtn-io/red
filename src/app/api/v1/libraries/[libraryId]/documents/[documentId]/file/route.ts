/**
 * @file /api/v1/libraries/[libraryId]/documents/[documentId]/file/route.ts
 * @description Serve original file from GridFS for viewing/download
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
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
  documents: Array<{
    documentId: string;
    title: string;
    sourceType: string;
    source?: string;
    mimeType?: string;
    fileSize?: number;
    gridFsFileId?: string;
  }>;
}

// --- Helper: Check read access ---
function hasReadAccess(library: LibraryDocument, userId: string): boolean {
  if (library.userId === userId) return true;
  if (library.access === 'public') return true;
  const shared = library.sharedWith?.find(s => s.userId === userId);
  return !!shared;
}

// --- GET: Serve original file ---
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
    const library = await librariesCollection.findOne({ libraryId });

    if (!library) {
      return NextResponse.json({ error: 'Library not found' }, { status: 404 });
    }

    if (!hasReadAccess(library, user.userId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the document
    const doc = library.documents.find(d => d.documentId === documentId);
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if we have the original file in GridFS
    if (!doc.gridFsFileId) {
      return NextResponse.json(
        { error: 'Original file not available', reason: 'legacy_document' },
        { status: 404 }
      );
    }

    // Get file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'library_files' });
    
    let fileId: ObjectId;
    try {
      fileId = new ObjectId(doc.gridFsFileId);
    } catch {
      return NextResponse.json({ error: 'Invalid file reference' }, { status: 500 });
    }

    // Check if file exists
    const files = await bucket.find({ _id: fileId }).toArray();
    if (files.length === 0) {
      return NextResponse.json(
        { error: 'Original file not found in storage' },
        { status: 404 }
      );
    }

    const gridFile = files[0];

    // Check if download is requested
    const searchParams = request.nextUrl.searchParams;
    const download = searchParams.get('download') === 'true';

    // Stream file from GridFS
    const downloadStream = bucket.openDownloadStream(fileId);
    
    // Collect chunks into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadStream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Determine content type
    const contentType = doc.mimeType || 'application/octet-stream';
    const filename = doc.source || doc.title || 'document';

    // Build response headers
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    };

    if (download) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
    } else {
      headers['Content-Disposition'] = `inline; filename="${encodeURIComponent(filename)}"`;
    }

    return new NextResponse(buffer, { status: 200, headers });
  } catch (error) {
    console.error('[File API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve file' },
      { status: 500 }
    );
  }
}

// --- HEAD: Check if original file exists ---
export async function HEAD(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; documentId: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return new NextResponse(null, { status: 401 });
    }

    const { libraryId, documentId } = await params;

    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return new NextResponse(null, { status: 500 });
    }

    const librariesCollection = db.collection<LibraryDocument>('libraries');
    const library = await librariesCollection.findOne({ libraryId });

    if (!library) {
      return new NextResponse(null, { status: 404 });
    }

    if (!hasReadAccess(library, user.userId)) {
      return new NextResponse(null, { status: 403 });
    }

    const doc = library.documents.find(d => d.documentId === documentId);
    if (!doc || !doc.gridFsFileId) {
      return new NextResponse(null, { status: 404 });
    }

    // File exists
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType || 'application/octet-stream',
        'X-Has-Original': 'true',
      },
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
