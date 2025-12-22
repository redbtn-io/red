/**
 * @file /api/v1/libraries/[libraryId]/upload/route.ts
 * @description Handle file uploads with server-side parsing and GridFS storage
 * Images are stored immediately and OCR is processed in the background
 */

import { NextRequest, NextResponse } from 'next/server';
import { VectorStoreManager, DocumentParser } from '@redbtn/ai';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import connectToDatabase from '@/lib/database/mongodb';

// Image MIME types that need vision processing
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function isImageFile(mimeType: string, filename: string): boolean {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
  return IMAGE_MIME_TYPES.includes(mimeType) || 
    ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
}

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

function hasWriteAccess(library: LibraryDocument, userId: string): boolean {
  if (library.userId === userId) return true;
  const shared = library.sharedWith?.find(s => s.userId === userId);
  return shared?.accessLevel === 'write';
}

function generateDocumentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `doc_${timestamp}_${random}`;
}

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

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large (max 50MB)' },
        { status: 400 }
      );
    }

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

    if (!hasWriteAccess(library, user.userId)) {
      return NextResponse.json({ error: 'Write access denied' }, { status: 403 });
    }

    if (library.documentCount >= 500) {
      return NextResponse.json(
        { error: 'Document limit reached (500 max per library)' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const documentId = generateDocumentId();
    const title = file.name.replace(/\.[^.]+$/, '');
    const isImage = isImageFile(file.type, file.name);

    // Store original file in GridFS first (needed for images, useful for all files)
    let gridFsFileId: string | undefined;
    try {
      const bucket = new GridFSBucket(db, { bucketName: 'library_files' });
      const uploadStream = bucket.openUploadStream(file.name, {
        metadata: {
          documentId,
          libraryId,
          userId: user.userId,
          mimeType: file.type,
          originalName: file.name,
          uploadedAt: new Date(),
        },
      });
      
      await new Promise<void>((resolve, reject) => {
        uploadStream.write(buffer);
        uploadStream.end();
        uploadStream.on('finish', () => resolve());
        uploadStream.on('error', reject);
      });
      
      gridFsFileId = uploadStream.id.toString();
      console.log(`[Upload API] Stored original file in GridFS: ${gridFsFileId}`);
    } catch (gridFsError) {
      console.warn('[Upload API] Failed to store in GridFS (non-fatal):', gridFsError);
    }

    // For images: store immediately with "processing" status, OCR runs in background
    if (isImage) {
      const newDocument = {
        documentId,
        title,
        sourceType: 'file',
        source: file.name,
        mimeType: file.type,
        fileSize: file.size,
        gridFsFileId,
        chunkCount: 0,
        charCount: 0,
        addedAt: new Date(),
        addedBy: user.userId,
        processingStatus: 'pending' as const,
        metadata: {},
      };

      await librariesCollection.updateOne(
        { libraryId },
        {
          $push: { documents: newDocument },
          $inc: {
            documentCount: 1,
            totalSize: file.size,
          },
          $set: {
            lastUpdatedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      console.log(`[Upload API] Added image ${documentId} (pending OCR) to library ${libraryId}`);

      // Trigger background OCR processing (fire and forget)
      const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/v1/libraries/${libraryId}/documents/${documentId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(err => console.error('[Upload API] Failed to trigger OCR:', err));

      return NextResponse.json({
        success: true,
        document: {
          documentId,
          title,
          chunkCount: 0,
          charCount: 0,
          processingStatus: 'pending',
          addedAt: newDocument.addedAt.toISOString(),
        },
      }, { status: 201 });
    }

    // For non-images: parse and index synchronously
    let parsedContent: string;
    let parsedTitle = title;

    try {
      const parsed = await DocumentParser.parse(buffer, file.name, file.type);
      parsedContent = parsed.content;
      
      if (parsed.metadata.title) {
        parsedTitle = parsed.metadata.title;
      }
      
      console.log(`[Upload API] Parsed ${file.name}: ${parsedContent.length} chars`);
    } catch (parseError) {
      console.error('[Upload API] Parse error:', parseError);
      return NextResponse.json(
        { error: 'Failed to parse file. Unsupported format or corrupted file.' },
        { status: 400 }
      );
    }

    if (!parsedContent || parsedContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'No text content could be extracted from the file' },
        { status: 400 }
      );
    }

    const vectorStore = new VectorStoreManager();
    const charCount = parsedContent.length;

    let chunkCount = 0;
    try {
      chunkCount = await vectorStore.addDocument(
        library.vectorCollection,
        parsedContent,
        {
          documentId,
          libraryId,
          title: parsedTitle,
          source: file.name,
          sourceType: 'file',
          addedBy: user.userId,
        },
        {
          chunkSize: library.chunkSize,
          chunkOverlap: library.chunkOverlap,
        }
      );
    } catch (vectorError) {
      console.error('[Upload API] Vector store error:', vectorError);
      return NextResponse.json(
        { error: 'Failed to add to vector store', details: String(vectorError) },
        { status: 500 }
      );
    }

    const newDocument = {
      documentId,
      title: parsedTitle,
      sourceType: 'file',
      source: file.name,
      mimeType: file.type,
      fileSize: file.size,
      gridFsFileId,
      chunkCount,
      charCount,
      addedAt: new Date(),
      addedBy: user.userId,
      processingStatus: 'completed' as const,
      metadata: {},
    };

    await librariesCollection.updateOne(
      { libraryId },
      {
        $push: { documents: newDocument },
        $inc: {
          documentCount: 1,
          totalChunks: chunkCount,
          totalSize: file.size,
        },
        $set: {
          lastUpdatedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    console.log(`[Upload API] Added document ${documentId} to library ${libraryId} (${chunkCount} chunks)`);

    return NextResponse.json({
      success: true,
      document: {
        documentId,
        title: parsedTitle,
        chunkCount,
        charCount,
        processingStatus: 'completed',
        addedAt: newDocument.addedAt.toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
