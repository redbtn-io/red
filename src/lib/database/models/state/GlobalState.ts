/**
 * Global State Model
 * 
 * Persists key-value state that can be accessed and modified by any workflow.
 * State is organized into namespaces for logical grouping.
 * 
 * Features:
 * - Namespaced key-value storage
 * - Per-user isolation
 * - Type hints for UI rendering
 * - Access logging
 * - TTL support for temporary values
 */

import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// Value types for UI rendering hints
export type GlobalStateValueType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';

/**
 * Individual state entry (key-value pair)
 */
export interface GlobalStateEntry {
  key: string;
  value: any;
  valueType: GlobalStateValueType;
  description?: string;
  lastModifiedAt: Date;
  lastModifiedBy?: string; // 'user' | 'workflow:<graphId>' | 'system'
  expiresAt?: Date; // Optional TTL
  accessCount: number;
  lastAccessedAt?: Date;
}

/**
 * Namespace containing multiple state entries
 */
export interface IGlobalStateNamespace extends Document {
  _id: Types.ObjectId;
  namespace: string;
  userId: string;
  description?: string;
  entries: GlobalStateEntry[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Inferred type from schema
 */
export type GlobalStateNamespaceDocument = IGlobalStateNamespace;

/**
 * Entry sub-schema
 */
const GlobalStateEntrySchema = new Schema<GlobalStateEntry>({
  key: { type: String, required: true },
  value: { type: Schema.Types.Mixed, required: true },
  valueType: { 
    type: String, 
    enum: ['string', 'number', 'boolean', 'object', 'array', 'null'],
    default: 'string'
  },
  description: { type: String },
  lastModifiedAt: { type: Date, default: Date.now },
  lastModifiedBy: { type: String }, // 'user' | 'workflow:<graphId>' | 'system'
  expiresAt: { type: Date },
  accessCount: { type: Number, default: 0 },
  lastAccessedAt: { type: Date }
}, { _id: false });

/**
 * Namespace schema
 */
const GlobalStateNamespaceSchema = new Schema<IGlobalStateNamespace>({
  namespace: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: 100
  },
  userId: { 
    type: String, 
    required: true,
    index: true
  },
  description: { type: String, maxlength: 500 },
  entries: [GlobalStateEntrySchema],
  isArchived: { type: Boolean, default: false }
}, { 
  timestamps: true 
});

// Compound unique index: each user can only have one namespace with a given name
GlobalStateNamespaceSchema.index({ userId: 1, namespace: 1 }, { unique: true });

// Index for querying non-archived namespaces
GlobalStateNamespaceSchema.index({ userId: 1, isArchived: 1 });

/**
 * Static methods
 */
GlobalStateNamespaceSchema.statics.getNamespaces = async function(
  userId: string, 
  includeArchived = false
): Promise<IGlobalStateNamespace[]> {
  const filter: any = { userId };
  if (!includeArchived) {
    filter.isArchived = false;
  }
  return this.find(filter).sort({ updatedAt: -1 });
};

GlobalStateNamespaceSchema.statics.getNamespace = async function(
  userId: string, 
  namespace: string
): Promise<IGlobalStateNamespace | null> {
  return this.findOne({ userId, namespace });
};

GlobalStateNamespaceSchema.statics.getValue = async function(
  userId: string, 
  namespace: string, 
  key: string
): Promise<any> {
  const doc = await this.findOne(
    { userId, namespace },
    { entries: { $elemMatch: { key } } }
  );
  
  if (!doc || !doc.entries || doc.entries.length === 0) {
    return undefined;
  }
  
  const entry = doc.entries[0];
  
  // Check TTL
  if (entry.expiresAt && entry.expiresAt < new Date()) {
    // Value expired, remove it
    await this.updateOne(
      { userId, namespace },
      { $pull: { entries: { key } } }
    );
    return undefined;
  }
  
  // Update access stats
  await this.updateOne(
    { userId, namespace, 'entries.key': key },
    { 
      $inc: { 'entries.$.accessCount': 1 },
      $set: { 'entries.$.lastAccessedAt': new Date() }
    }
  );
  
  return entry.value;
};

GlobalStateNamespaceSchema.statics.setValue = async function(
  userId: string, 
  namespace: string, 
  key: string, 
  value: any,
  options?: {
    description?: string;
    modifiedBy?: string;
    ttlSeconds?: number;
  }
): Promise<void> {
  const valueType = detectValueType(value);
  const expiresAt = options?.ttlSeconds 
    ? new Date(Date.now() + options.ttlSeconds * 1000) 
    : undefined;
  
  // Try to update existing entry
  const result = await this.updateOne(
    { userId, namespace, 'entries.key': key },
    { 
      $set: { 
        'entries.$.value': value,
        'entries.$.valueType': valueType,
        'entries.$.lastModifiedAt': new Date(),
        'entries.$.lastModifiedBy': options?.modifiedBy || 'user',
        ...(options?.description && { 'entries.$.description': options.description }),
        ...(expiresAt && { 'entries.$.expiresAt': expiresAt })
      }
    }
  );
  
  if (result.modifiedCount === 0) {
    // Entry doesn't exist, create namespace if needed and push new entry
    await this.updateOne(
      { userId, namespace },
      { 
        $push: { 
          entries: {
            key,
            value,
            valueType,
            description: options?.description,
            lastModifiedAt: new Date(),
            lastModifiedBy: options?.modifiedBy || 'user',
            expiresAt,
            accessCount: 0
          }
        },
        $setOnInsert: {
          userId,
          namespace,
          isArchived: false
        }
      },
      { upsert: true }
    );
  }
};

GlobalStateNamespaceSchema.statics.deleteValue = async function(
  userId: string, 
  namespace: string, 
  key: string
): Promise<boolean> {
  const result = await this.updateOne(
    { userId, namespace },
    { $pull: { entries: { key } } }
  );
  return result.modifiedCount > 0;
};

GlobalStateNamespaceSchema.statics.getAll = async function(
  userId: string, 
  namespace: string
): Promise<Record<string, any>> {
  const doc = await this.findOne({ userId, namespace });
  if (!doc) return {};
  
  const now = new Date();
  const result: Record<string, any> = {};
  const expiredKeys: string[] = [];
  
  for (const entry of doc.entries) {
    if (entry.expiresAt && entry.expiresAt < now) {
      expiredKeys.push(entry.key);
    } else {
      result[entry.key] = entry.value;
    }
  }
  
  // Clean up expired entries
  if (expiredKeys.length > 0) {
    await this.updateOne(
      { userId, namespace },
      { $pull: { entries: { key: { $in: expiredKeys } } } }
    );
  }
  
  return result;
};

/**
 * Detect the type of a value for UI hints
 */
function detectValueType(value: any): GlobalStateValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  const type = typeof value;
  if (type === 'object') return 'object';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  return 'string';
}

/**
 * Extended model interface with static methods
 */
interface GlobalStateNamespaceModel extends Model<IGlobalStateNamespace> {
  getNamespaces(userId: string, includeArchived?: boolean): Promise<IGlobalStateNamespace[]>;
  getNamespace(userId: string, namespace: string): Promise<IGlobalStateNamespace | null>;
  getValue(userId: string, namespace: string, key: string): Promise<any>;
  setValue(userId: string, namespace: string, key: string, value: any, options?: {
    description?: string;
    modifiedBy?: string;
    ttlSeconds?: number;
  }): Promise<void>;
  deleteValue(userId: string, namespace: string, key: string): Promise<boolean>;
  getAll(userId: string, namespace: string): Promise<Record<string, any>>;
}

/**
 * Export the model
 */
export const GlobalStateNamespace: GlobalStateNamespaceModel = 
  (mongoose.models.GlobalStateNamespace as GlobalStateNamespaceModel) || 
  mongoose.model<IGlobalStateNamespace, GlobalStateNamespaceModel>(
    'GlobalStateNamespace', 
    GlobalStateNamespaceSchema
  );
