import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../env';

export interface AuthTokenPayload {
  sub: string; // user id
  organizationId: string;
  role: Role;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string') {
    throw new Error('Unexpected token payload');
  }
  return decoded as AuthTokenPayload;
}

/**
 * Platform-admin tokens (Super Admin panel) are a completely separate token
 * family from tenant AuthTokenPayload above — no organizationId, no Role, and
 * a `scope` claim that only requirePlatformAdmin checks. A tenant token can
 * never pass verifyPlatformAdminToken (missing scope), and a platform-admin
 * token can never pass requireAuth's RLS-backed tenant path (missing
 * organizationId means app.current_org_id stays unset, which the RLS
 * policies already treat as "zero rows" — fail-closed either way).
 */
export interface PlatformAdminTokenPayload {
  sub: string; // platform admin id
  email: string; // denormalized for audit-log writes without a DB round trip
  scope: 'platform_admin';
}

export function signPlatformAdminToken(adminId: string, email: string): string {
  const payload: PlatformAdminTokenPayload = { sub: adminId, email, scope: 'platform_admin' };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '12h' });
}

export function verifyPlatformAdminToken(token: string): PlatformAdminTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === 'string' || decoded.scope !== 'platform_admin') {
    throw new Error('Not a platform-admin token');
  }
  return decoded as PlatformAdminTokenPayload;
}
