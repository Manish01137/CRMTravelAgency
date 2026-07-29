import crypto from 'node:crypto';
import { env } from '../env';

/**
 * At-rest encryption for channel credentials (OAuth tokens, provider API keys)
 * stored in `ChannelConnection.credentials`. AES-256-GCM: authenticated, so a
 * tampered/corrupted ciphertext fails to decrypt rather than silently
 * returning garbage.
 *
 * ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate one:
 *   openssl rand -hex 32
 *
 * Optional at the env level (like SUPABASE_URL/GEMINI_API_KEY) — every channel
 * connect/send path is gated behind `isEncryptionConfigured()` and 503s with a
 * clear message instead of crashing the whole server at boot when it's unset.
 */
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM

export function isEncryptionConfigured(): boolean {
  return !!env.ENCRYPTION_KEY;
}

function getKey(): Buffer {
  if (!env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured — channel connections are disabled');
  }
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

/** Encrypts a plaintext string (typically JSON.stringify of a credentials object). */
export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // iv:authTag:ciphertext, all base64, colon-joined for easy storage as one TEXT column.
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Decrypts a value produced by `encrypt`. Throws if the payload was tampered with. */
export function decrypt(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** Encrypts a JSON-serializable credentials object. */
export function encryptJson<T>(value: T): string {
  return encrypt(JSON.stringify(value));
}

/** Decrypts + parses a credentials payload back into its typed shape. */
export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(payload)) as T;
}
