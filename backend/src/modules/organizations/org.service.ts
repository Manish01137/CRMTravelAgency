import type { Organization } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import type { UpdateOrgInput } from './org.schemas';

export async function getOrganization(organizationId: string): Promise<Organization> {
  return withTenant(organizationId, (tx) =>
    tx.organization.findUniqueOrThrow({ where: { id: organizationId } }),
  );
}

export async function updateOrganization(
  organizationId: string,
  data: UpdateOrgInput,
): Promise<Organization> {
  return withTenant(organizationId, (tx) =>
    tx.organization.update({ where: { id: organizationId }, data }),
  );
}
