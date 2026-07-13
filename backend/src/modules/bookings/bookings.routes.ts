import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './bookings.service';
import {
  bookingIdParam,
  createBookingSchema,
  createFromLeadSchema,
  itinerarySchema,
  leadIdParam,
  listBookingsQuerySchema,
  updateBookingSchema,
  type ListBookingsQuery,
} from './bookings.schemas';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listBookingsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listBookings(req.auth!.organizationId, req.query as unknown as ListBookingsQuery));
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getBookingStats(req.auth!.organizationId));
  }),
);

router.post(
  '/',
  validate({ body: createBookingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createBooking(req.auth!.organizationId, req.body));
  }),
);

router.post(
  '/from-lead/:leadId',
  validate({ params: leadIdParam, body: createFromLeadSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createFromLead(req.auth!.organizationId, req.params.leadId, req.body));
  }),
);

router.get(
  '/:id',
  validate({ params: bookingIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getBooking(req.auth!.organizationId, req.params.id));
  }),
);

router.patch(
  '/:id',
  validate({ params: bookingIdParam, body: updateBookingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.updateBooking(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  validate({ params: bookingIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteBooking(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

router.put(
  '/:id/itinerary',
  validate({ params: bookingIdParam, body: itinerarySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.setItinerary(req.auth!.organizationId, req.params.id, req.body));
  }),
);

export default router;
