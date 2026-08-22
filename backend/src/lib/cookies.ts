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

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const PLATFORM_ADMIN_COOKIE_NAME = 'joinetra_owner_token';

/** Separate cookie from the tenant session — a browser can hold both at once
 *  without conflict, and clearing one never touches the other. */
export function setPlatformAdminCookie(res: Response, token: string): void {
  res.cookie(PLATFORM_ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: TWELVE_HOURS_MS,
  });
}

export function clearPlatformAdminCookie(res: Response): void {
  res.clearCookie(PLATFORM_ADMIN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
  });
}

export function getPlatformAdminCookieName(): string {
  return PLATFORM_ADMIN_COOKIE_NAME;
}
