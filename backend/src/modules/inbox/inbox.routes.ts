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
  pinSchema,
  bulkMessagesSchema,
  forwardSchema,
  resolveLocationSchema,
  scheduledIdParam,
  scheduleMessageSchema,
  updateScheduledSchema,
  groupIdParam,
  groupMemberParam,
  listGroupsQuerySchema,
  createGroupSchema,
  updateGroupSchema,
  groupMembersSchema,
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
router.patch('/conversations/:id/messages/:messageId/pin', validate({ params: messageIdParam, body: pinSchema }), asyncHandler(controller.pinMessage));
router.post('/conversations/:id/messages/bulk', validate({ params: conversationIdParam, body: bulkMessagesSchema }), asyncHandler(controller.bulkMessages));
router.get('/conversations/:id/messages/:messageId', validate({ params: messageIdParam }), asyncHandler(controller.getMessageInfo));
router.post('/forward', validate({ body: forwardSchema }), asyncHandler(controller.forwardMessages));
router.post('/location/resolve', validate({ body: resolveLocationSchema }), asyncHandler(controller.resolveLocation));
router.get('/conversations/:id/shared', validate({ params: conversationIdParam }), asyncHandler(controller.listSharedItems));
// Scheduled messages (sent later by queues/scheduled-messages.ts).
router.get('/conversations/:id/scheduled', validate({ params: conversationIdParam }), asyncHandler(controller.listScheduled));
router.post('/conversations/:id/scheduled', validate({ params: conversationIdParam, body: scheduleMessageSchema }), asyncHandler(controller.scheduleMessage));
router.patch('/conversations/:id/scheduled/:scheduledId', validate({ params: scheduledIdParam, body: updateScheduledSchema }), asyncHandler(controller.updateScheduled));
router.delete('/conversations/:id/scheduled/:scheduledId', validate({ params: scheduledIdParam }), asyncHandler(controller.cancelScheduled));
router.post('/conversations/:id/scheduled/:scheduledId/send', validate({ params: scheduledIdParam }), asyncHandler(controller.sendScheduledNow));
// Contact groups (broadcast lists): one message to many chats, each sent separately.
router.get('/groups', validate({ query: listGroupsQuerySchema }), asyncHandler(controller.listGroups));
router.post('/groups', validate({ body: createGroupSchema }), asyncHandler(controller.createGroup));
router.get('/groups/:groupId', validate({ params: groupIdParam }), asyncHandler(controller.getGroup));
router.patch('/groups/:groupId', validate({ params: groupIdParam, body: updateGroupSchema }), asyncHandler(controller.updateGroup));
router.delete('/groups/:groupId', validate({ params: groupIdParam }), asyncHandler(controller.deleteGroup));
router.post('/groups/:groupId/members', validate({ params: groupIdParam, body: groupMembersSchema }), asyncHandler(controller.addGroupMembers));
router.delete('/groups/:groupId/members/:conversationId', validate({ params: groupMemberParam }), asyncHandler(controller.removeGroupMember));
router.post('/groups/:groupId/send', validate({ params: groupIdParam, body: sendMessageSchema }), asyncHandler(controller.sendToGroup));
router.get('/conversations/:id/groups', validate({ params: conversationIdParam }), asyncHandler(controller.groupsOfChat));
router.get('/stickers', asyncHandler(controller.listStickers));
router.post('/conversations/:id/log-call', validate({ params: conversationIdParam }), asyncHandler(controller.logCall));
router.get('/conversations/:id/bot', validate({ params: conversationIdParam }), asyncHandler(controller.getBot));
router.post('/conversations/:id/bot', validate({ params: conversationIdParam, body: botControlSchema }), asyncHandler(controller.controlBot));

router.get('/templates', asyncHandler(controller.listTemplates));
router.post('/templates', validate({ body: createTemplateSchema }), asyncHandler(controller.createTemplate));

export default router;
