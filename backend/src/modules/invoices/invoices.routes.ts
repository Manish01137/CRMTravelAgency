import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './invoices.service';
import { assertBookingVisible, assertInvoiceVisible, invoiceScope, viewerOf } from '../../lib/visibility';
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

// An agent sees only the invoices of their own bookings (lib/visibility.ts).
const checkAccess = (req: Request) => assertInvoiceVisible(req.auth!.organizationId, viewerOf(req), req.params.id);

router.get(
  '/',
  validate({ query: listInvoicesQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listInvoices(req.auth!.organizationId, req.query as unknown as ListInvoicesQuery, invoiceScope(viewerOf(req))));
  }),
);

router.post(
  '/',
  validate({ body: createInvoiceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.body.bookingId) await assertBookingVisible(req.auth!.organizationId, viewerOf(req), req.body.bookingId);
    res.status(201).json(await service.createInvoice(req.auth!.organizationId, req.body));
  }),
);

router.post(
  '/from-booking/:bookingId',
  validate({ params: bookingIdParamInv }),
  asyncHandler(async (req: Request, res: Response) => {
    await assertBookingVisible(req.auth!.organizationId, viewerOf(req), req.params.bookingId);
    res.status(201).json(await service.createFromBooking(req.auth!.organizationId, req.params.bookingId));
  }),
);

router.get(
  '/:id',
  validate({ params: invoiceIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await checkAccess(req);
    res.json(await service.getInvoice(req.auth!.organizationId, req.params.id));
  }),
);

router.patch(
  '/:id',
  validate({ params: invoiceIdParam, body: updateInvoiceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await checkAccess(req);
    res.json(await service.updateInvoice(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  validate({ params: invoiceIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await checkAccess(req);
    await service.deleteInvoice(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
