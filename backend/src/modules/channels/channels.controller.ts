import type { Request, Response } from 'express';
import * as service from './channels.service';
import type {
  ConnectEmailInput,
  ConnectInstagramInput,
  ConnectWhatsAppInput,
  SelectInstagramPageInput,
} from './channels.schemas';

export async function getConfig(_req: Request, res: Response): Promise<void> {
  res.json(await service.getPlatformConfig());
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listChannels(req.auth!.organizationId));
}

export async function connectWhatsApp(req: Request, res: Response): Promise<void> {
  const body = req.body as ConnectWhatsAppInput;
  res.json(await service.connectWhatsApp(req.auth!.organizationId, body));
}

export async function connectInstagram(req: Request, res: Response): Promise<void> {
  const body = req.body as ConnectInstagramInput;
  res.json(await service.connectInstagram(req.auth!.organizationId, body));
}

export async function selectInstagramPage(req: Request, res: Response): Promise<void> {
  const body = req.body as SelectInstagramPageInput;
  res.json(await service.selectInstagramPage(req.auth!.organizationId, body));
}

export async function connectEmail(req: Request, res: Response): Promise<void> {
  const body = req.body as ConnectEmailInput;
  res.json(await service.connectEmail(req.auth!.organizationId, body));
}

export async function disconnect(req: Request, res: Response): Promise<void> {
  await service.disconnectChannel(req.auth!.organizationId, req.params.channel as never);
  res.json({ ok: true });
}
