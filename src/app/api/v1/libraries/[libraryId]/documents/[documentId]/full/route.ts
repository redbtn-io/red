/**
 * @file /api/v1/libraries/[libraryId]/documents/[documentId]/full/route.ts
 * @description Get the full reconstructed document content (merged chunks with overlap handling)
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
    processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
    processingError?: string;
  }>;
}

// --- Helper: Check read access ---
function hasReadAccess(library: LibraryDocument, userId: string): boolean {
  if (library.userId === userId) return true;
  if (library.access === 'public') return true;
  const shared = library.sharedWith?.find(s => s.userId === userId);
  return !!shared;
}

/**
 * Merge chunks intelligently by removing overlapping content
 * Uses heuristics to detect and remove redundant overlap sections
 */
function mergeChunksWithOverlapHandling(
  chunks: Array<{ text: string; chunkIndex: number }>,
  overlapSize: number
): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0].text;

  // Sort by chunk index
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  
  let mergedContent = sorted[0].text;
  
  for (let i = 1; i < sorted.length; i++) {
    const prevText = mergedContent;
    const currText = sorted[i].text;
    
    // Try to find overlap by checking if the end of prev matches the start of curr
    const overlapDetected = findOverlap(prevText, currText, overlapSize);
    
    if (overlapDetected > 0) {
      // Skip the overlapping portion at the start of current chunk
      mergedContent += currText.slice(overlapDetected);
    } else {
      // No overlap detected, add separator and full content
      mergedContent += '\n\n' + currText;
    }
  }
  
  return mergedContent;
}

/**
 * Find the overlap between the end of text1 and the start of text2
 * Returns the number of characters that overlap
 */
function findOverlap(text1: string, text2: string, maxOverlap: number): number {
  // Try to find a matching overlap from expected overlap size down to minimum
  const minOverlap = 50; // Minimum overlap to consider
  const searchRange = Math.min(maxOverlap * 2, text1.length, text2.length);
  
  for (let overlapLen = searchRange; overlapLen >= minOverlap; overlapLen--) {
    const endOfFirst = text1.slice(-overlapLen);
    const startOfSecond = text2.slice(0, overlapLen);
    
    // Check for exact match
    if (endOfFirst === startOfSecond) {
      return overlapLen;
    }
    
    // Check for near match (allowing for minor differences like whitespace)
    const normalizedEnd = endOfFirst.replace(/\s+/g, ' ').trim();
    const normalizedStart = startOfSecond.replace(/\s+/g, ' ').trim();
    
    if (normalizedEnd === normalizedStart && normalizedEnd.length > minOverlap) {
      return overlapLen;
    }
  }
  
  // Try finding partial overlap using common subsequence
  // Look for the longest suffix of text1 that matches a prefix of text2
  for (let len = Math.min(searchRange, 500); len >= minOverlap; len--) {
    const suffix = text1.slice(-len);
    const prefixIndex = text2.indexOf(suffix.slice(0, Math.min(50, len)));
    
    if (prefixIndex === 0) {
      // Found the start of text1's suffix at the beginning of text2
      // Now find where text2 content starts that's new
      const overlapMatch = text2.indexOf(suffix);
      if (overlapMatch === 0) {
        return len;
      }
    }
  }
  
  return 0;
}

/**
 * Detect the document format from metadata
 */
function detectFormat(doc: LibraryDocument['documents'][0]): 'markdown' | 'text' | 'pdf' | 'docx' | 'image' | 'csv' | 'excel' {
  const mimeType = doc.mimeType?.toLowerCase() || '';
  const source = doc.source?.toLowerCase() || '';
  
  if (mimeType.includes('pdf') || source.endsWith('.pdf')) {
    return 'pdf';
  }
  if (mimeType.includes('docx') || mimeType.includes('openxmlformats-officedocument.wordprocessingml') || source.endsWith('.docx') || source.endsWith('.doc')) {
    return 'docx';
  }
  if (mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel') || source.endsWith('.xlsx') || source.endsWith('.xls')) {
    return 'excel';
  }
  if (mimeType.includes('csv') || source.endsWith('.csv')) {
    return 'csv';
  }
  if (mimeType.includes('markdown') || source.endsWith('.md') || source.endsWith('.markdown')) {
    return 'markdown';
  }
  if (mimeType.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(source)) {
    return 'image';
  }
  return 'text';
}

// --- GET: Get full reconstructed document ---
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

    // Query ChromaDB for all chunks with this documentId
    const vectorStore = new VectorStoreManager();
    
    const results = await vectorStore.getDocumentsByFilter(
      library.vectorCollection,
      { documentId: documentId }
    );

    // Format chunks with their indices
    const chunks: Array<{ text: string; chunkIndex: number }> = results.map(result => ({
      text: result.text,
      chunkIndex: (result.metadata?.chunkIndex as number) ?? 0,
    }));

    // Merge chunks with overlap handling
    const fullContent = mergeChunksWithOverlapHandling(chunks, library.chunkOverlap);
    
    // Detect document format
    const format = detectFormat(doc);

    console.log(`[Full Document API] Document ${documentId}: ${chunks.length} chunks merged, format: ${format}`);

    return NextResponse.json({
      documentId,
      title: doc.title,
      content: fullContent,
      format,
      sourceType: doc.sourceType,
      source: doc.source,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      charCount: doc.charCount,
      chunkCount: doc.chunkCount,
      addedAt: doc.addedAt,
      processingStatus: doc.processingStatus,
      processingError: doc.processingError,
      metadata: {
        libraryId,
        libraryOverlap: library.chunkOverlap,
        chunksProcessed: chunks.length,
        mergedLength: fullContent.length,
      },
    });
  } catch (error) {
    console.error('[Full Document API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get full document', details: String(error) },
      { status: 500 }
    );
  }
}
