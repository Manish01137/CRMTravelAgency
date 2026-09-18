import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env';
import { AppError } from './errors';

/**
 * Shared Supabase Storage client + upload helper — originally lived only
 * inside uploads.routes.ts (agent-initiated image/video uploads); extracted
 * so the inbound-media webhook handler (downloading a WhatsApp/Instagram
 * photo from Meta and re-hosting it at a public URL our own frontend can
 * render) can reuse the exact same client setup and error handling instead
 * of duplicating it.
 */

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabase;
  } catch (err) {
    // createClient() can throw synchronously (e.g. its Realtime client's
    // WebSocket setup failing on a Node version without native WebSocket) —
    // never let a third-party SDK's internal init crash request handling;
    // degrade to "not configured" instead, same as a missing env var.
    console.error('getSupabase(): createClient() failed:', err);
    return null;
  }
}

/** Uploads a buffer to Storage under `${keyPrefix}/<timestamp>-<random>.<ext>` and returns its public URL. Throws AppError(503) if Storage isn't configured, AppError(502) if the upload itself fails. */
export async function uploadBufferToStorage(buffer: Buffer, contentType: string, ext: string, keyPrefix: string): Promise<string> {
  const client = getSupabase();
  if (!client) {
    throw new AppError(503, 'UPLOADS_DISABLED', 'Uploads are not configured on the server');
  }

  const key = `${keyPrefix}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;
  const { error } = await client.storage.from(env.SUPABASE_STORAGE_BUCKET).upload(key, buffer, { contentType, upsert: false });
  if (error) {
    console.error('uploadBufferToStorage(): upload failed:', error);
    throw new AppError(502, 'UPLOAD_FAILED', 'Could not store the file');
  }
  const { data } = client.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
