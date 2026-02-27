/**
 * UserNodePreferences Model
 * 
 * Tracks per-user relationships to nodes:
 * - Saved/bookmarked nodes
 * - Favorited nodes (quick access)
 * - Recently used nodes
 * 
 * Collection name: usernodepreferences
 */

import mongoose from 'mongoose';

const RecentNodeSchema = new mongoose.Schema({
  nodeId: {
    type: String,
    required: true
  },
  usedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const UserNodePreferencesSchema = new mongoose.Schema({
  // User ID (references User model)
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Saved/bookmarked node IDs
  savedNodes: {
    type: [String],
    default: []
  },
  
  // Favorited node IDs (subset of saved, for quick access)
  favoritedNodes: {
    type: [String],
    default: []
  },
  
  // Archived node IDs (hidden from user's main list but still accessible)
  archivedNodes: {
    type: [String],
    default: []
  },
  
  // Archived neuron IDs (hidden from user's main list but still accessible)
  archivedNeurons: {
    type: [String],
    default: []
  },
  
  // Recently used nodes (with timestamps, ordered by most recent)
  recentNodes: {
    type: [RecentNodeSchema],
    default: []
  },
  
  // User's custom tag preferences (pinned/hidden tags)
  tagPreferences: {
    pinnedTags: {
      type: [String],
      default: []
    },
    hiddenTags: {
      type: [String],
      default: []
    }
  },
  
  // Default view preferences
  viewPreferences: {
    defaultSortBy: {
      type: String,
      enum: ['name', 'createdAt', 'updatedAt', 'usageCount', 'forkCount', 'lastUsedAt'],
      default: 'name'
    },
    defaultSortOrder: {
      type: String,
      enum: ['asc', 'desc'],
      default: 'asc'
    },
    showSystemNodes: {
      type: Boolean,
      default: true
    },
    showPublicNodes: {
      type: Boolean,
      default: true
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
UserNodePreferencesSchema.pre('save', async function() {
  this.updatedAt = new Date();
});

// Indexes
UserNodePreferencesSchema.index({ savedNodes: 1 });
UserNodePreferencesSchema.index({ favoritedNodes: 1 });

// Export model
export const UserNodePreferencesModel = 
  mongoose.models.UserNodePreferences || 
  mongoose.model('UserNodePreferences', UserNodePreferencesSchema);

/**
 * Get or create user preferences
 */
export async function getUserNodePreferences(userId: string): Promise<any> {
  let prefs = await UserNodePreferencesModel.findOne({ userId }).lean();
  
  if (!prefs) {
    prefs = await UserNodePreferencesModel.create({ userId });
  }
  
  return prefs;
}

/**
 * Save a node for the user
 */
export async function saveNodeForUser(userId: string, nodeId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $addToSet: { savedNodes: nodeId },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}

/**
 * Unsave a node for the user
 */
export async function unsaveNodeForUser(userId: string, nodeId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $pull: { savedNodes: nodeId, favoritedNodes: nodeId },
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Favorite a node for the user (also adds to saved if not already)
 */
export async function favoriteNodeForUser(userId: string, nodeId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $addToSet: { savedNodes: nodeId, favoritedNodes: nodeId },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}

/**
 * Unfavorite a node for the user (keeps in saved)
 */
export async function unfavoriteNodeForUser(userId: string, nodeId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $pull: { favoritedNodes: nodeId },
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Record a node usage in recent history
 */
export async function recordRecentNode(userId: string, nodeId: string, maxRecent: number = 20): Promise<void> {
  // Remove existing entry if present
  await UserNodePreferencesModel.updateOne(
    { userId },
    { $pull: { recentNodes: { nodeId } } }
  );
  
  // Add to front of recent list
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $push: { 
        recentNodes: { 
          $each: [{ nodeId, usedAt: new Date() }],
          $position: 0,
          $slice: maxRecent // Keep only the most recent N entries
        }
      },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}

/**
 * Get user's saved nodes with full node data
 */
export async function getSavedNodesForUser(userId: string): Promise<any[]> {
  const NodeModel = mongoose.models.Node;
  if (!NodeModel) return [];
  
  const prefs = await getUserNodePreferences(userId);
  if (!prefs.savedNodes?.length) return [];
  
  return NodeModel.find({ nodeId: { $in: prefs.savedNodes } }).lean();
}

/**
 * Get user's favorited nodes with full node data
 */
export async function getFavoritedNodesForUser(userId: string): Promise<any[]> {
  const NodeModel = mongoose.models.Node;
  if (!NodeModel) return [];
  
  const prefs = await getUserNodePreferences(userId);
  if (!prefs.favoritedNodes?.length) return [];
  
  return NodeModel.find({ nodeId: { $in: prefs.favoritedNodes } }).lean();
}

/**
 * Get user's recent nodes with full node data (ordered by most recent)
 */
export async function getRecentNodesForUser(userId: string, limit: number = 10): Promise<any[]> {
  const NodeModel = mongoose.models.Node;
  if (!NodeModel) return [];
  
  const prefs = await getUserNodePreferences(userId);
  if (!prefs.recentNodes?.length) return [];
  
  const recentNodeIds = prefs.recentNodes.slice(0, limit).map((r: any) => r.nodeId);
  const nodes = await NodeModel.find({ nodeId: { $in: recentNodeIds } }).lean();
  
  // Maintain order from recentNodes
  const nodeMap = new Map(nodes.map((n: any) => [n.nodeId, n]));
  return recentNodeIds.map((id: string) => nodeMap.get(id)).filter(Boolean);
}

/**
 * Check if a node is saved by user
 */
export async function isNodeSaved(userId: string, nodeId: string): Promise<boolean> {
  const prefs = await UserNodePreferencesModel.findOne(
    { userId, savedNodes: nodeId },
    { _id: 1 }
  ).lean();
  return !!prefs;
}

/**
 * Check if a node is favorited by user
 */
export async function isNodeFavorited(userId: string, nodeId: string): Promise<boolean> {
  const prefs = await UserNodePreferencesModel.findOne(
    { userId, favoritedNodes: nodeId },
    { _id: 1 }
  ).lean();
  return !!prefs;
}

/**
 * Update user's view preferences
 */
export async function updateViewPreferences(
  userId: string, 
  preferences: Partial<{
    defaultSortBy: string;
    defaultSortOrder: string;
    showSystemNodes: boolean;
    showPublicNodes: boolean;
  }>
): Promise<void> {
  const updates: any = { updatedAt: new Date() };
  
  for (const [key, value] of Object.entries(preferences)) {
    updates[`viewPreferences.${key}`] = value;
  }
  
  await UserNodePreferencesModel.updateOne(
    { userId },
    { $set: updates },
    { upsert: true }
  );
}

// ============================================
// Archive Functions
// ============================================

/**
 * Archive a node for the user (hides from main list)
 */
export async function archiveNodeForUser(userId: string, nodeId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $addToSet: { archivedNodes: nodeId },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}

/**
 * Unarchive a node for the user (restores to main list)
 */
export async function unarchiveNodeForUser(userId: string, nodeId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $pull: { archivedNodes: nodeId },
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Archive a neuron for the user (hides from main list)
 */
export async function archiveNeuronForUser(userId: string, neuronId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $addToSet: { archivedNeurons: neuronId },
      $set: { updatedAt: new Date() }
    },
    { upsert: true }
  );
}

/**
 * Unarchive a neuron for the user (restores to main list)
 */
export async function unarchiveNeuronForUser(userId: string, neuronId: string): Promise<void> {
  await UserNodePreferencesModel.updateOne(
    { userId },
    { 
      $pull: { archivedNeurons: neuronId },
      $set: { updatedAt: new Date() }
    }
  );
}

/**
 * Get user's archived node IDs
 */
export async function getArchivedNodeIds(userId: string): Promise<string[]> {
  const prefs = await getUserNodePreferences(userId);
  return prefs.archivedNodes || [];
}

/**
 * Get user's archived neuron IDs
 */
export async function getArchivedNeuronIds(userId: string): Promise<string[]> {
  const prefs = await getUserNodePreferences(userId);
  return prefs.archivedNeurons || [];
}

/**
 * Check if a node is archived by user
 */
export async function isNodeArchived(userId: string, nodeId: string): Promise<boolean> {
  const prefs = await UserNodePreferencesModel.findOne(
    { userId, archivedNodes: nodeId },
    { _id: 1 }
  ).lean();
  return !!prefs;
}

/**
 * Check if a neuron is archived by user
 */
export async function isNeuronArchived(userId: string, neuronId: string): Promise<boolean> {
  const prefs = await UserNodePreferencesModel.findOne(
    { userId, archivedNeurons: neuronId },
    { _id: 1 }
  ).lean();
  return !!prefs;
}
