import crypto from 'node:crypto';

/** Returns a random invite token (given to the user) and its sha256 hash (stored). */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
