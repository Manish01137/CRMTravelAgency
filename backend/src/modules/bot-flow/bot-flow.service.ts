import { withTenant } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import { BOT_FLOW_TEMPLATES, instantiateTemplate } from './bot-flow.templates';
import type { AssignFlowInput, CreateFlowInput, CreateFromTemplateInput, UpdateFlowInput, UpsertStepInput } from './bot-flow.schemas';

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

export async function createFlow(organizationId: string, input: CreateFlowInput) {
  return withTenant(organizationId, (tx) =>
    tx.botFlow.create({
      data: {
        organizationId,
        name: input.name,
        ...(input.fallbackMessage !== undefined && { fallbackMessage: input.fallbackMessage }),
        needsReviewKeywords: input.needsReviewKeywords,
        isActive: input.isActive,
      },
    }),
  );
}

export async function updateFlow(organizationId: string, flowId: string, input: UpdateFlowInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.botFlow.findUnique({ where: { id: flowId } });
    if (!existing || existing.organizationId !== organizationId) throw NotFound('Flow not found');
    return tx.botFlow.update({ where: { id: flowId }, data: input });
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
        options: input.options,
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
        options: input.options,
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
