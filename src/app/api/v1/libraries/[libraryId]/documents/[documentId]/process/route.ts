/**
 * @file /api/v1/libraries/[libraryId]/documents/[documentId]/process/route.ts
 * @description Background processing endpoint for OCR on images
 * Called internally after image upload to extract text via vision model
 */

import { NextRequest, NextResponse } from 'next/server';
import { VectorStoreManager, DocumentParser } from '@redbtn/ai';
import mongoose from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import connectToDatabase from '@/lib/database/mongodb';

interface LibraryDocument {
  libraryId: string;
  vectorCollection: string;
  chunkSize: number;
  chunkOverlap: number;
  documents: Array<{
    documentId: string;
    gridFsFileId?: string;
    mimeType?: string;
    source?: string;
    processingStatus?: string;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; documentId: string }> }
) {
  const { libraryId, documentId } = await params;
  
  console.log(`[Process API] Starting OCR for document ${documentId} in library ${libraryId}`);

  try {
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

    const docRecord = library.documents.find(d => d.documentId === documentId);
    if (!docRecord) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    if (!docRecord.gridFsFileId) {
      return NextResponse.json({ error: 'No file stored for this document' }, { status: 400 });
    }

    // Update status to "processing"
    await librariesCollection.updateOne(
      { libraryId, 'documents.documentId': documentId },
      { $set: { 'documents.$.processingStatus': 'processing' } }
    );

    // Retrieve file from GridFS
    const bucket = new GridFSBucket(db, { bucketName: 'library_files' });
    const downloadStream = bucket.openDownloadStream(new ObjectId(docRecord.gridFsFileId));
    
    const chunks: Buffer[] = [];
    for await (const chunk of downloadStream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Parse with vision model (this is where the OCR happens)
    let parsedContent: string;
    try {
      const parsed = await DocumentParser.parse(
        buffer, 
        docRecord.source || 'image.png',
        docRecord.mimeType || 'image/png'
      );
      parsedContent = parsed.content;
      console.log(`[Process API] Vision extracted ${parsedContent.length} chars from ${documentId}`);
    } catch (parseError) {
      console.error(`[Process API] Vision processing failed for ${documentId}:`, parseError);
      
      // Mark as failed
      await librariesCollection.updateOne(
        { libraryId, 'documents.documentId': documentId },
        { 
          $set: { 
            'documents.$.processingStatus': 'failed',
            'documents.$.processingError': String(parseError),
          } 
        }
      );

      return NextResponse.json({ 
        success: false, 
        error: 'Vision processing failed' 
      }, { status: 500 });
    }

    // If we got content, add to vector store
    if (parsedContent && parsedContent.trim().length > 0) {
      const vectorStore = new VectorStoreManager();
      
      try {
        const chunkCount = await vectorStore.addDocument(
          library.vectorCollection,
          parsedContent,
          {
            documentId,
            libraryId,
            title: docRecord.source?.replace(/\.[^.]+$/, '') || 'Image',
            source: docRecord.source || 'image',
            sourceType: 'file',
          },
          {
            chunkSize: library.chunkSize,
            chunkOverlap: library.chunkOverlap,
          }
        );

        // Update document with results
        await librariesCollection.updateOne(
          { libraryId, 'documents.documentId': documentId },
          { 
            $set: { 
              'documents.$.processingStatus': 'completed',
              'documents.$.charCount': parsedContent.length,
              'documents.$.chunkCount': chunkCount,
            },
            $inc: {
              totalChunks: chunkCount,
            },
          }
        );

        console.log(`[Process API] Successfully indexed ${documentId}: ${chunkCount} chunks`);

        return NextResponse.json({
          success: true,
          documentId,
          charCount: parsedContent.length,
          chunkCount,
        });

      } catch (vectorError) {
        console.error(`[Process API] Vector store error for ${documentId}:`, vectorError);
        
        await librariesCollection.updateOne(
          { libraryId, 'documents.documentId': documentId },
          { 
            $set: { 
              'documents.$.processingStatus': 'failed',
              'documents.$.processingError': 'Failed to index in vector store',
            } 
          }
        );

        return NextResponse.json({ 
          success: false, 
          error: 'Vector indexing failed' 
        }, { status: 500 });
      }
    } else {
      // No content extracted - still mark as completed but note it
      await librariesCollection.updateOne(
        { libraryId, 'documents.documentId': documentId },
        { 
          $set: { 
            'documents.$.processingStatus': 'completed',
            'documents.$.charCount': 0,
            'documents.$.chunkCount': 0,
          } 
        }
      );

      console.log(`[Process API] No text extracted from ${documentId}, marked as completed`);

      return NextResponse.json({
        success: true,
        documentId,
        charCount: 0,
        chunkCount: 0,
        note: 'No text content extracted from image',
      });
    }

  } catch (error) {
    console.error(`[Process API] Error processing ${documentId}:`, error);
    
    // Try to mark as failed
    try {
      await mongoose.connection.db?.collection('libraries').updateOne(
        { libraryId, 'documents.documentId': documentId },
        { 
          $set: { 
            'documents.$.processingStatus': 'failed',
            'documents.$.processingError': String(error),
          } 
        }
      );
    } catch {
      // Ignore update failure
    }

    return NextResponse.json(
      { error: 'Processing failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET: Check processing status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ libraryId: string; documentId: string }> }
) {
  const { libraryId, documentId } = await params;

  try {
    await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 500 });
    }

    const library = await db.collection('libraries').findOne(
      { libraryId, 'documents.documentId': documentId },
      { projection: { 'documents.$': 1 } }
    );

    if (!library || !library.documents?.[0]) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const doc = library.documents[0];
    return NextResponse.json({
      documentId,
      processingStatus: doc.processingStatus || 'completed',
      processingError: doc.processingError,
      charCount: doc.charCount,
      chunkCount: doc.chunkCount,
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to get status' }, { status: 500 });
  }
}
