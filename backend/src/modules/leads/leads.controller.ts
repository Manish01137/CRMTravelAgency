import type { Request, Response } from 'express';
import * as leadsService from './leads.service';
import type { BulkImportLeadsInput, ListLeadsQuery } from './leads.schemas';
import { assertLeadVisible, leadScope, seesEverything, viewerOf } from '../../lib/visibility';

// Admins see every lead; an agent only the leads assigned to them (lib/visibility.ts).

export async function list(req: Request, res: Response): Promise<void> {
  const result = await leadsService.listLeads(
    req.auth!.organizationId,
    req.query as unknown as ListLeadsQuery,
    leadScope(viewerOf(req)),
  );
  res.json(result);
}

export async function stats(req: Request, res: Response): Promise<void> {
  const result = await leadsService.getLeadStats(req.auth!.organizationId, leadScope(viewerOf(req)));
  res.json(result);
}

export async function get(req: Request, res: Response): Promise<void> {
  await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.id);
  const lead = await leadsService.getLead(req.auth!.organizationId, req.params.id);
  res.json(lead);
}

export async function create(req: Request, res: Response): Promise<void> {
  // An agent's own new lead is theirs — otherwise it would vanish from their list.
  const viewer = viewerOf(req);
  const body = !seesEverything(viewer) && !req.body.assignedToId ? { ...req.body, assignedToId: viewer.userId } : req.body;
  const lead = await leadsService.createLead(req.auth!.organizationId, body);
  res.status(201).json(lead);
}

export async function bulkImport(req: Request, res: Response): Promise<void> {
  const { leads } = req.body as BulkImportLeadsInput;
  const viewer = viewerOf(req);
  const rows = seesEverything(viewer)
    ? leads
    : leads.map((row) => (row && typeof row === 'object' && !(row as { assignedToId?: unknown }).assignedToId ? { ...row, assignedToId: viewer.userId } : row));
  const result = await leadsService.bulkImportLeads(req.auth!.organizationId, rows);
  res.status(201).json(result);
}

export async function update(req: Request, res: Response): Promise<void> {
  await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.id);
  const lead = await leadsService.updateLead(
    req.auth!.organizationId,
    req.params.id,
    req.body,
    req.auth!.userId,
  );
  res.json(lead);
}

export async function listActivities(req: Request, res: Response): Promise<void> {
  await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.id);
  const activities = await leadsService.listActivities(req.auth!.organizationId, req.params.id);
  res.json(activities);
}

export async function createActivity(req: Request, res: Response): Promise<void> {
  await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.id);
  const activity = await leadsService.createActivity(
    req.auth!.organizationId,
    req.params.id,
    req.body,
    req.auth!.userId,
  );
  res.status(201).json(activity);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.id);
  await leadsService.deleteLead(req.auth!.organizationId, req.params.id);
  res.json({ ok: true });
}
