import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './ai-agent.controller';
import { conversationIdBody, updateSettingsSchema } from './ai-agent.schemas';

// AI Agent Builder (Gemini) — per-organization persona + API key, plus the
// Inbox's "Suggest Reply"/"Summarize" actions. Human-in-the-loop by design:
// suggest/summarize only ever return text for an agent to review — nothing
// here sends a message on its own.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Slow down — too many AI requests' } },
});

const router = Router();
router.use(requireAuth);

router.get('/settings', asyncHandler(controller.getSettings));
router.patch('/settings', requireRole('ADMIN'), validate({ body: updateSettingsSchema }), asyncHandler(controller.updateSettings));
router.delete('/settings/key', requireRole('ADMIN'), asyncHandler(controller.clearKey));

router.post('/suggest-reply', aiLimiter, validate({ body: conversationIdBody }), asyncHandler(controller.suggestReply));
router.post('/summarize', aiLimiter, validate({ body: conversationIdBody }), asyncHandler(controller.summarize));

export default router;
