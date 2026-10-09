import { Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { BadRequest, Conflict, NotFound } from '../../lib/errors';
import type { TenantTx } from '../../lib/prisma';
import { toChannels, toTriggerFlow, type BotChannelName } from './bot-flow.triggers';
import { BOT_FLOW_TEMPLATES, instantiateTemplate } from './bot-flow.templates';
import type { AssignFlowInput, CreateFlowInput, CreateFromTemplateInput, UpdateFlowInput, UpsertStepInput } from './bot-flow.schemas';

/** Prisma's Json? columns need the Prisma.JsonNull sentinel for an explicit JSON null — a plain `null` is a type error. */
function jsonOrNull(v: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (v === null) return Prisma.JsonNull;
  if (v === undefined) return undefined;
  return v as Prisma.InputJsonValue;
}

/** Static metadata only — the actual step definitions live in bot-flow.templates.ts. */
export function listTemplates() {
  return BOT_FLOW_TEMPLATES.map((t) => ({ key: t.key, name: t.name, description: t.description, stepCount: t.steps.length }));
}

export async function createFlowFromTemplate(organizationId: string, input: CreateFromTemplateInput) {
  return withTenant(organizationId, (tx) => instantiateTemplate(tx, organizationId, input.templateKey));
}

export async function listFlows(organizationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.botFlow.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { steps: true, assignments: true } } },
    }),
  );
}

export async function getFlow(organizationId: string, flowId: string) {
  return withTenant(organizationId, async (tx) => {
    const flow = await tx.botFlow.findUnique({
      where: { id: flowId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!flow || flow.organizationId !== organizationId) throw NotFound('Flow not found');
    return flow;
  });
}

/** Case-insensitive de-duplication, keeping the first spelling. */
function uniqueWords(words: string[]): string[] {
  const seen = new Set<string>();
  return words.filter((w) => {
    const k = w.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** One ad or keyword starts one flow — refuse a trigger another active flow already uses. */
const CHANNEL_LABEL: Record<BotChannelName, string> = { WHATSAPP: 'WhatsApp', INSTAGRAM: 'Instagram' };

/**
 * One ad or keyword starts one flow per channel — refuse a trigger another
 * active flow already uses on the same channel (a WhatsApp flow and an
 * Instagram flow may share "hello").
 */
async function assertTriggersFree(
  tx: TenantTx,
  organizationId: string,
  flowId: string | null,
  keywords: string[],
  adIds: string[],
  channels: BotChannelName[],
) {
  if (keywords.length === 0 && adIds.length === 0) return;
  const others = await tx.botFlow.findMany({
    where: { organizationId, isActive: true, ...(flowId ? { id: { not: flowId } } : {}) },
    select: { id: true, name: true, triggerKeywords: true, keywordMatch: true, triggerAdIds: true, triggerChannels: true },
  });
  for (const other of others) {
    const t = toTriggerFlow(other);
    const shared = channels.filter((c) => t.channels.includes(c));
    if (shared.length === 0) continue;
    const on = shared.map((c) => CHANNEL_LABEL[c]).join(' and ');
    const ad = adIds.find((a) => t.triggerAdIds.includes(a));
    if (ad) throw Conflict(`Ad ${ad} already starts the flow "${other.name}" on ${on}`);
    const kw = keywords.find((k) => t.triggerKeywords.some((o) => o.trim().toLowerCase() === k.trim().toLowerCase()));
    if (kw) throw Conflict(`"${kw}" already starts the flow "${other.name}" on ${on} — remove it there, or set the two flows to different channels`);
  }
}

export async function createFlow(organizationId: string, input: CreateFlowInput) {
  return withTenant(organizationId, async (tx) => {
    const triggerKeywords = uniqueWords(input.triggerKeywords);
    const triggerAdIds = [...new Set(input.triggerAdIds)];
    const triggerChannels = toChannels(input.triggerChannels);
    if (input.isActive) await assertTriggersFree(tx, organizationId, null, triggerKeywords, triggerAdIds, triggerChannels);
    return tx.botFlow.create({
      data: {
        organizationId,
        name: input.name,
        ...(input.fallbackMessage !== undefined && { fallbackMessage: input.fallbackMessage }),
        needsReviewKeywords: input.needsReviewKeywords,
        isActive: input.isActive,
        triggerKeywords,
        keywordMatch: input.keywordMatch,
        triggerAdIds,
        restartOnGreeting: input.restartOnGreeting,
        aiFollowUp: input.aiFollowUp,
        triggerChannels,
      },
    });
  });
}

export async function updateFlow(organizationId: string, flowId: string, input: UpdateFlowInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.botFlow.findUnique({ where: { id: flowId } });
    if (!existing || existing.organizationId !== organizationId) throw NotFound('Flow not found');
    const data = {
      ...input,
      ...(input.triggerKeywords && { triggerKeywords: uniqueWords(input.triggerKeywords) }),
      ...(input.triggerAdIds && { triggerAdIds: [...new Set(input.triggerAdIds)] }),
      ...(input.triggerChannels && { triggerChannels: toChannels(input.triggerChannels) }),
    };
    const current = toTriggerFlow(existing);
    if (data.isActive ?? existing.isActive) {
      await assertTriggersFree(
        tx,
        organizationId,
        flowId,
        data.triggerKeywords ?? current.triggerKeywords,
        data.triggerAdIds ?? current.triggerAdIds,
        data.triggerChannels ?? current.channels,
      );
    }
    return tx.botFlow.update({ where: { id: flowId }, data });
  });
}

export async function deleteFlow(organizationId: string, flowId: string) {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.botFlow.deleteMany({ where: { id: flowId, organizationId } });
    if (result.count === 0) throw NotFound('Flow not found');
  });
}

// --- Steps -------------------------------------------------------------------

export async function createStep(organizationId: string, flowId: string, input: UpsertStepInput) {
  return withTenant(organizationId, async (tx) => {
    const flow = await tx.botFlow.findUnique({ where: { id: flowId } });
    if (!flow || flow.organizationId !== organizationId) throw NotFound('Flow not found');
    return tx.botFlowStep.create({
      data: {
        organizationId,
        flowId,
        type: input.type,
        order: input.order,
        question: input.question,
        leadField: input.leadField,
        options: jsonOrNull(input.options),
        nextStepId: input.nextStepId,
        config: input.config,
        canvasX: input.canvasX,
        canvasY: input.canvasY,
      },
    });
  });
}

export async function updateStep(organizationId: string, flowId: string, stepId: string, input: UpsertStepInput) {
  return withTenant(organizationId, async (tx) => {
    const step = await tx.botFlowStep.findUnique({ where: { id: stepId } });
    if (!step || step.organizationId !== organizationId || step.flowId !== flowId) throw NotFound('Step not found');
    return tx.botFlowStep.update({
      where: { id: stepId },
      data: {
        type: input.type,
        order: input.order,
        question: input.question,
        leadField: input.leadField,
        options: jsonOrNull(input.options),
        nextStepId: input.nextStepId,
        config: input.config,
        canvasX: input.canvasX,
        canvasY: input.canvasY,
      },
    });
  });
}

export async function deleteStep(organizationId: string, flowId: string, stepId: string) {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.botFlowStep.deleteMany({ where: { id: stepId, flowId, organizationId } });
    if (result.count === 0) throw NotFound('Step not found');
  });
}

// --- Assignments (which flow is live on which connected channel) ------------

export async function listAssignments(organizationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.botFlowAssignment.findMany({
      where: { organizationId },
      include: { flow: { select: { id: true, name: true, isActive: true } } },
    }),
  );
}

export async function assignFlow(organizationId: string, input: AssignFlowInput) {
  return withTenant(organizationId, async (tx) => {
    const [connection, flow] = await Promise.all([
      tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: input.channel } } }),
      tx.botFlow.findUnique({ where: { id: input.flowId } }),
    ]);
    if (!connection || connection.status !== 'CONNECTED') throw BadRequest(`Connect ${input.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} first`);
    if (!flow || flow.organizationId !== organizationId) throw NotFound('Flow not found');

    return tx.botFlowAssignment.upsert({
      where: { organizationId_channel: { organizationId, channel: input.channel } },
      create: { organizationId, channel: input.channel, flowId: input.flowId },
      update: { flowId: input.flowId },
    });
  });
}

export async function unassignFlow(organizationId: string, channel: 'WHATSAPP' | 'INSTAGRAM') {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.botFlowAssignment.deleteMany({ where: { channel, organizationId } });
    if (result.count === 0) throw NotFound('No flow is assigned to that channel');
  });
}
