import type { Request, Response } from 'express';
import * as service from './ai-agent.service';
import type { UpdateSettingsInput } from './ai-agent.schemas';

export async function getSettings(req: Request, res: Response): Promise<void> {
  res.json(await service.getSettings(req.auth!.organizationId));
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdateSettingsInput;
  res.json(await service.updateSettings(req.auth!.organizationId, body));
}

export async function clearKey(req: Request, res: Response): Promise<void> {
  res.json(await service.clearGeminiKey(req.auth!.organizationId));
}

export async function suggestReply(req: Request, res: Response): Promise<void> {
  const { conversationId } = req.body as { conversationId: string };
  const reply = await service.suggestReplyForConversation(req.auth!.organizationId, conversationId);
  res.json({ reply });
}

export async function summarize(req: Request, res: Response): Promise<void> {
  const { conversationId } = req.body as { conversationId: string };
  const summary = await service.summarizeConversationById(req.auth!.organizationId, conversationId);
  res.json({ summary });
}
