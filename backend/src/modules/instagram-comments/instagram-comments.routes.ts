import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as service from './instagram-comments.service';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

const idParam = z.object({ id: z.string().uuid('Invalid rule id') });
const mediaItem = z.object({
  id: z.string().trim().min(1).max(100),
  caption: z.string().max(300).nullish(),
  thumbnailUrl: z.string().max(2000).nullish(),
  permalink: z.string().max(500).nullish(),
});
const ruleFields = {
  name: z.string().trim().min(1, 'Give the rule a name').max(80),
  isActive: z.boolean(),
  media: z.array(mediaItem).max(50),
  keywords: z.array(z.string().trim().max(40)).max(30),
  packageId: z.string().uuid().nullable(),
  dmText: z.string().trim().min(1, 'Write the DM').max(900),
  publicReply: z.preprocess((v) => (typeof v === 'string' && !v.trim() ? null : v), z.string().trim().max(300).nullable()),
};
const createSchema = z.object(ruleFields);
const updateSchema = z.object(ruleFields).partial();

router.get('/rules', asyncHandler(async (req, res) => res.json(await service.listRules(req.auth!.organizationId))));
router.post('/rules', validate({ body: createSchema }), asyncHandler(async (req, res) => res.status(201).json(await service.createRule(req.auth!.organizationId, req.body))));
router.patch('/rules/:id', validate({ params: idParam, body: updateSchema }), asyncHandler(async (req, res) => res.json(await service.updateRule(req.auth!.organizationId, req.params.id, req.body))));
router.delete('/rules/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  await service.deleteRule(req.auth!.organizationId, req.params.id);
  res.status(204).end();
}));
router.get('/media', asyncHandler(async (req, res) => res.json(await service.listMedia(req.auth!.organizationId))));
router.get('/activity', asyncHandler(async (req, res) => res.json(await service.listActivity(req.auth!.organizationId))));

export default router;
