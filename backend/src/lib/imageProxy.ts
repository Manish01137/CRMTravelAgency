import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { env } from '../env';

/**
 * Server-side image fetch for the brochure PDF export. html2canvas can only
 * read pixels of cross-origin images whose host sends CORS headers — a logo
 * pasted from an agency's own website usually doesn't, so it silently came
 * out blank in the PDF. Routing those images through this same-origin proxy
 * makes every host work.
 *
 * It fetches URLs supplied by the client, so it's locked down against SSRF:
 * only http(s); the destination IP is checked in the socket's own DNS lookup
 * (so a hostname can't pass a check and then resolve somewhere internal); each
 * redirect hop is re-validated; the response must be an image under 5 MB.
 */

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['64:ff9b::', 96], ['2001:db8::', 32],
] as const) blocked.addSubnet(addr, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) return !blocked.check(address, 'ipv4');
  if (net.isIPv6(address)) {
    const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return !blocked.check(mapped[1], 'ipv4');
    return !blocked.check(address, 'ipv6');
  }
  return false;
}

// Local development may legitimately serve images from localhost; never in production.
const allowPrivate = env.NODE_ENV !== 'production' && process.env.IMAGE_PROXY_ALLOW_PRIVATE === 'true';

const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as dns.LookupAddress[];
    const bad = list.find((a) => !allowPrivate && !isPublicAddress(a.address));
    if (bad || list.length === 0) {
      return callback(Object.assign(new Error(`Refusing to fetch from non-public address ${bad?.address ?? hostname}`), { code: 'EBLOCKED' }), '', 0);
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export class ImageProxyError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface FetchedImage {
  contentType: string;
  body: Buffer;
}

function fetchOnce(url: URL): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(
      url,
      { lookup: guardedLookup, timeout: TIMEOUT_MS, headers: { 'User-Agent': 'JoinetraBrochure/1.0', Accept: 'image/*' } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType: '', body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers['content-length'] ?? 0);
        if (declared > MAX_BYTES) {
          res.destroy();
          return reject(new ImageProxyError(413, 'Image is too large'));
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            res.destroy();
            reject(new ImageProxyError(413, 'Image is too large'));
          } else chunks.push(c);
        });
        res.on('end', () => resolve({ status, contentType: String(res.headers['content-type'] ?? ''), body: Buffer.concat(chunks) }));
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new ImageProxyError(504, 'Image host timed out')));
    req.on('error', (err: NodeJS.ErrnoException) =>
      reject(err instanceof ImageProxyError ? err : new ImageProxyError(err.code === 'EBLOCKED' ? 400 : 502, err.code === 'EBLOCKED' ? 'That image address is not allowed' : 'Could not reach the image host')),
    );
  });
}

/**
 * html2canvas draws an SVG with no width/height attributes at a tiny default
 * size. Give the root element an explicit size from its viewBox so it scales
 * like a normal image.
 */
function withIntrinsicSize(svg: string): string {
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root || /\swidth\s*=/.test(root)) return svg;
  const vb = root.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const w = vb ? Number(vb[1]) : 512;
  const h = vb ? Number(vb[2]) : 512;
  if (!(w > 0 && h > 0)) return svg;
  const scale = 512 / Math.max(w, h);
  return svg.replace(root, root.replace(/<svg\b/i, `<svg width="${Math.round(w * scale)}" height="${Math.round(h * scale)}"`));
}

export async function fetchImageForExport(rawUrl: string): Promise<FetchedImage> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ImageProxyError(400, 'Invalid image URL');
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ImageProxyError(400, 'Only http(s) images can be fetched');
    if (url.username || url.password) throw new ImageProxyError(400, 'Invalid image URL');
    // Node skips the DNS lookup (and so guardedLookup) for IP-literal hosts — check those directly.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !allowPrivate && !isPublicAddress(host)) throw new ImageProxyError(400, 'That image address is not allowed');
    const res = await fetchOnce(url);
    if (res.status >= 300 && res.status < 400) {
      if (!res.location) throw new ImageProxyError(502, 'Image host sent a broken redirect');
      url = new URL(res.location, url); // next loop iteration re-validates it
      continue;
    }
    if (res.status !== 200) throw new ImageProxyError(502, `Image host responded ${res.status}`);
    const contentType = res.contentType.split(';')[0].trim().toLowerCase();
    if (!contentType.startsWith('image/')) throw new ImageProxyError(415, 'That address is not an image');
    if (contentType === 'image/svg+xml') {
      return { contentType, body: Buffer.from(withIntrinsicSize(res.body.toString('utf8')), 'utf8') };
    }
    return { contentType, body: res.body };
  }
  throw new ImageProxyError(502, 'Too many redirects');
}
