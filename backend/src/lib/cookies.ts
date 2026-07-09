import type { Response } from 'express';
import { env, isProd } from '../env';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(env.AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  });
}
