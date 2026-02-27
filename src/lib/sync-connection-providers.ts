/**
 * Connection Provider Sync Utility
 * 
 * Syncs providers from JSON file to MongoDB.
 * Can be called from API endpoint or file watcher.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { connectToDatabase } from '@/lib/database/mongodb';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const keySource = 
    process.env.CONNECTION_ENCRYPTION_KEY || 
    process.env.ENCRYPTION_KEY || 
    process.env.JWT_SECRET;
    
  if (!keySource) {
    throw new Error('CONNECTION_ENCRYPTION_KEY is required');
  }
  
  return crypto.createHash('sha256').update(keySource).digest();
}

function encryptValue(plaintext: string): string {
  if (!plaintext) return '';
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag().toString('base64');
  
  return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

// Map provider IDs to environment variable names for OAuth providers
const envCredentials: Record<string, { clientId: string; clientSecret: string }> = {
  // Productivity
  google: { clientId: 'GOOGLE_CLIENT_ID', clientSecret: 'GOOGLE_CLIENT_SECRET' },
  microsoft: { clientId: 'MICROSOFT_CLIENT_ID', clientSecret: 'MICROSOFT_CLIENT_SECRET' },
  notion: { clientId: 'NOTION_CLIENT_ID', clientSecret: 'NOTION_CLIENT_SECRET' },
  dropbox: { clientId: 'DROPBOX_CLIENT_ID', clientSecret: 'DROPBOX_CLIENT_SECRET' },
  airtable: { clientId: 'AIRTABLE_CLIENT_ID', clientSecret: 'AIRTABLE_CLIENT_SECRET' },
  
  // Developer
  github: { clientId: 'GITHUB_CLIENT_ID', clientSecret: 'GITHUB_CLIENT_SECRET' },
  gitlab: { clientId: 'GITLAB_CLIENT_ID', clientSecret: 'GITLAB_CLIENT_SECRET' },
  bitbucket: { clientId: 'BITBUCKET_CLIENT_ID', clientSecret: 'BITBUCKET_CLIENT_SECRET' },
  azure: { clientId: 'AZURE_CLIENT_ID', clientSecret: 'AZURE_CLIENT_SECRET' },
  vercel: { clientId: 'VERCEL_CLIENT_ID', clientSecret: 'VERCEL_CLIENT_SECRET' },
  render: { clientId: 'RENDER_CLIENT_ID', clientSecret: 'RENDER_CLIENT_SECRET' },
  linear: { clientId: 'LINEAR_CLIENT_ID', clientSecret: 'LINEAR_CLIENT_SECRET' },
  jira: { clientId: 'JIRA_CLIENT_ID', clientSecret: 'JIRA_CLIENT_SECRET' },
  
  // Communication
  slack: { clientId: 'SLACK_CLIENT_ID', clientSecret: 'SLACK_CLIENT_SECRET' },
  discord: { clientId: 'DISCORD_CLIENT_ID', clientSecret: 'DISCORD_CLIENT_SECRET' },
  zoom: { clientId: 'ZOOM_CLIENT_ID', clientSecret: 'ZOOM_CLIENT_SECRET' },
  twilio: { clientId: 'TWILIO_ACCOUNT_SID', clientSecret: 'TWILIO_AUTH_TOKEN' },
  
  // Social
  twitter: { clientId: 'TWITTER_CLIENT_ID', clientSecret: 'TWITTER_CLIENT_SECRET' },
  facebook: { clientId: 'FACEBOOK_CLIENT_ID', clientSecret: 'FACEBOOK_CLIENT_SECRET' },
  instagram: { clientId: 'INSTAGRAM_CLIENT_ID', clientSecret: 'INSTAGRAM_CLIENT_SECRET' },
  linkedin: { clientId: 'LINKEDIN_CLIENT_ID', clientSecret: 'LINKEDIN_CLIENT_SECRET' },
  reddit: { clientId: 'REDDIT_CLIENT_ID', clientSecret: 'REDDIT_CLIENT_SECRET' },
  tiktok: { clientId: 'TIKTOK_CLIENT_ID', clientSecret: 'TIKTOK_CLIENT_SECRET' },
  youtube: { clientId: 'YOUTUBE_CLIENT_ID', clientSecret: 'YOUTUBE_CLIENT_SECRET' },
  
  // Media
  spotify: { clientId: 'SPOTIFY_CLIENT_ID', clientSecret: 'SPOTIFY_CLIENT_SECRET' },
  
  // Design
  figma: { clientId: 'FIGMA_CLIENT_ID', clientSecret: 'FIGMA_CLIENT_SECRET' },
  canva: { clientId: 'CANVA_CLIENT_ID', clientSecret: 'CANVA_CLIENT_SECRET' },
  
  // Payments
  paypal: { clientId: 'PAYPAL_CLIENT_ID', clientSecret: 'PAYPAL_CLIENT_SECRET' },
  
  // CRM
  hubspot: { clientId: 'HUBSPOT_CLIENT_ID', clientSecret: 'HUBSPOT_CLIENT_SECRET' },
  salesforce: { clientId: 'SALESFORCE_CLIENT_ID', clientSecret: 'SALESFORCE_CLIENT_SECRET' },
  
  // Finance
  elite_entries: { clientId: 'ELITE_ENTRIES_CLIENT_ID', clientSecret: 'ELITE_ENTRIES_CLIENT_SECRET' },
  
  // Automation
  zapier: { clientId: 'ZAPIER_CLIENT_ID', clientSecret: 'ZAPIER_CLIENT_SECRET' },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadProviders(): any[] {
  // Try multiple possible paths for the JSON file
  const possiblePaths = [
    path.resolve(process.cwd(), '../data/connection_providers.json'),
    path.resolve(process.cwd(), 'data/connection_providers.json'),
    path.resolve(__dirname, '../../../data/connection_providers.json'),
    path.resolve(__dirname, '../../../../data/connection_providers.json'),
  ];
  
  for (const jsonPath of possiblePaths) {
    try {
      if (fs.existsSync(jsonPath)) {
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(jsonContent);
      }
    } catch {
      // Try next path
    }
  }
  
  throw new Error('Could not find connection_providers.json');
}

export interface SyncResult {
  success: boolean;
  total: number;
  synced: number;
  withCredentials: number;
  errors: string[];
  providers: Array<{
    providerId: string;
    name: string;
    status: string;
    hasCredentials: boolean;
  }>;
}

export async function syncConnectionProviders(): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    total: 0,
    synced: 0,
    withCredentials: 0,
    errors: [],
    providers: [],
  };

  try {
    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database not initialized');
    }
    const collection = db.collection('connectionproviders');

    // Load providers from JSON
    const providers = loadProviders();
    result.total = providers.length;

    for (const provider of providers) {
      try {
        // Get credentials from env if this is an OAuth provider
        let clientId: string | undefined;
        let clientSecret: string | undefined;
        let hasCredentials = false;
        
        const envConfig = envCredentials[provider.providerId];
        if (envConfig && provider.authType === 'oauth2') {
          const rawClientId = process.env[envConfig.clientId];
          const rawClientSecret = process.env[envConfig.clientSecret];
          
          if (rawClientId && rawClientSecret) {
            clientId = encryptValue(rawClientId);
            clientSecret = encryptValue(rawClientSecret);
            hasCredentials = true;
            result.withCredentials++;
          }
        } else if (provider.authType === 'api_key' || provider.authType === 'basic') {
          // API key/basic auth providers are always available (user provides their own key)
          hasCredentials = true;
        }

        // Determine status: OAuth providers without creds are "coming_soon"
        const status = (provider.authType === 'oauth2' && !hasCredentials) 
          ? 'coming_soon' 
          : (provider.status || 'active');

        const doc = {
          ...provider,
          status,
          ...(clientId && { clientId }),
          ...(clientSecret && { clientSecret }),
          updatedAt: new Date(),
        };

        await collection.updateOne(
          { providerId: provider.providerId },
          { 
            $set: doc,
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
        
        result.synced++;
        result.providers.push({
          providerId: provider.providerId,
          name: provider.name,
          status,
          hasCredentials,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`${provider.providerId}: ${message}`);
      }
    }

    result.success = result.errors.length === 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
  }

  return result;
}

// File watcher for development - watches the JSON file and syncs on change
let watcherActive = false;
let debounceTimer: NodeJS.Timeout | null = null;

export function startProviderFileWatcher(): void {
  if (watcherActive || process.env.NODE_ENV === 'production') {
    return;
  }

  const possiblePaths = [
    path.resolve(process.cwd(), '../data/connection_providers.json'),
    path.resolve(process.cwd(), 'data/connection_providers.json'),
  ];

  for (const jsonPath of possiblePaths) {
    if (fs.existsSync(jsonPath)) {
      console.log(`📁 Watching ${jsonPath} for changes...`);
      
      fs.watch(jsonPath, (eventType) => {
        if (eventType === 'change') {
          // Debounce to avoid multiple syncs on rapid saves
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          
          debounceTimer = setTimeout(async () => {
            console.log('🔄 Connection providers file changed, syncing...');
            try {
              const result = await syncConnectionProviders();
              console.log(`✅ Synced ${result.synced}/${result.total} providers`);
              if (result.errors.length > 0) {
                console.error('Errors:', result.errors);
              }
            } catch (err) {
              console.error('Sync failed:', err);
            }
          }, 500);
        }
      });
      
      watcherActive = true;
      break;
    }
  }
}

export function stopProviderFileWatcher(): void {
  watcherActive = false;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
