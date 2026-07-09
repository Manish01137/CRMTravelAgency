import type { Request, RequestHandler } from 'express';
import { env } from '../env';
import { verifyToken } from '../lib/jwt';
import { Unauthorized } from '../lib/errors';

function extractToken(req: Request): string | null {
  const cookieToken = req.cookies?.[env.AUTH_COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();

  return null;
}

/** Requires a valid JWT; populates req.auth. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req);
  if (!token) return next(Unauthorized());

  try {
    const payload = verifyToken(token);
    req.auth = {
      userId: payload.sub,
      organizationId: payload.organizationId,
      role: payload.role,
    };
    return next();
  } catch {
    return next(Unauthorized('Your session is invalid or has expired'));
  }
};
