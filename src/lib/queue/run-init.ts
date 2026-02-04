/**
 * Run State Initialization for Distributed Architecture
 *
 * This module initializes run state in Redis BEFORE submitting jobs to workers.
 * This allows SSE clients to connect and subscribe to events immediately,
 * even before the worker picks up the job.
 *
 * The worker's RunPublisher will then update this state as execution proceeds.
 *
 * Usage:
 *   import { initializeRunState, RunStatus } from '@/lib/queue/run-init';
 *
 *   await initializeRunState({
 *     runId: nanoid(),
 *     userId: user.userId,
 *     graphId,
 *     graphName: 'My Graph',
 *     input: { message: 'Hello' },
 *     conversationId,
 *   });
 */

import IORedis, { type Redis } from 'ioredis';

// ============================================
// Configuration
// ============================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/** Run state TTL in seconds (1 hour) */
const STATE_TTL = 60 * 60;

// ============================================
// Redis Key Patterns (must match @redbtn/redbtn)
// ============================================

export const RunKeys = {
  /** Run state: `run:{runId}` */
  state: (runId: string) => `run:${runId}`,

  /** Pub/sub channel: `run:stream:{runId}` */
  stream: (runId: string) => `run:stream:${runId}`,

  /** Event log list: `run:events:{runId}` */
  events: (runId: string) => `run:events:${runId}`,

  /** Execution lock: `run:lock:{conversationId}` */
  lock: (conversationId: string) => `run:lock:${conversationId}`,

  /** Active run for conversation: `run:conversation:{conversationId}` */
  conversationRun: (conversationId: string) => `run:conversation:${conversationId}`,
} as const;

// ============================================
// Types
// ============================================

export type RunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RunState {
  runId: string;
  userId: string;
  graphId: string;
  graphName: string;
  conversationId?: string;
  status: RunStatus;
  startedAt: number;
  completedAt?: number;
  input: Record<string, unknown>;
  output: {
    content: string;
    thinking: string;
    data: Record<string, unknown>;
  };
  graph: {
    executionPath: string[];
    nodesExecuted: number;
    nodeProgress: Record<string, unknown>;
  };
  tools: unknown[];
  error?: string;
}

export interface InitializeRunOptions {
  /** Unique run identifier */
  runId: string;
  /** User ID */
  userId: string;
  /** Graph ID to execute */
  graphId: string;
  /** Graph name for display */
  graphName: string;
  /** Input data */
  input: Record<string, unknown>;
  /** Conversation ID (optional) */
  conversationId?: string;
}

// ============================================
// Connection Management
// ============================================

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redis;
}

// ============================================
// State Management Functions
// ============================================

/**
 * Create an initial run state object
 */
function createInitialRunState(params: InitializeRunOptions): RunState {
  return {
    runId: params.runId,
    userId: params.userId,
    graphId: params.graphId,
    graphName: params.graphName,
    conversationId: params.conversationId,
    status: 'queued', // Start as 'queued' since job is being submitted
    startedAt: Date.now(),
    input: params.input,
    output: {
      content: '',
      thinking: '',
      data: {},
    },
    graph: {
      executionPath: [],
      nodesExecuted: 0,
      nodeProgress: {},
    },
    tools: [],
  };
}

/**
 * Initialize run state in Redis before submitting job to worker.
 *
 * This allows SSE clients to:
 * 1. Connect immediately after API response
 * 2. Get current state (queued)
 * 3. Receive events once worker starts execution
 *
 * @returns The initialized RunState
 */
export async function initializeRunState(options: InitializeRunOptions): Promise<RunState> {
  const redis = getRedis();
  const state = createInitialRunState(options);

  // Store initial state
  await redis.set(RunKeys.state(options.runId), JSON.stringify(state), 'EX', STATE_TTL);

  // Track active run for conversation if provided
  if (options.conversationId) {
    await redis.set(RunKeys.conversationRun(options.conversationId), options.runId, 'EX', STATE_TTL);
  }

  // Publish initial "queued" event so any waiting subscribers get notified
  const queuedEvent = {
    type: 'run_queued',
    runId: options.runId,
    graphId: options.graphId,
    graphName: options.graphName,
    timestamp: Date.now(),
  };

  await redis.publish(RunKeys.stream(options.runId), JSON.stringify(queuedEvent));

  // Store event in event log
  await redis.rpush(RunKeys.events(options.runId), JSON.stringify(queuedEvent));
  await redis.expire(RunKeys.events(options.runId), STATE_TTL);

  console.log(`[RunInit] Initialized run state for ${options.runId} (graph: ${options.graphId})`);

  return state;
}

/**
 * Get current run state from Redis
 */
export async function getRunState(runId: string): Promise<RunState | null> {
  const redis = getRedis();
  const data = await redis.get(RunKeys.state(runId));
  if (!data) return null;
  return JSON.parse(data) as RunState;
}

/**
 * Check if a run exists and get its status
 */
export async function getRunStatus(runId: string): Promise<RunStatus | null> {
  const state = await getRunState(runId);
  return state?.status ?? null;
}

/**
 * Get the active run for a conversation
 */
export async function getActiveRunForConversation(conversationId: string): Promise<string | null> {
  const redis = getRedis();
  return redis.get(RunKeys.conversationRun(conversationId));
}

/**
 * Mark a run as cancelled (before worker picks it up)
 */
export async function cancelRun(runId: string): Promise<boolean> {
  const redis = getRedis();
  const state = await getRunState(runId);

  if (!state) return false;
  if (state.status !== 'queued' && state.status !== 'pending') {
    // Can't cancel a running/completed/failed run from here
    return false;
  }

  state.status = 'cancelled';
  state.completedAt = Date.now();

  await redis.set(RunKeys.state(runId), JSON.stringify(state), 'EX', STATE_TTL);

  // Publish cancelled event
  const cancelledEvent = {
    type: 'run_cancelled',
    runId,
    timestamp: Date.now(),
  };

  await redis.publish(RunKeys.stream(runId), JSON.stringify(cancelledEvent));
  await redis.rpush(RunKeys.events(runId), JSON.stringify(cancelledEvent));

  console.log(`[RunInit] Cancelled run ${runId}`);
  return true;
}

/**
 * Subscribe to run events (for SSE endpoints)
 *
 * @param runId The run ID to subscribe to
 * @param callback Function called for each event
 * @returns Unsubscribe function
 */
export async function subscribeToRun(
  runId: string,
  callback: (event: unknown) => void
): Promise<() => Promise<void>> {
  const subscriber = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const channel = RunKeys.stream(runId);

  await subscriber.subscribe(channel);

  subscriber.on('message', (_chan: string, message: string) => {
    try {
      const event = JSON.parse(message);
      callback(event);
    } catch (error) {
      console.error(`[RunInit] Failed to parse event:`, error);
    }
  });

  return async () => {
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  };
}

/**
 * Get all events for a run (for replay)
 */
export async function getRunEvents(runId: string): Promise<unknown[]> {
  const redis = getRedis();
  const events = await redis.lrange(RunKeys.events(runId), 0, -1);
  return events.map((e) => JSON.parse(e));
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRunInit(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
