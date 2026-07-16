import type { Request, Response } from 'express';
import * as leadsService from './leads.service';
import type { ListLeadsQuery } from './leads.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  const result = await leadsService.listLeads(
    req.auth!.organizationId,
    req.query as unknown as ListLeadsQuery,
  );
  res.json(result);
}

export async function stats(req: Request, res: Response): Promise<void> {
  const result = await leadsService.getLeadStats(req.auth!.organizationId);
  res.json(result);
}

export async function get(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.getLead(req.auth!.organizationId, req.params.id);
  res.json(lead);
}

export async function create(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.createLead(req.auth!.organizationId, req.body);
  res.status(201).json(lead);
}

export async function update(req: Request, res: Response): Promise<void> {
  const lead = await leadsService.updateLead(
    req.auth!.organizationId,
    req.params.id,
    req.body,
    req.auth!.userId,
  );
  res.json(lead);
}

export async function listActivities(req: Request, res: Response): Promise<void> {
  const activities = await leadsService.listActivities(req.auth!.organizationId, req.params.id);
  res.json(activities);
}

export async function createActivity(req: Request, res: Response): Promise<void> {
  const activity = await leadsService.createActivity(
    req.auth!.organizationId,
    req.params.id,
    req.body,
    req.auth!.userId,
  );
  res.status(201).json(activity);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await leadsService.deleteLead(req.auth!.organizationId, req.params.id);
  res.json({ ok: true });
}
