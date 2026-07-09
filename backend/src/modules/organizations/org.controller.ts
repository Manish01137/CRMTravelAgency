import type { Request, Response } from 'express';
import * as orgService from './org.service';

export async function getOrganization(req: Request, res: Response): Promise<void> {
  const organization = await orgService.getOrganization(req.auth!.organizationId);
  res.json(organization);
}

export async function updateOrganization(req: Request, res: Response): Promise<void> {
  const organization = await orgService.updateOrganization(req.auth!.organizationId, req.body);
  res.json(organization);
}
