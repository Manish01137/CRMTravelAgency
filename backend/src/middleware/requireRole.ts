import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { Forbidden, Unauthorized } from '../lib/errors';

/** Allows the request only if the authenticated user has one of the given roles. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(Unauthorized());
    if (!roles.includes(req.auth.role)) return next(Forbidden());
    return next();
  };
}
