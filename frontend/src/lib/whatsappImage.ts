/**
 * WhatsApp only shows JPG / PNG photos up to 5 MB — anything else (WebP, GIF,
 * HEIC, huge photos) is accepted by Meta and then fails a few seconds later.
 * Photos headed for WhatsApp are turned into a JPG here, in the browser,
 * before they're uploaded. Very large photos are also shrunk (max 1600 px),
 * which makes them load faster for customers too.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 1600;

export async function toWhatsAppImage(file: File): Promise<File> {
  const okType = file.type === 'image/jpeg' || file.type === 'image/png';
  if (okType && file.size <= MAX_BYTES) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error('This photo format can’t be used — please choose a JPG or PNG.');
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare this photo — please choose a JPG or PNG.');
  ctx.fillStyle = '#ffffff'; // transparent areas become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not prepare this photo — please choose a JPG or PNG.');
  const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
}
