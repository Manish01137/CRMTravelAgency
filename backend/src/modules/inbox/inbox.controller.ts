import type { Request, Response } from 'express';
import * as service from './inbox.service';
import type { BotControlInput, CreateTemplateInput, ListConversationsQuery, SendMessageInput, SetFavoriteInput, StageCountsQuery, ListMessagesQuery, ReactInput, StarInput, PinInput, BulkMessagesInput, ForwardInput, ResolveLocationInput, ScheduleMessageInput, UpdateScheduledInput, CreateGroupInput, UpdateGroupInput } from './inbox.schemas';
import * as groups from './groups.service';
import * as scheduled from './scheduled.service';
import { controlChatBot, getChatBotState } from '../bot-flow/bot-flow.control';
import { assertConversationVisible, conversationScope, viewerOf } from '../../lib/visibility';

// Admins see every chat; an agent only the chats of leads assigned to them (lib/visibility.ts).
const checkAccess = (req: Request) => assertConversationVisible(req.auth!.organizationId, viewerOf(req), req.params.id);

export async function listConversations(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as ListConversationsQuery;
  res.json(await service.listConversations(req.auth!.organizationId, query, req.auth!.userId, conversationScope(viewerOf(req))));
}

export async function getBot(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await getChatBotState(req.auth!.organizationId, req.params.id));
}

export async function controlBot(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { action } = req.body as BotControlInput;
  res.json(await controlChatBot(req.auth!.organizationId, req.params.id, action));
}

export async function stageCounts(req: Request, res: Response): Promise<void> {
  res.json(await service.stageCounts(req.auth!.organizationId, req.query as unknown as StageCountsQuery, conversationScope(viewerOf(req))));
}

export async function setFavorite(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { isFavorite } = req.body as SetFavoriteInput;
  res.json(await service.setFavorite(req.auth!.organizationId, req.params.id, isFavorite));
}

export async function listMessages(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { after } = req.query as unknown as ListMessagesQuery;
  const result = await service.listMessages(req.auth!.organizationId, req.params.id, after);
  res.json(result);
}

export async function sendMessage(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const body = req.body as SendMessageInput;
  const message = await service.sendMessage(req.auth!.organizationId, req.params.id, req.auth!.userId, body);
  res.status(201).json(message);
}

export async function logCall(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const message = await service.logCall(req.auth!.organizationId, req.params.id, req.auth!.userId);
  res.status(201).json(message);
}

export async function reactToMessage(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { emoji } = req.body as ReactInput;
  res.json(await service.reactToMessage(req.auth!.organizationId, req.params.id, req.params.messageId, emoji));
}

export async function starMessage(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { starred } = req.body as StarInput;
  res.json(await service.starMessage(req.auth!.organizationId, req.params.id, req.params.messageId, starred));
}

export async function listStarredMessages(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await service.listStarredMessages(req.auth!.organizationId, req.params.id));
}

export async function pinMessage(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { pinned } = req.body as PinInput;
  res.json(await service.pinMessage(req.auth!.organizationId, req.params.id, req.params.messageId, pinned));
}

export async function bulkMessages(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { action, messageIds } = req.body as BulkMessagesInput;
  res.json(await service.bulkMessages(req.auth!.organizationId, req.params.id, req.auth!.userId, action, messageIds));
}

export async function forwardMessages(req: Request, res: Response): Promise<void> {
  const { fromConversationId, messageIds, toConversationIds } = req.body as ForwardInput;
  // The agent must be able to see the chat it forwards from, and every chat it forwards to.
  const viewer = viewerOf(req);
  for (const id of [fromConversationId, ...toConversationIds]) await assertConversationVisible(req.auth!.organizationId, viewer, id);
  res.json(await service.forwardMessages(req.auth!.organizationId, req.auth!.userId, fromConversationId, messageIds, toConversationIds));
}

export async function listSharedItems(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await service.listSharedItems(req.auth!.organizationId, req.params.id));
}

// --- Scheduled messages ---
export async function listScheduled(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await scheduled.listScheduled(req.auth!.organizationId, req.params.id));
}

export async function scheduleMessage(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  const { sendAt, message } = req.body as ScheduleMessageInput;
  res.status(201).json(await scheduled.scheduleMessage(req.auth!.organizationId, req.params.id, req.auth!.userId, sendAt, message));
}

export async function updateScheduled(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await scheduled.updateScheduled(req.auth!.organizationId, req.params.id, req.params.scheduledId, req.body as UpdateScheduledInput));
}

export async function cancelScheduled(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await scheduled.cancelScheduled(req.auth!.organizationId, req.params.id, req.params.scheduledId));
}

export async function sendScheduledNow(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await scheduled.sendScheduledNow(req.auth!.organizationId, req.params.id, req.params.scheduledId));
}

// --- Contact groups (broadcast lists) ---
const scopeOf = (req: Request) => conversationScope(viewerOf(req));
const editorOf = (req: Request) => ({ userId: req.auth!.userId, isAdmin: req.auth!.role === 'ADMIN' });

export async function listGroups(req: Request, res: Response): Promise<void> {
  const { channel } = req.query as { channel: 'WHATSAPP' | 'INSTAGRAM' };
  res.json(await groups.listGroups(req.auth!.organizationId, channel, scopeOf(req)));
}

export async function getGroup(req: Request, res: Response): Promise<void> {
  res.json(await groups.getGroup(req.auth!.organizationId, req.params.groupId, scopeOf(req)));
}

export async function createGroup(req: Request, res: Response): Promise<void> {
  res.status(201).json(await groups.createGroup(req.auth!.organizationId, req.auth!.userId, req.body as CreateGroupInput, scopeOf(req)));
}

export async function updateGroup(req: Request, res: Response): Promise<void> {
  res.json(await groups.updateGroup(req.auth!.organizationId, req.params.groupId, req.body as UpdateGroupInput, scopeOf(req), editorOf(req)));
}

export async function deleteGroup(req: Request, res: Response): Promise<void> {
  res.json(await groups.deleteGroup(req.auth!.organizationId, req.params.groupId, editorOf(req)));
}

export async function addGroupMembers(req: Request, res: Response): Promise<void> {
  const { conversationIds } = req.body as { conversationIds: string[] };
  res.json(await groups.addMembers(req.auth!.organizationId, req.params.groupId, conversationIds, scopeOf(req)));
}

export async function removeGroupMember(req: Request, res: Response): Promise<void> {
  res.json(await groups.removeMember(req.auth!.organizationId, req.params.groupId, req.params.conversationId, scopeOf(req)));
}

export async function sendToGroup(req: Request, res: Response): Promise<void> {
  res.json(await groups.sendToGroup(req.auth!.organizationId, req.params.groupId, req.auth!.userId, req.body as SendMessageInput, scopeOf(req)));
}

export async function groupsOfChat(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await groups.groupsOfChat(req.auth!.organizationId, req.params.id));
}

export async function listStickers(req: Request, res: Response): Promise<void> {
  res.json(await service.listRecentStickers(req.auth!.organizationId));
}

export async function resolveLocation(req: Request, res: Response): Promise<void> {
  const { link } = req.body as ResolveLocationInput;
  res.json(await service.resolveLocationLink(link));
}

export async function getMessageInfo(req: Request, res: Response): Promise<void> {
  await checkAccess(req);
  res.json(await service.getMessageInfo(req.auth!.organizationId, req.params.id, req.params.messageId));
}

export async function listTemplates(req: Request, res: Response): Promise<void> {
  res.json(await service.listTemplates(req.auth!.organizationId));
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  const body = req.body as CreateTemplateInput;
  res.status(201).json(await service.createTemplate(req.auth!.organizationId, body));
}
