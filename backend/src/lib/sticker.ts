import sharp from 'sharp';
import { AppError } from './errors';

/**
 * Any picture → a WhatsApp sticker: 512×512 WebP with a transparent border,
 * under WhatsApp's 100 KB limit for still stickers.
 */
const MAX_BYTES = 100 * 1024;

export async function toWhatsAppSticker(input: Buffer): Promise<Buffer> {
  let base: sharp.Sharp;
  try {
    base = sharp(input, { animated: false, limitInputPixels: 40_000_000 })
      .rotate()
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha();
    await base.clone().metadata();
  } catch {
    throw new AppError(400, 'STICKER_UNREADABLE', 'That picture couldn’t be read — use a PNG, JPG or WebP image');
  }
  for (const quality of [82, 70, 55, 40, 28]) {
    const out = await base.clone().webp({ quality, alphaQuality: 80, effort: 4 }).toBuffer();
    if (out.length <= MAX_BYTES) return out;
  }
  throw new AppError(400, 'STICKER_TOO_DETAILED', 'That picture is too detailed for a sticker — try a simpler image');
}
