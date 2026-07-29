import { withTenant } from '../../lib/prisma';
import type { ListCallLogQuery } from './call-log.schemas';

/**
 * Call Log / Call Monitor — deliberately has NO new table. It's an org-wide
 * view over the existing LeadActivity model (type=CALL), which already
 * carries everything the spec asks for: who called (createdBy), when
 * (createdAt), outcome, and notes (message). Creating an entry reuses the
 * existing `POST /leads/:id/activities` endpoint unchanged — this module is
 * read-only, so Leads' own files are never touched.
 */
export async function listCalls(organizationId: string, query: ListCallLogQuery) {
  return withTenant(organizationId, async (tx) => {
    const where = {
      organizationId,
      type: 'CALL' as const,
      ...(query.userId ? { createdById: query.userId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
    };
    const [items, total] = await Promise.all([
      tx.leadActivity.findMany({
        where,
        include: {
          lead: { select: { id: true, name: true, phone: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      tx.leadActivity.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
  });
}
