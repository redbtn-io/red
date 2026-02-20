/**
 * RedLog singleton instances for webapp API routes.
 *
 * Provides lazy-initialized LogReader and LogStream backed by the same
 * Redis/MongoDB connections used by the rest of the app.
 */

import { LogReader, LogStream } from '@redbtn/redlog';
import type { RedLogConfig } from '@redbtn/redlog';

// ---------------------------------------------------------------------------
// Shared config — uses the same env vars as red.ts
// ---------------------------------------------------------------------------

function getRedlogConfig(): RedLogConfig {
  return {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/redbtn',
    prefix: 'redlog',
    console: false,
  };
}

// ---------------------------------------------------------------------------
// Singletons
// ---------------------------------------------------------------------------

let _reader: LogReader | null = null;
let _stream: LogStream | null = null;

/** Get or create the shared LogReader (queries stored logs). */
export function getLogReader(): LogReader {
  if (!_reader) {
    _reader = new LogReader(getRedlogConfig());
  }
  return _reader;
}

/** Get or create the shared LogStream (real-time subscriptions). */
export function getLogStream(): LogStream {
  if (!_stream) {
    _stream = new LogStream(getRedlogConfig());
  }
  return _stream;
}
