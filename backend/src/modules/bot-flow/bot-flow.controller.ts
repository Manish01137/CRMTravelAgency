import type { Request, Response } from 'express';
import * as service from './bot-flow.service';
import type { AssignFlowInput, CreateFlowInput, UpdateFlowInput, UpsertStepInput } from './bot-flow.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listFlows(req.auth!.organizationId));
}

export async function get(req: Request, res: Response): Promise<void> {
  res.json(await service.getFlow(req.auth!.organizationId, req.params.id));
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateFlowInput;
  res.status(201).json(await service.createFlow(req.auth!.organizationId, body));
}

export async function update(req: Request, res: Response): Promise<void> {
  const body = req.body as UpdateFlowInput;
  res.json(await service.updateFlow(req.auth!.organizationId, req.params.id, body));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.deleteFlow(req.auth!.organizationId, req.params.id);
  res.json({ ok: true });
}

export async function createStep(req: Request, res: Response): Promise<void> {
  const body = req.body as UpsertStepInput;
  res.status(201).json(await service.createStep(req.auth!.organizationId, req.params.id, body));
}

export async function updateStep(req: Request, res: Response): Promise<void> {
  const body = req.body as UpsertStepInput;
  res.json(await service.updateStep(req.auth!.organizationId, req.params.id, req.params.stepId, body));
}

export async function deleteStep(req: Request, res: Response): Promise<void> {
  await service.deleteStep(req.auth!.organizationId, req.params.id, req.params.stepId);
  res.json({ ok: true });
}

export async function listAssignments(req: Request, res: Response): Promise<void> {
  res.json(await service.listAssignments(req.auth!.organizationId));
}

export async function assign(req: Request, res: Response): Promise<void> {
  const body = req.body as AssignFlowInput;
  res.json(await service.assignFlow(req.auth!.organizationId, body));
}

export async function unassign(req: Request, res: Response): Promise<void> {
  await service.unassignFlow(req.auth!.organizationId, req.params.channel as 'WHATSAPP' | 'INSTAGRAM');
  res.json({ ok: true });
}
