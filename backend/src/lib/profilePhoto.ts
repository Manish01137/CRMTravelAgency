import sharp from 'sharp';
import { AppError } from './errors';

/**
 * Any picture → what WhatsApp wants for a Business Profile photo: a square
 * JPEG (640×640). WhatsApp shows it as a circle, so a near-square photo is
 * cropped to fill; a logo or wide picture is fitted on white instead, so
 * nothing gets cut off.
 */
export async function toWhatsAppProfileJpeg(input: Buffer): Promise<Buffer> {
  try {
    const img = sharp(input, { limitInputPixels: 60_000_000 }).rotate();
    const { width = 1, height = 1, hasAlpha } = await img.metadata();
    const ratio = width / height;
    const fill = !hasAlpha && ratio > 0.9 && ratio < 1.1;
    return await img
      .resize(640, 640, { fit: fill ? 'cover' : 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new AppError(400, 'PHOTO_UNREADABLE', 'That picture couldn’t be read — use a JPG, PNG or WebP image');
  }
}
