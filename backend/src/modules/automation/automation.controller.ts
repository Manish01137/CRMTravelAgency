import type { Request, Response } from 'express';
import * as service from './automation.service';
import type { ListAttemptsQuery, UpdateAutomationInput } from './automation.schemas';

export async function getSettings(req: Request, res: Response): Promise<void> {
  res.json(await service.getSettings(req.auth!.organizationId));
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdateAutomationInput;
  res.json(await service.updateSettings(req.auth!.organizationId, body));
}

export async function listAttempts(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListAttemptsQuery;
  res.json(await service.listAttempts(req.auth!.organizationId, query));
}
