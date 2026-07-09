import type { Request, Response } from 'express';
import * as authService from './auth.service';
import type { AuthResult } from './auth.service';
import { signToken } from '../../lib/jwt';
import { setAuthCookie, clearAuthCookie } from '../../lib/cookies';
import { toPublicUser } from '../../lib/serializers';
import { Unauthorized } from '../../lib/errors';

/** Signs a JWT, sets the auth cookie, and shapes the auth response body. */
function issueSession(res: Response, result: AuthResult) {
  const token = signToken({
    sub: result.user.id,
    organizationId: result.organization.id,
    role: result.user.role,
  });
  setAuthCookie(res, token);
  return { token, user: toPublicUser(result.user), organization: result.organization };
}

export async function signup(req: Request, res: Response): Promise<void> {
  const result = await authService.signup(req.body);
  res.status(201).json(issueSession(res, result));
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body);
  res.json(issueSession(res, result));
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearAuthCookie(res);
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw Unauthorized();
  const result = await authService.getSession(req.auth.organizationId, req.auth.userId);
  res.json({ user: toPublicUser(result.user), organization: result.organization });
}

export async function invitePreview(req: Request, res: Response): Promise<void> {
  const preview = await authService.getInvitePreview(req.params.token);
  res.json(preview);
}

export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const result = await authService.acceptInvite(req.body);
  res.status(201).json(issueSession(res, result));
}
