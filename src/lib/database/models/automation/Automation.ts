import mongoose, { Schema, Model, Document } from 'mongoose';

/**
 * Trigger types for automations
 */
export enum TriggerType {
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  EVENT = 'event',
  MANUAL = 'manual'
}

/**
 * Automation status
 */
export enum AutomationStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled',
  ERROR = 'error'
}

/**
 * Output action types
 */
export enum OutputActionType {
  WEBHOOK = 'webhook',
  EMAIL = 'email',
  STORE = 'store',
  LOG = 'log'
}

/**
 * Trigger configuration
 */
export interface ITriggerConfig {
  // For schedule triggers
  cron?: string;
  timezone?: string;
  
  // For webhook triggers
  secret?: string;
  allowedIps?: string[];
  
  // For event triggers
  eventType?: string;
  filters?: Record<string, any>;
}

/**
 * Output action configuration
 */
export interface IOutputAction {
  type: OutputActionType;
  config: {
    url?: string;
    email?: string;
    headers?: Record<string, string>;
  };
  enabled: boolean;
}

/**
 * Automation document interface
 */
export interface IAutomation {
  _id: string;
  automationId: string;
  userId: string;
  
  // Basic info
  name: string;
  description?: string;
  
  // Graph to execute
  graphId: string;
  
  // Trigger configuration
  trigger: {
    type: TriggerType;
    config: ITriggerConfig;
  };
  
  // Input mapping (maps trigger data to graph input)
  inputMapping?: Record<string, string>;
  
  // Default input values (used when trigger doesn't provide data)
  defaultInput?: Record<string, any>;
  
  // Output actions
  outputActions: IOutputAction[];
  
  // Status
  status: AutomationStatus;
  isEnabled: boolean;
  
  // Execution stats
  lastRunAt?: Date;
  nextRunAt?: Date;
  stats: {
    runCount: number;
    successCount: number;
    failureCount: number;
    lastError?: string;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IAutomationDocument extends Omit<IAutomation, '_id'>, Document {
  _id: any;
}

/**
 * Trigger config schema
 */
const triggerConfigSchema = new Schema({
  cron: { type: String },
  timezone: { type: String, default: 'UTC' },
  secret: { type: String },
  allowedIps: [{ type: String }],
  eventType: { type: String },
  filters: { type: Schema.Types.Mixed }
}, { _id: false });

/**
 * Output action schema
 */
const outputActionSchema = new Schema({
  type: {
    type: String,
    enum: Object.values(OutputActionType),
    required: true
  },
  config: {
    url: { type: String },
    email: { type: String },
    headers: { type: Map, of: String }
  },
  enabled: { type: Boolean, default: true }
}, { _id: false });

/**
 * Automation schema
 */
const automationSchema = new Schema<IAutomationDocument>(
  {
    automationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: String,
      required: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    graphId: {
      type: String,
      required: true,
      index: true
    },
    trigger: {
      type: {
        type: String,
        enum: Object.values(TriggerType),
        required: true
      },
      config: {
        type: triggerConfigSchema,
        default: {}
      }
    },
    inputMapping: {
      type: Map,
      of: String
    },
    defaultInput: {
      type: Schema.Types.Mixed
    },
    outputActions: {
      type: [outputActionSchema],
      default: []
    },
    status: {
      type: String,
      enum: Object.values(AutomationStatus),
      default: AutomationStatus.ACTIVE
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true
    },
    lastRunAt: {
      type: Date
    },
    nextRunAt: {
      type: Date,
      index: true
    },
    stats: {
      runCount: {
        type: Number,
        default: 0
      },
      successCount: {
        type: Number,
        default: 0
      },
      failureCount: {
        type: Number,
        default: 0
      },
      lastError: {
        type: String
      }
    }
  },
  {
    timestamps: true,
    collection: 'automations'
  }
);

// Compound indexes
automationSchema.index({ userId: 1, isEnabled: 1 });
automationSchema.index({ userId: 1, status: 1 });
automationSchema.index({ 'trigger.type': 1, isEnabled: 1 });

/**
 * Generate automation ID
 */
export function generateAutomationId(): string {
  return `auto_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Export the Automation model
 */
export const Automation: Model<IAutomationDocument> = 
  mongoose.models.Automation || mongoose.model<IAutomationDocument>('Automation', automationSchema);
