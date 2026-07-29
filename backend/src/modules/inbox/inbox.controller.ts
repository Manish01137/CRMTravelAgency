import type { Request, Response } from 'express';
import * as service from './inbox.service';
import type { CreateTemplateInput, ListConversationsQuery, SendMessageInput } from './inbox.schemas';

export async function listConversations(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListConversationsQuery;
  res.json(await service.listConversations(req.auth!.organizationId, query));
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  const result = await service.listMessages(req.auth!.organizationId, req.params.id);
  res.json(result);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  const body = req.body as SendMessageInput;
  const message = await service.sendMessage(req.auth!.organizationId, req.params.id, req.auth!.userId, body);
  res.status(201).json(message);
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  res.json(await service.listTemplates(req.auth!.organizationId));
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateTemplateInput;
  res.status(201).json(await service.createTemplate(req.auth!.organizationId, body));
}
