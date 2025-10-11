import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Message interface for individual chat messages
 */
export interface IMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  thinking?: string; // Optional thinking process
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
 * Message schema (embedded in Conversation)
 */
const MessageSchema = new Schema<IMessage>(
  {
    id: { type: String, required: true },
    role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    thinking: { type: String },
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
ConversationSchema.pre('save', function (next) {
  if (this.messages && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastMessageAt = lastMessage.timestamp;
    if (!this.metadata) this.metadata = {};
    this.metadata.messageCount = this.messages.length;
  }
  next();
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
