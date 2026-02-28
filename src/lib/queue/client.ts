/**
 * BullMQ Queue Client for Webapp
 *
 * This module provides queue submission utilities for offloading graph
 * execution to the worker nodes.
 *
 * Usage:
 *   import { submitGraphJob, submitAutomationJob } from '@/lib/queue/client';
 *
 *   const runId = nanoid();
 *   await submitGraphJob({
 *     runId,
 *     userId: user.userId,
 *     graphId,
 *     input: { message: userMessage },
 *     stream: true,
 *   });
 */

import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { parseBullMQConnection } from '@red/stream/queue';

// ============================================
// Configuration
// ============================================

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Queue names - must match worker/src/queues/config.ts
const QUEUE_NAMES = {
  GRAPH: 'graph-execution',
  AUTOMATION: 'automation-execution',
  BACKGROUND: 'background-tasks',
} as const;

// ============================================
// Connection Management
// ============================================

let connection: Redis | null = null;
let graphQueue: Queue | null = null;
let automationQueue: Queue | null = null;
let backgroundQueue: Queue | null = null;

function getConnection(): Redis {
  if (!connection) {
    const opts = parseBullMQConnection(REDIS_URL);
    connection = new IORedis({
      ...opts,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    } as any);
  }
  return connection;
}

export function getGraphQueue(): Queue {
  if (!graphQueue) {
    graphQueue = new Queue(QUEUE_NAMES.GRAPH, { connection: getConnection() as any });
  }
  return graphQueue;
}

export function getAutomationQueue(): Queue {
  if (!automationQueue) {
    automationQueue = new Queue(QUEUE_NAMES.AUTOMATION, { connection: getConnection() as any });
  }
  return automationQueue;
}

export function getBackgroundQueue(): Queue {
  if (!backgroundQueue) {
    backgroundQueue = new Queue(QUEUE_NAMES.BACKGROUND, { connection: getConnection() as any });
  }
  return backgroundQueue;
}

// ============================================
// Types
// ============================================

export interface SubmitGraphJobOptions {
  /** Unique run identifier (used as job ID) */
  runId: string;
  /** User ID for authentication and resource ownership */
  userId: string;
  /** Graph ID to execute */
  graphId: string;
  /** Conversation ID for context (optional) */
  conversationId?: string;
  /** Input data for the graph */
  input: Record<string, unknown>;
  /** Whether to stream results (default: true) */
  stream?: boolean;
  /** Job priority (lower = higher priority) */
  priority?: number;
  /** Source information for analytics */
  source?: {
    device?: string;
    application?: string;
    ip?: string;
    userAgent?: string;
  };
  /** Message storage configuration */
  storeMessage?: {
    /** Message ID for the assistant response */
    messageId: string;
    /** Conversation ID for storage */
    conversationId: string;
    /** User message ID (for linking) */
    userMessageId?: string;
  };
}

export interface SubmitAutomationJobOptions {
  /** Unique run identifier */
  runId: string;
  /** Automation ID */
  automationId: string;
  /** User ID who owns the automation */
  userId: string;
  /** Trigger type */
  triggerType: 'manual' | 'webhook' | 'cron' | 'event';
  /** Input data (webhook payload, event data, etc.) */
  input?: Record<string, unknown>;
  /** Job priority */
  priority?: number;
}

export interface SubmitBackgroundJobOptions {
  /** Job type */
  type: 'title-generation' | 'summarization' | 'cleanup' | 'index-refresh';
  /** User ID */
  userId: string;
  /** Related entity data */
  data: Record<string, unknown>;
  /** Job priority */
  priority?: number;
  /** Delay in milliseconds */
  delay?: number;
}

// ============================================
// Job Submission Functions
// ============================================

/**
 * Submit a graph execution job to the worker queue
 *
 * @returns Job ID (same as runId)
 */
export async function submitGraphJob(options: SubmitGraphJobOptions): Promise<string> {
  const queue = getGraphQueue();

  const job = await queue.add(
    'execute',
    {
      type: 'graph',
      runId: options.runId,
      userId: options.userId,
      graphId: options.graphId,
      conversationId: options.conversationId,
      input: options.input,
      stream: options.stream ?? true,
      source: options.source,
      storeMessage: options.storeMessage,
    },
    {
      jobId: options.runId,
      priority: options.priority ?? 0,
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    }
  );

  console.log(`[QueueClient] Submitted graph job ${job.id} for graph ${options.graphId}`);
  return job.id!;
}

/**
 * Submit an automation execution job to the worker queue
 *
 * @returns Job ID (same as runId)
 */
export async function submitAutomationJob(options: SubmitAutomationJobOptions): Promise<string> {
  const queue = getAutomationQueue();

  const job = await queue.add(
    'execute',
    {
      type: 'automation',
      runId: options.runId,
      automationId: options.automationId,
      userId: options.userId,
      triggerType: options.triggerType,
      input: options.input ?? {},
    },
    {
      jobId: options.runId,
      priority: options.priority ?? 0,
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 86400,
      },
    }
  );

  console.log(`[QueueClient] Submitted automation job ${job.id} for automation ${options.automationId}`);
  return job.id!;
}

/**
 * Submit a background task job
 *
 * @returns Job ID
 */
export async function submitBackgroundJob(options: SubmitBackgroundJobOptions): Promise<string> {
  const queue = getBackgroundQueue();

  const jobId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const job = await queue.add(
    options.type,
    {
      type: options.type,
      userId: options.userId,
      ...options.data,
    },
    {
      jobId,
      priority: options.priority ?? 10, // Lower priority than graph/automation
      delay: options.delay,
      removeOnComplete: {
        age: 1800, // Keep for 30 minutes
        count: 500,
      },
      removeOnFail: {
        age: 3600,
      },
    }
  );

  console.log(`[QueueClient] Submitted background job ${job.id} (${options.type})`);
  return job.id!;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get the status of a job by ID
 */
export async function getJobStatus(
  queueType: 'graph' | 'automation' | 'background',
  jobId: string
): Promise<{ state: string; progress: number; result?: unknown; error?: string } | null> {
  const queue =
    queueType === 'graph'
      ? getGraphQueue()
      : queueType === 'automation'
        ? getAutomationQueue()
        : getBackgroundQueue();

  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = await job.getState();

  return {
    state,
    progress: job.progress as number,
    result: job.returnvalue,
    error: job.failedReason,
  };
}

/**
 * Cancel a pending job
 */
export async function cancelJob(
  queueType: 'graph' | 'automation' | 'background',
  jobId: string
): Promise<boolean> {
  const queue =
    queueType === 'graph'
      ? getGraphQueue()
      : queueType === 'automation'
        ? getAutomationQueue()
        : getBackgroundQueue();

  const job = await queue.getJob(jobId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    console.log(`[QueueClient] Cancelled job ${jobId}`);
    return true;
  }

  return false;
}

/**
 * Close all queue connections (for graceful shutdown)
 */
export async function closeQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (graphQueue) {
    closePromises.push(graphQueue.close());
    graphQueue = null;
  }
  if (automationQueue) {
    closePromises.push(automationQueue.close());
    automationQueue = null;
  }
  if (backgroundQueue) {
    closePromises.push(backgroundQueue.close());
    backgroundQueue = null;
  }
  if (connection) {
    closePromises.push(connection.quit().then(() => {}));
    connection = null;
  }

  await Promise.all(closePromises);
  console.log('[QueueClient] All queues closed');
}
