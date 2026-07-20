import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../env';
import { requireAuth } from '../../middleware/auth';
import { AppError, BadRequest } from '../../lib/errors';

const ALLOWED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// In-memory file (we forward straight to Supabase Storage, never hit disk).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('UNSUPPORTED_TYPE'));
  },
});

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabase;
}

const router = Router();

router.post(
  '/',
  requireAuth,
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(BadRequest('Image is too large (max 5 MB)'));
      }
      if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
        return next(BadRequest('Only JPG, PNG, WEBP or GIF images are allowed'));
      }
      return next(BadRequest('Could not read the uploaded file'));
    });
  },
  async (req: Request, res: Response) => {
    const client = getSupabase();
    if (!client) {
      throw new AppError(503, 'UPLOADS_DISABLED', 'Image uploads are not configured on the server');
    }
    if (!req.file) throw BadRequest('No file was uploaded (field name must be "file")');

    const ext = ALLOWED.get(req.file.mimetype) ?? 'bin';
    // Org-scoped, unguessable path so agencies can't reference each other's files.
    const key = `${req.auth!.organizationId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    const { error } = await client.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (error) {
      throw new AppError(502, 'UPLOAD_FAILED', 'Could not store the image');
    }

    const { data } = client.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
    res.status(201).json({ url: data.publicUrl });
  },
);

// --- Video uploads (LinkTree background) -------------------------------------
const VIDEO_ALLOWED = new Map<string, string>([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov'],
]);
const VIDEO_MAX_BYTES = 25 * 1024 * 1024; // 25 MB (recommend ~10-15 MB, <20s)

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (VIDEO_ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('UNSUPPORTED_TYPE'));
  },
});

router.post(
  '/video',
  requireAuth,
  (req: Request, res: Response, next) => {
    uploadVideo.single('file')(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(BadRequest('Video is too large (max 25 MB — aim for 10-15 MB, under ~20 seconds)'));
      }
      if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
        return next(BadRequest('Only MP4, WEBM or MOV videos are allowed'));
      }
      return next(BadRequest('Could not read the uploaded file'));
    });
  },
  async (req: Request, res: Response) => {
    const client = getSupabase();
    if (!client) {
      throw new AppError(503, 'UPLOADS_DISABLED', 'Uploads are not configured on the server');
    }
    if (!req.file) throw BadRequest('No file was uploaded (field name must be "file")');

    const ext = VIDEO_ALLOWED.get(req.file.mimetype) ?? 'mp4';
    const key = `${req.auth!.organizationId}/video/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`;

    const { error } = await client.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(key, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (error) {
      throw new AppError(502, 'UPLOAD_FAILED', 'Could not store the video');
    }

    const { data } = client.storage.from(env.SUPABASE_STORAGE_BUCKET).getPublicUrl(key);
    res.status(201).json({ url: data.publicUrl });
  },
);

export default router;
