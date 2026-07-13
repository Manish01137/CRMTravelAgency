import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './bills.service';
import {
  billIdParam,
  createBillSchema,
  listBillsQuerySchema,
  updateBillSchema,
  type ListBillsQuery,
} from './bills.schemas';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listBillsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listBills(req.auth!.organizationId, req.query as unknown as ListBillsQuery));
  }),
);

router.post(
  '/',
  validate({ body: createBillSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createBill(req.auth!.organizationId, req.body));
  }),
);

router.patch(
  '/:id',
  validate({ params: billIdParam, body: updateBillSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.updateBill(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  validate({ params: billIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteBill(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
