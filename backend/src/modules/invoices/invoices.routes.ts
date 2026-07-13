import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './invoices.service';
import {
  bookingIdParamInv,
  createInvoiceSchema,
  invoiceIdParam,
  listInvoicesQuerySchema,
  updateInvoiceSchema,
  type ListInvoicesQuery,
} from './invoices.schemas';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listInvoicesQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listInvoices(req.auth!.organizationId, req.query as unknown as ListInvoicesQuery));
  }),
);

router.post(
  '/',
  validate({ body: createInvoiceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createInvoice(req.auth!.organizationId, req.body));
  }),
);

router.post(
  '/from-booking/:bookingId',
  validate({ params: bookingIdParamInv }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createFromBooking(req.auth!.organizationId, req.params.bookingId));
  }),
);

router.get(
  '/:id',
  validate({ params: invoiceIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getInvoice(req.auth!.organizationId, req.params.id));
  }),
);

router.patch(
  '/:id',
  validate({ params: invoiceIdParam, body: updateInvoiceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.updateInvoice(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  validate({ params: invoiceIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteInvoice(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
