import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AppError } from './errors';

/**
 * Voice notes recorded in the browser → what WhatsApp plays as a voice note:
 * OGG with the Opus codec, mono. Browsers record WebM (Chrome), OGG (Firefox)
 * or MP4/AAC (Safari) — WhatsApp refuses WebM, so every recording is
 * converted with ffmpeg (installed in the backend Docker image).
 *
 * Temp files rather than pipes: an MP4 recording can only be read with seeking.
 */

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const TIMEOUT_MS = 60_000;

export async function toOggOpus(input: Buffer): Promise<Buffer> {
  const id = randomBytes(8).toString('hex');
  const src = path.join(os.tmpdir(), `voice-${id}.in`);
  const out = path.join(os.tmpdir(), `voice-${id}.ogg`);
  await fs.writeFile(src, input);
  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        FFMPEG,
        // Mono Opus at 32 kbps in an OGG container — the format WhatsApp's own app sends.
        ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', '-f', 'ogg', out],
        { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 },
        (err, _stdout, stderr) => {
          if (!err) return resolve();
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return reject(new AppError(503, 'VOICE_UNAVAILABLE', 'Voice notes aren’t available on this server yet (audio converter missing)'));
          }
          console.error('[audio] ffmpeg failed:', String(stderr).slice(0, 500) || err.message);
          reject(new AppError(400, 'VOICE_UNREADABLE', 'That recording couldn’t be read — please record it again'));
        },
      );
    });
    const ogg = await fs.readFile(out);
    if (ogg.length < 200) throw new AppError(400, 'VOICE_EMPTY', 'That recording is empty — check your microphone and try again');
    return ogg;
  } finally {
    await Promise.all([fs.rm(src, { force: true }), fs.rm(out, { force: true })]);
  }
}
