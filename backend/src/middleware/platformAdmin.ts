import type { Request, RequestHandler } from 'express';
import { getPlatformAdminCookieName } from '../lib/cookies';
import { verifyPlatformAdminToken } from '../lib/jwt';
import { Unauthorized } from '../lib/errors';

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[getPlatformAdminCookieName()];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();

  return null;
}

/** Requires a valid platform-admin JWT (Super Admin panel); populates req.platformAdmin.
 *  Completely independent of requireAuth/req.auth — a tenant session can never
 *  satisfy this, and vice versa. */
export const requirePlatformAdmin: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(Unauthorized());

  try {
    const payload = verifyPlatformAdminToken(token);
    req.platformAdmin = { adminId: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(Unauthorized('Your session is invalid or has expired'));
  }
};
