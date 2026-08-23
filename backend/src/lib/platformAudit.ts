import { Prisma } from '@prisma/client';
import { systemPrisma } from './prisma';

export type AuditTargetType = 'ORGANIZATION' | 'USER' | 'EXPENSE';

/** Records one Super Admin panel action. Best-effort: a logging failure must
 *  never block the action it's describing, so callers fire-and-forget this. */
export async function logPlatformAction(params: {
  adminId: string;
  adminEmail: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  targetLabel: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await systemPrisma.platformAuditLog.create({
      data: {
        adminId: params.adminId,
        adminEmail: params.adminEmail,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetLabel: params.targetLabel,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to write platform audit log entry:', err instanceof Error ? err.message : err);
  }
}
