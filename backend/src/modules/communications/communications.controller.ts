import type { Request, Response } from 'express';
import * as service from './communications.service';
import type { SendEmailInput } from './communications.schemas';

export async function listLog(req: Request, res: Response): Promise<void> {
  res.json(await service.listLog(req.auth!.organizationId, req.params.leadId));
}

export async function sendEmail(req: Request, res: Response): Promise<void> {
  const body = req.body as SendEmailInput;
  const log = await service.sendLeadEmail(req.auth!.organizationId, req.params.leadId, req.auth!.userId, body);
  res.status(201).json(log);
}
