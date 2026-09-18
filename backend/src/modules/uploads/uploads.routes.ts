import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../../middleware/auth';
import { BadRequest } from '../../lib/errors';
import { asyncHandler } from '../../lib/http';
import { uploadBufferToStorage } from '../../lib/storage';

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
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw BadRequest('No file was uploaded (field name must be "file")');

    const ext = ALLOWED.get(req.file.mimetype) ?? 'bin';
    // Org-scoped, unguessable path so agencies can't reference each other's files.
    const url = await uploadBufferToStorage(req.file.buffer, req.file.mimetype, ext, req.auth!.organizationId);
    res.status(201).json({ url });
  }),
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
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw BadRequest('No file was uploaded (field name must be "file")');

    const ext = VIDEO_ALLOWED.get(req.file.mimetype) ?? 'mp4';
    const url = await uploadBufferToStorage(req.file.buffer, req.file.mimetype, ext, `${req.auth!.organizationId}/video`);
    res.status(201).json({ url });
  }),
);

export default router;
