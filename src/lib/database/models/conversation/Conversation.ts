import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Tool execution step interface
 */
export interface IToolStep {
  step: string;
  timestamp: Date;
  progress?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

/**
 * Tool execution interface for tracking AI tool usage
 */
export interface IToolExecution {
  toolId: string;
  toolType: string; // 'thinking', 'web_search', 'database_query', etc.
  toolName: string;
  status: 'running' | 'completed' | 'error';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  
  // Progress tracking
  steps: IToolStep[];
  currentStep?: string;
  progress?: number;
  
  // Streaming content (for thinking, code output, etc.)
  streamingContent?: string;
  
  // Results and metadata
  result?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Node progress interface for graph run tracking
 */
export interface INodeProgress {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  startTime?: number;
  endTime?: number;
  error?: string;
}

/**
 * Graph run interface for tracking graph execution history
 */
export interface IGraphRun {
  graphId: string;
  graphName?: string;
  runId?: string;
  status: 'running' | 'completed' | 'error';
  executionPath: string[];
  nodeProgress: Record<string, INodeProgress>;
  startTime?: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

/**
 * Message interface for individual chat messages
 */
export interface IMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: string; // Optional thinking process
  toolExecutions?: IToolExecution[]; // Tool executions for this message
  graphRun?: IGraphRun; // Graph execution history for this message
  metadata?: {
    model?: string;
    tokens?: {
      input?: number;
      output?: number;
      total?: number;
    };
  };
}

/**
 * Conversation document interface
 */
export interface IConversation extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  messages: IMessage[];
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
  isArchived: boolean;
  metadata?: {
    model?: string;
    messageCount?: number;
  };
  
  // Methods
  addMessage(message: Omit<IMessage, 'id' | 'timestamp'>): IMessage;
}

/**
 * Tool step schema (embedded in ToolExecution)
 */
const ToolStepSchema = new Schema<IToolStep>(
  {
    step: { type: String, required: true },
    timestamp: { type: Date, required: true },
    progress: { type: Number },
    data: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

/**
 * Tool execution schema (embedded in Message)
 */
const ToolExecutionSchema = new Schema<IToolExecution>(
  {
    toolId: { type: String, required: true },
    toolType: { type: String, required: true },
    toolName: { type: String, required: true },
    status: { 
      type: String, 
      required: true, 
      enum: ['running', 'completed', 'error'] 
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    duration: { type: Number },
    steps: [ToolStepSchema],
    currentStep: { type: String },
    progress: { type: Number },
    streamingContent: { type: String },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

/**
 * Node progress schema (embedded in GraphRun)
 */
const NodeProgressSchema = new Schema<INodeProgress>(
  {
    nodeId: { type: String, required: true },
    status: { 
      type: String, 
      required: true, 
      enum: ['pending', 'running', 'completed', 'error'] 
    },
    currentStep: { type: Number },
    totalSteps: { type: Number },
    stepName: { type: String },
    startTime: { type: Number },
    endTime: { type: Number },
    error: { type: String },
  },
  { _id: false }
);

/**
 * Graph run schema (embedded in Message)
 */
const GraphRunSchema = new Schema<IGraphRun>(
  {
    graphId: { type: String, required: true },
    graphName: { type: String },
    runId: { type: String },
    status: { 
      type: String, 
      required: true, 
      enum: ['running', 'completed', 'error'] 
    },
    executionPath: [{ type: String }],
    nodeProgress: { type: Schema.Types.Mixed, default: {} },
    startTime: { type: Number },
    endTime: { type: Number },
    duration: { type: Number },
    error: { type: String },
  },
  { _id: false }
);

/**
 * Message schema (embedded in Conversation)
 */
const MessageSchema = new Schema<IMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    thinking: { type: String },
    toolExecutions: [ToolExecutionSchema],
    graphRun: GraphRunSchema,
    metadata: {
      model: String,
      tokens: {
        input: Number,
        output: Number,
        total: Number,
      },
    },
  },
  { _id: false }
);

/**
 * Conversation schema
 */
const ConversationSchema = new Schema<IConversation>(
  {
    userId: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
    title: { 
      type: String, 
      required: true,
      default: 'New Conversation'
    },
    messages: [MessageSchema],
    lastMessageAt: { 
      type: Date, 
      required: true, 
      default: Date.now,
      index: true 
    },
    isArchived: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    metadata: {
      model: String,
      messageCount: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user queries
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });
ConversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });

// Update lastMessageAt and messageCount before saving
ConversationSchema.pre('save', async function () {
  if (this.messages && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastMessageAt = lastMessage.timestamp;
    if (!this.metadata) this.metadata = {};
    this.metadata.messageCount = this.messages.length;
  }
});

// Virtual for getting conversation preview (first user message or title)
ConversationSchema.virtual('preview').get(function () {
  const firstUserMessage = this.messages.find(m => m.role === 'user');
  if (firstUserMessage) {
    return firstUserMessage.content.substring(0, 100);
  }
  return this.title;
});

// Method to add a message
ConversationSchema.methods.addMessage = function (message: Omit<IMessage, 'id' | 'timestamp'>) {
  const newMessage: IMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    ...message,
  };
  this.messages.push(newMessage);
  this.lastMessageAt = newMessage.timestamp;
  return newMessage;
};

// Ensure virtual fields are serialized
ConversationSchema.set('toJSON', { virtuals: true });
ConversationSchema.set('toObject', { virtuals: true });

/**
 * Conversation model
 * Note: Using 'user_conversations' collection to avoid conflict with AI package's 'conversations' collection
 */
const Conversation: Model<IConversation> =
  mongoose.models.UserConversation || mongoose.model<IConversation>('UserConversation', ConversationSchema, 'user_conversations');

export default Conversation;
