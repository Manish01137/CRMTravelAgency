import type { ConversationChannel, Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { AppError, BadRequest, Forbidden, NotFound } from '../../lib/errors';
import { sendMessage } from './inbox.service';
import type { SendMessageInput } from './inbox.schemas';

/**
 * Contact groups ("broadcast lists"): a named list of chats on one channel.
 * Sending to a group sends the same message to each chat separately, through
 * the normal Inbox send — so the 24-hour rule, templates, failures and the
 * chat history all work exactly as for a single message.
 */

export const MAX_GROUP_MEMBERS = 100;
const SEND_CONCURRENCY = 5;

const MEMBER_CONVERSATION = {
  id: true,
  channel: true,
  contactName: true,
  contactPhone: true,
  contactAvatarUrl: true,
  externalContactId: true,
  lastInboundAt: true,
} satisfies Prisma.ConversationSelect;

export async function listGroups(organizationId: string, channel: ConversationChannel, scope: Prisma.ConversationWhereInput) {
  return withTenant(organizationId, async (tx) => {
    const groups = await tx.contactGroup.findMany({
      where: { channel },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, description: true, channel: true, createdAt: true, updatedAt: true, createdBy: { select: { id: true, name: true } } },
    });
    // How many members this person can see in each (agents: only their own chats).
    const counts = await tx.contactGroupMember.groupBy({
      by: ['groupId'],
      where: { groupId: { in: groups.map((g) => g.id) }, conversation: scope },
      _count: { _all: true },
    });
    return groups.map((g) => ({ ...g, memberCount: counts.find((c) => c.groupId === g.id)?._count._all ?? 0 }));
  });
}

export async function getGroup(organizationId: string, groupId: string, scope: Prisma.ConversationWhereInput) {
  return withTenant(organizationId, async (tx) => {
    const group = await tx.contactGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        description: true,
        channel: true,
        createdAt: true,
        updatedAt: true,
        createdBy: { select: { id: true, name: true } },
        members: { where: { conversation: scope }, orderBy: { addedAt: 'asc' }, select: { addedAt: true, conversation: { select: MEMBER_CONVERSATION } } },
      },
    });
    if (!group) throw NotFound('Group not found');
    return { ...group, members: group.members.map((m) => ({ ...m.conversation, addedAt: m.addedAt })) };
  });
}

/** The chats must exist, be on the group's channel, and be visible to this person. */
async function checkChats(tx: Prisma.TransactionClient, channel: ConversationChannel, conversationIds: string[], scope: Prisma.ConversationWhereInput) {
  const ids = [...new Set(conversationIds)];
  const found = await tx.conversation.count({ where: { id: { in: ids }, channel, AND: [scope] } });
  if (found !== ids.length) throw BadRequest(`Some of those chats aren’t ${channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} chats you can see`);
  return ids;
}

export async function createGroup(
  organizationId: string,
  userId: string,
  input: { channel: ConversationChannel; name: string; description?: string; conversationIds: string[] },
  scope: Prisma.ConversationWhereInput,
) {
  if (input.conversationIds.length > MAX_GROUP_MEMBERS) throw BadRequest(`A group can have up to ${MAX_GROUP_MEMBERS} chats`);
  const id = await withTenant(organizationId, async (tx) => {
    const ids = await checkChats(tx, input.channel, input.conversationIds, scope);
    const group = await tx.contactGroup.create({
      data: { organizationId, channel: input.channel, name: input.name, description: input.description || null, createdById: userId },
      select: { id: true },
    });
    if (ids.length) await tx.contactGroupMember.createMany({ data: ids.map((conversationId) => ({ organizationId, groupId: group.id, conversationId })) });
    return group.id;
  });
  return getGroup(organizationId, id, scope);
}

/** Renaming / deleting a group: an admin, or the teammate who made it. */
export type GroupEditor = { userId: string; isAdmin: boolean };
async function assertCanEdit(tx: Prisma.TransactionClient, groupId: string, editor: GroupEditor) {
  const found = await tx.contactGroup.findUnique({ where: { id: groupId }, select: { createdById: true } });
  if (!found) throw NotFound('Group not found');
  if (!editor.isAdmin && found.createdById !== editor.userId) throw Forbidden('Only an admin or the teammate who made this group can change it');
}

export async function updateGroup(
  organizationId: string,
  groupId: string,
  input: { name?: string; description?: string | null },
  scope: Prisma.ConversationWhereInput,
  editor: GroupEditor,
) {
  await withTenant(organizationId, async (tx) => {
    await assertCanEdit(tx, groupId, editor);
    await tx.contactGroup.update({
      where: { id: groupId },
      data: { ...(input.name !== undefined && { name: input.name }), ...(input.description !== undefined && { description: input.description || null }) },
    });
  });
  return getGroup(organizationId, groupId, scope);
}

export async function deleteGroup(organizationId: string, groupId: string, editor: GroupEditor) {
  return withTenant(organizationId, async (tx) => {
    await assertCanEdit(tx, groupId, editor);
    await tx.contactGroup.delete({ where: { id: groupId } });
    return { ok: true };
  });
}

export async function addMembers(organizationId: string, groupId: string, conversationIds: string[], scope: Prisma.ConversationWhereInput) {
  await withTenant(organizationId, async (tx) => {
    const group = await tx.contactGroup.findUnique({ where: { id: groupId }, select: { channel: true, _count: { select: { members: true } } } });
    if (!group) throw NotFound('Group not found');
    const ids = await checkChats(tx, group.channel, conversationIds, scope);
    const existing = await tx.contactGroupMember.findMany({ where: { groupId, conversationId: { in: ids } }, select: { conversationId: true } });
    const fresh = ids.filter((id) => !existing.some((e) => e.conversationId === id));
    if (group._count.members + fresh.length > MAX_GROUP_MEMBERS) throw BadRequest(`A group can have up to ${MAX_GROUP_MEMBERS} chats`);
    if (fresh.length) await tx.contactGroupMember.createMany({ data: fresh.map((conversationId) => ({ organizationId, groupId, conversationId })) });
    await tx.contactGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } });
  });
  return getGroup(organizationId, groupId, scope);
}

export async function removeMember(organizationId: string, groupId: string, conversationId: string, scope: Prisma.ConversationWhereInput) {
  await withTenant(organizationId, async (tx) => {
    const deleted = await tx.contactGroupMember.deleteMany({ where: { groupId, conversationId, conversation: scope } });
    if (deleted.count === 0) throw NotFound('That chat isn’t in this group');
  });
  return getGroup(organizationId, groupId, scope);
}

/** The groups one chat belongs to (chat header → "Groups"). */
export async function groupsOfChat(organizationId: string, conversationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.contactGroup.findMany({ where: { members: { some: { conversationId } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  );
}

export type GroupSendResult = { conversationId: string; name: string; sent: boolean; error?: string };

/** One message to every chat in the group (that this person can see), a few at a time. */
export async function sendToGroup(organizationId: string, groupId: string, userId: string, input: SendMessageInput, scope: Prisma.ConversationWhereInput) {
  const group = await getGroup(organizationId, groupId, scope);
  if (group.members.length === 0) throw BadRequest('This group has no chats yet');
  const { replyToMessageId: _r, ...message } = input;
  const results: GroupSendResult[] = [];
  const queue = [...group.members];
  const worker = async () => {
    for (let m = queue.shift(); m; m = queue.shift()) {
      const name = m.contactName || m.contactPhone || m.externalContactId;
      try {
        await sendMessage(organizationId, m.id, userId, message as SendMessageInput);
        results.push({ conversationId: m.id, name, sent: true });
      } catch (err) {
        results.push({ conversationId: m.id, name, sent: false, error: err instanceof AppError || err instanceof Error ? err.message : 'Could not send' });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(SEND_CONCURRENCY, queue.length) }, worker));
  const order = new Map(group.members.map((m, i) => [m.id, i]));
  results.sort((a, b) => order.get(a.conversationId)! - order.get(b.conversationId)!);
  return { sent: results.filter((r) => r.sent).length, failed: results.filter((r) => !r.sent).length, results };
}
