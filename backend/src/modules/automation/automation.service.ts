import { withTenant } from '../../lib/prisma';
import type { ListAttemptsQuery, UpdateAutomationInput } from './automation.schemas';

export async function getSettings(organizationId: string) {
  return withTenant(organizationId, async (tx) => {
    const row = await tx.automationSettings.findUnique({ where: { organizationId } });
    return row ?? { organizationId, enabled: false, delayHours: 48, nudgeMessage: null, id: null, createdAt: null, updatedAt: null };
  });
}

export async function updateSettings(organizationId: string, input: UpdateAutomationInput) {
  return withTenant(organizationId, (tx) =>
    tx.automationSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...input },
      update: input,
    }),
  );
}

export async function listAttempts(organizationId: string, query: ListAttemptsQuery) {
  return withTenant(organizationId, (tx) =>
    tx.followUpAttempt.findMany({
      where: { organizationId, ...(query.leadId && { leadId: query.leadId }) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lead: { select: { id: true, name: true } } },
    }),
  );
}
