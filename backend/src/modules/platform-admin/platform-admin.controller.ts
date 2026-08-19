import type { Request, Response } from 'express';
import * as service from './platform-admin.service';
import { signPlatformAdminToken } from '../../lib/jwt';
import { setPlatformAdminCookie, clearPlatformAdminCookie } from '../../lib/cookies';
import { Unauthorized } from '../../lib/errors';
import type {
  AuditLogQuery,
  GrowthQuery,
  ListOrganizationsQuery,
  ListUsersQuery,
  SearchQuery,
} from './platform-admin.schemas';

function issueSession(res: Response, admin: service.PlatformAdminSession) {
  const token = signPlatformAdminToken(admin.id, admin.email);
  setPlatformAdminCookie(res, token);
  return { token, admin };
}

/** Every mutating route reads the acting admin off req.platformAdmin (set by
 *  requirePlatformAdmin) so the service layer can attribute an audit entry. */
function actor(req: Request): service.PlatformActor {
  return { adminId: req.platformAdmin!.adminId, adminEmail: req.platformAdmin!.email };
}

export async function login(req: Request, res: Response): Promise<void> {
  const admin = await service.login(req.body);
  res.json(issueSession(res, admin));
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearPlatformAdminCookie(res);
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.platformAdmin) throw Unauthorized();
  const admin = await service.getSession(req.platformAdmin.adminId);
  res.json({ admin });
}

export async function stats(_req: Request, res: Response): Promise<void> {
  res.json(await service.getPlatformStats());
}

export async function listOrganizations(req: Request, res: Response): Promise<void> {
  res.json(await service.listOrganizations(req.query as unknown as ListOrganizationsQuery));
}

export async function getOrganization(req: Request, res: Response): Promise<void> {
  res.json(await service.getOrganization(req.params.id));
}

export async function createOrganization(req: Request, res: Response): Promise<void> {
  res.status(201).json(await service.createOrganization(req.body, actor(req)));
}

export async function updateOrganizationStatus(req: Request, res: Response): Promise<void> {
  res.json(await service.updateOrganizationStatus(req.params.id, req.body, actor(req)));
}

export async function listOrganizationNotes(req: Request, res: Response): Promise<void> {
  res.json(await service.listOrganizationNotes(req.params.id));
}

export async function addOrganizationNote(req: Request, res: Response): Promise<void> {
  res.status(201).json(await service.addOrganizationNote(req.params.id, req.body, actor(req)));
}

export async function deleteOrganizationNote(req: Request, res: Response): Promise<void> {
  await service.deleteOrganizationNote(req.params.id, req.params.noteId);
  res.json({ ok: true });
}

export async function listUsers(req: Request, res: Response): Promise<void> {
  res.json(await service.listUsers(req.query as unknown as ListUsersQuery));
}

export async function updateUserStatus(req: Request, res: Response): Promise<void> {
  res.json(await service.updateUserStatus(req.params.id, req.body, actor(req)));
}

export async function channelHealth(_req: Request, res: Response): Promise<void> {
  res.json(await service.getChannelHealth());
}

export async function growth(req: Request, res: Response): Promise<void> {
  res.json(await service.getGrowth(req.query as unknown as GrowthQuery));
}

export async function search(req: Request, res: Response): Promise<void> {
  res.json(await service.search(req.query as unknown as SearchQuery));
}

export async function auditLog(req: Request, res: Response): Promise<void> {
  res.json(await service.listAuditLog(req.query as unknown as AuditLogQuery));
}
