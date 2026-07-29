import type { Request, Response } from 'express';
import * as service from './call-log.service';
import type { ListCallLogQuery } from './call-log.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListCallLogQuery;
  res.json(await service.listCalls(req.auth!.organizationId, query));
}
