import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

// Initialize global mongoose cache
const cached: MongooseCache = global.mongoose || { conn: null, promise: null };

if (!global.mongoose) {
  global.mongoose = cached;
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/redbtn';

export async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
    console.log('[MongoDB] Connected successfully');
  } catch (e) {
    cached.promise = null;
    console.error('[MongoDB] Connection error:', e);
    throw e;
  }

  return cached.conn;
}

export default connectToDatabase;
