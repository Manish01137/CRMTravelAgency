import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './inbox.controller';
import {
  conversationIdParam,
  listMessagesQuerySchema,
  createTemplateSchema,
  listConversationsQuerySchema,
  sendMessageSchema,
  setFavoriteSchema,
  stageCountsQuerySchema,
  botControlSchema,
  messageIdParam,
  reactSchema,
  starSchema,
} from './inbox.schemas';

// Unified WhatsApp + Instagram inbox — ONE screen, filtered by `channel`
// (query param on conversations, implicit per-conversation elsewhere).
const router = Router();
router.use(requireAuth);

router.get('/conversations', validate({ query: listConversationsQuerySchema }), asyncHandler(controller.listConversations));
router.get('/conversations/stage-counts', validate({ query: stageCountsQuerySchema }), asyncHandler(controller.stageCounts));
router.patch(
  '/conversations/:id/favorite',
  validate({ params: conversationIdParam, body: setFavoriteSchema }),
  asyncHandler(controller.setFavorite),
);
router.get(
  '/conversations/:id/messages',
  validate({ params: conversationIdParam, query: listMessagesQuerySchema }),
  asyncHandler(controller.listMessages),
);
router.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParam, body: sendMessageSchema }),
  asyncHandler(controller.sendMessage),
);
// One message: react (WhatsApp), star (team-only), info.
router.get('/conversations/:id/starred', validate({ params: conversationIdParam }), asyncHandler(controller.listStarredMessages));
router.post('/conversations/:id/messages/:messageId/react', validate({ params: messageIdParam, body: reactSchema }), asyncHandler(controller.reactToMessage));
router.patch('/conversations/:id/messages/:messageId/star', validate({ params: messageIdParam, body: starSchema }), asyncHandler(controller.starMessage));
router.get('/conversations/:id/messages/:messageId', validate({ params: messageIdParam }), asyncHandler(controller.getMessageInfo));
router.post('/conversations/:id/log-call', validate({ params: conversationIdParam }), asyncHandler(controller.logCall));
router.get('/conversations/:id/bot', validate({ params: conversationIdParam }), asyncHandler(controller.getBot));
router.post('/conversations/:id/bot', validate({ params: conversationIdParam, body: botControlSchema }), asyncHandler(controller.controlBot));

router.get('/templates', asyncHandler(controller.listTemplates));
router.post('/templates', validate({ body: createTemplateSchema }), asyncHandler(controller.createTemplate));

export default router;
