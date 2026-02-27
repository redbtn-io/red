import mongoose, { Schema, Model, Document } from 'mongoose';
import { TriggerType } from './Automation';

/**
 * Run status
 */
export enum RunStatus {
  QUEUED = 'queued',
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout'
}

/**
 * Log entry for automation runs
 */
export interface IRunLogEntry {
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, any>;
}

/**
 * AutomationRun document interface
 */
export interface IAutomationRun {
  _id: string;
  runId: string;
  automationId: string;
  graphId: string;
  userId: string;
  
  // Trigger info
  triggeredBy: TriggerType | 'chat';
  triggerData?: Record<string, any>;
  
  // Input/Output
  input: Record<string, any>;
  output?: Record<string, any>;
  
  // Status
  status: RunStatus;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  
  // Error handling
  error?: string;
  errorStack?: string;
  retryCount: number;
  
  // Logs
  logs: IRunLogEntry[];
  
  // Conversation association (for agent graphs)
  conversationId?: string;
  generationId?: string;
  
  // Usage tracking
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  
  // TTL expiration
  expiresAt: Date;
}

export interface IAutomationRunDocument extends Omit<IAutomationRun, '_id'>, Document {
  _id: any;
}

/**
 * Log entry schema
 */
const logEntrySchema = new Schema({
  timestamp: { type: Date, default: Date.now },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    default: 'info'
  },
  message: { type: String, required: true },
  metadata: { type: Schema.Types.Mixed }
}, { _id: false });

/**
 * Tokens used schema
 */
const tokensUsedSchema = new Schema({
  input: { type: Number, default: 0 },
  output: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
}, { _id: false });

/**
 * AutomationRun schema
 */
const automationRunSchema = new Schema<IAutomationRunDocument>(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    automationId: {
      type: String,
      required: true,
      index: true
    },
    graphId: {
      type: String,
      required: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    triggeredBy: {
      type: String,
      enum: ['webhook', 'schedule', 'event', 'manual', 'chat'],
      required: true
    },
    triggerData: {
      type: Schema.Types.Mixed
    },
    input: {
      type: Schema.Types.Mixed,
      required: true,
      default: {}
    },
    output: {
      type: Schema.Types.Mixed
    },
    status: {
      type: String,
      enum: Object.values(RunStatus),
      default: RunStatus.PENDING,
      index: true
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    completedAt: {
      type: Date
    },
    durationMs: {
      type: Number
    },
    error: {
      type: String
    },
    errorStack: {
      type: String
    },
    retryCount: {
      type: Number,
      default: 0
    },
    logs: {
      type: [logEntrySchema],
      default: []
    },
    conversationId: {
      type: String,
      index: true
    },
    generationId: {
      type: String,
      index: true
    },
    tokensUsed: {
      type: tokensUsedSchema
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true,
    collection: 'automationruns'
  }
);

// Compound indexes
automationRunSchema.index({ automationId: 1, startedAt: -1 });
automationRunSchema.index({ userId: 1, startedAt: -1 });
automationRunSchema.index({ status: 1, startedAt: -1 });

// TTL index - documents expire after expiresAt
automationRunSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Generate run ID
 */
export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Calculate expiration date (default: 30 days)
 */
export function calculateExpiresAt(days: number = 30): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Export the AutomationRun model
 */
export const AutomationRun: Model<IAutomationRunDocument> = 
  mongoose.models.AutomationRun || mongoose.model<IAutomationRunDocument>('AutomationRun', automationRunSchema);
