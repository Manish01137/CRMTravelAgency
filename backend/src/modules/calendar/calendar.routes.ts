import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './calendar.service';
import {
  calendarQuerySchema,
  createEventSchema,
  eventIdParam,
  updateEventSchema,
  type CalendarQuery,
} from './calendar.schemas';

const router = Router();
router.use(requireAuth);

// Merged feed: manual events + departures + returns + tasks for a range.
router.get(
  '/',
  validate({ query: calendarQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.getCalendarFeed(req.auth!.organizationId, req.query as unknown as CalendarQuery));
  }),
);

router.post(
  '/events',
  validate({ body: createEventSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createEvent(req.auth!.organizationId, req.body));
  }),
);

router.patch(
  '/events/:id',
  validate({ params: eventIdParam, body: updateEventSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.updateEvent(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/events/:id',
  validate({ params: eventIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteEvent(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
