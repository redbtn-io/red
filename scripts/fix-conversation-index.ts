/**
 * Fix MongoDB duplicate key error on conversationId field
 * This script drops the old conversationId_1 index that shouldn't exist
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function fixIndex() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db!;
    const collection = db.collection('conversations');

    // List current indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Check for problematic conversationId index
    const hasConversationIdIndex = indexes.some((idx: any) => idx.key.conversationId !== undefined);

    if (hasConversationIdIndex) {
      console.log('\n⚠️  Found problematic conversationId_1 index');
      console.log('   This index was causing duplicate key errors');
      console.log('   Dropping index...');
      
      await collection.dropIndex('conversationId_1');
      console.log('✅ Successfully dropped conversationId_1 index');
    } else {
      console.log('\n✓ No problematic conversationId index found');
      console.log('  Database is clean!');
    }

    // Show updated indexes
    console.log('\n📋 Final indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach((idx: any) => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    console.log('\n✅ Index fix complete!');
    console.log('   You can now create new conversations without errors');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.code === 27) {
      console.log('   Index not found - this is fine, database is already clean');
    } else {
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

fixIndex();
