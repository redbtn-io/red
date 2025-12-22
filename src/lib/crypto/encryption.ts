/**
 * Encryption utilities for sensitive data like API keys
 * Uses AES-256-GCM for authenticated encryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment
 * Falls back to JWT_SECRET if ENCRYPTION_KEY is not set
 */
function getEncryptionKey(): Buffer {
  const keySource = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!keySource) {
    throw new Error('ENCRYPTION_KEY or JWT_SECRET environment variable is required for encryption');
  }
  // Derive a 32-byte key from the secret using SHA-256
  return crypto.createHash('sha256').update(keySource).digest();
}

/**
 * Encrypt a string value
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string (format: iv:authTag:ciphertext)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param encryptedValue - Base64-encoded encrypted string (format: iv:authTag:ciphertext)
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return '';
  
  // Check if value is encrypted (contains our format separator)
  if (!encryptedValue.includes(':')) {
    // Not encrypted, return as-is (for backward compatibility)
    return encryptedValue;
  }
  
  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    // Invalid format, return as-is
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
    // Decryption failed - might be unencrypted legacy data
    console.warn('[Encryption] Failed to decrypt value, returning as-is');
    return encryptedValue;
  }
}

/**
 * Check if a value appears to be encrypted
 * @param value - The value to check
 * @returns true if the value appears to be in our encrypted format
 */
export function isEncrypted(value: string): boolean {
  if (!value || !value.includes(':')) return false;
  const parts = value.split(':');
  return parts.length === 3;
}

/**
 * Encrypt an API key for storage
 * Wrapper with specific logging for API keys
 */
export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return encrypt(apiKey);
}

/**
 * Decrypt an API key for use
 * Wrapper with specific logging for API keys
 */
export function decryptApiKey(encryptedApiKey: string): string {
  if (!encryptedApiKey) return '';
  return decrypt(encryptedApiKey);
}
