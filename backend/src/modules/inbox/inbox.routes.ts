import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './inbox.controller';
import {
  conversationIdParam,
  createTemplateSchema,
  listConversationsQuerySchema,
  sendMessageSchema,
} from './inbox.schemas';

// Unified WhatsApp + Instagram inbox — ONE screen, filtered by `channel`
// (query param on conversations, implicit per-conversation elsewhere).
const router = Router();
router.use(requireAuth);

router.get('/conversations', validate({ query: listConversationsQuerySchema }), asyncHandler(controller.listConversations));
router.get('/conversations/:id/messages', validate({ params: conversationIdParam }), asyncHandler(controller.listMessages));
router.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParam, body: sendMessageSchema }),
  asyncHandler(controller.sendMessage),
);

router.get('/templates', asyncHandler(controller.listTemplates));
router.post('/templates', validate({ body: createTemplateSchema }), asyncHandler(controller.createTemplate));

export default router;
