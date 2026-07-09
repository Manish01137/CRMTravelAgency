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
