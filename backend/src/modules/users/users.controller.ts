import type { Request, Response } from 'express';
import { env } from '../../env';
import { toPublicInvitation, toPublicUser } from '../../lib/serializers';
import * as usersService from './users.service';

function buildAcceptUrl(token: string): string {
  const base = env.CORS_ORIGIN.replace(/\/$/, '');
  return `${base}/accept-invite?token=${encodeURIComponent(token)}`;
}

export async function list(req: Request, res: Response): Promise<void> {
  const users = await usersService.listUsers(req.auth!.organizationId);
  res.json(users.map(toPublicUser));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateProfile(
    req.auth!.organizationId,
    req.auth!.userId,
    req.body,
  );
  res.json(toPublicUser(user));
}

export async function listInvitations(req: Request, res: Response): Promise<void> {
  const invitations = await usersService.listInvitations(req.auth!.organizationId);
  res.json(invitations.map(toPublicInvitation));
}

export async function invite(req: Request, res: Response): Promise<void> {
  const { invitation, token } = await usersService.inviteUser(
    req.auth!.organizationId,
    req.auth!.userId,
    req.body,
  );
  // Phase 1 has no email provider yet (that arrives in Phase 3), so the raw
  // token + accept URL are returned for the admin to share manually.
  res.status(201).json({
    invitation: toPublicInvitation(invitation),
    token,
    acceptUrl: buildAcceptUrl(token),
  });
}

export async function revokeInvitation(req: Request, res: Response): Promise<void> {
  await usersService.revokeInvitation(req.auth!.organizationId, req.params.id);
  res.json({ ok: true });
}

export async function update(req: Request, res: Response): Promise<void> {
  const user = await usersService.updateUser(
    req.auth!.organizationId,
    req.auth!.userId,
    req.params.id,
    req.body,
  );
  res.json(toPublicUser(user));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await usersService.deleteUser(req.auth!.organizationId, req.auth!.userId, req.params.id);
  res.json({ ok: true });
}
