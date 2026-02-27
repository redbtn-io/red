/**
 * Connection Cryptography Utilities
 * 
 * Handles encryption/decryption of connection credentials.
 * Uses AES-256-GCM for authenticated encryption.
 * 
 * All credentials stored in UserConnection.credentials are encrypted.
 */

import crypto from 'crypto';
import type { ICredentials } from '../database/models/connections';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

/**
 * Get the encryption key from environment
 * Uses CONNECTION_ENCRYPTION_KEY if set, falls back to ENCRYPTION_KEY or JWT_SECRET
 */
function getEncryptionKey(): Buffer {
  const keySource = 
    process.env.CONNECTION_ENCRYPTION_KEY || 
    process.env.ENCRYPTION_KEY || 
    process.env.JWT_SECRET;
    
  if (!keySource) {
    throw new Error(
      'CONNECTION_ENCRYPTION_KEY, ENCRYPTION_KEY, or JWT_SECRET environment variable is required for credential encryption'
    );
  }
  
  // Derive a 32-byte key using SHA-256
  return crypto.createHash('sha256').update(keySource).digest();
}

/**
 * Encrypt a string value
 * @returns Base64-encoded string in format: iv:authTag:ciphertext
 */
export function encryptValue(plaintext: string): string {
  if (!plaintext) return '';
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted value
 * @param encryptedValue - Format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decryptValue(encryptedValue: string): string {
  if (!encryptedValue) return '';
  
  // Check if value is encrypted (contains our format separator)
  if (!isEncrypted(encryptedValue)) {
    return encryptedValue;
  }
  
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    return encryptedValue;
  }
  
  const [ivBase64, authTagBase64, ciphertext] = parts;
  
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.warn('[ConnectionCrypto] Failed to decrypt value');
    throw new Error('Failed to decrypt credential');
  }
}

/**
 * Check if a value appears to be encrypted
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const parts = value.split(':');
  return parts.length === 3;
}

/**
 * Encrypt all credential values in a credentials object
 */
export function encryptCredentials(credentials: Partial<ICredentials>): ICredentials {
  const encrypted: ICredentials = {};
  
  // Encrypt simple string fields
  const stringFields: (keyof ICredentials)[] = [
    'accessToken',
    'refreshToken', 
    'idToken',
    'apiKey',
    'username',
    'password',
  ];
  
  for (const field of stringFields) {
    const value = credentials[field];
    if (value && typeof value === 'string') {
      (encrypted as Record<string, string>)[field] = encryptValue(value);
    }
  }
  
  // Encrypt multiCredentials
  if (credentials.multiCredentials) {
    encrypted.multiCredentials = {};
    for (const [key, value] of Object.entries(credentials.multiCredentials)) {
      encrypted.multiCredentials[key] = encryptValue(value);
    }
  }
  
  // Encrypt customCredentials
  if (credentials.customCredentials) {
    encrypted.customCredentials = {};
    for (const [key, value] of Object.entries(credentials.customCredentials)) {
      encrypted.customCredentials[key] = encryptValue(value);
    }
  }
  
  return encrypted;
}

/**
 * Decrypt all credential values in a credentials object
 */
export function decryptCredentials(credentials: ICredentials): ICredentials {
  const decrypted: ICredentials = {};
  
  // Decrypt simple string fields
  const stringFields: (keyof ICredentials)[] = [
    'accessToken',
    'refreshToken',
    'idToken',
    'apiKey',
    'username',
    'password',
  ];
  
  for (const field of stringFields) {
    const value = credentials[field];
    if (value && typeof value === 'string') {
      (decrypted as Record<string, string>)[field] = decryptValue(value);
    }
  }
  
  // Decrypt multiCredentials
  if (credentials.multiCredentials) {
    decrypted.multiCredentials = {};
    for (const [key, value] of Object.entries(credentials.multiCredentials)) {
      decrypted.multiCredentials[key] = decryptValue(value);
    }
  }
  
  // Decrypt customCredentials
  if (credentials.customCredentials) {
    decrypted.customCredentials = {};
    for (const [key, value] of Object.entries(credentials.customCredentials)) {
      decrypted.customCredentials[key] = decryptValue(value);
    }
  }
  
  return decrypted;
}

/**
 * Build a Basic auth header from username and password
 */
export function buildBasicAuthHeader(username: string, password: string): string {
  const combined = `${username}:${password}`;
  const encoded = Buffer.from(combined).toString('base64');
  return `Basic ${encoded}`;
}

/**
 * Parse template variables in header format strings
 * Supports: {{key}}, {{username}}, {{password}}, {{base64(x:y)}}
 */
export function parseHeaderFormat(
  format: string, 
  credentials: {
    key?: string;
    username?: string;
    password?: string;
    [key: string]: string | undefined;
  }
): string {
  let result = format;
  
  // Replace simple variables
  result = result.replace(/\{\{key\}\}/g, credentials.key || '');
  result = result.replace(/\{\{username\}\}/g, credentials.username || '');
  result = result.replace(/\{\{password\}\}/g, credentials.password || '');
  
  // Replace any custom variables
  for (const [key, value] of Object.entries(credentials)) {
    if (value && !['key', 'username', 'password'].includes(key)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }
  
  // Handle base64 encoding: {{base64(username:password)}}
  const base64Match = result.match(/\{\{base64\(([^)]+)\)\}\}/);
  if (base64Match) {
    const inner = base64Match[1];
    // Replace variables within base64
    let innerResolved = inner
      .replace(/username/g, credentials.username || '')
      .replace(/password/g, credentials.password || '')
      .replace(/key/g, credentials.key || '');
    
    const encoded = Buffer.from(innerResolved).toString('base64');
    result = result.replace(base64Match[0], encoded);
  }
  
  return result;
}
