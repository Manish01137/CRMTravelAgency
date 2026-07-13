import { Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';
import type { CreatePackageInput, ListPackagesQuery, UpdatePackageInput } from './packages.schemas';

export async function listPackages(organizationId: string, query: ListPackagesQuery) {
  return withTenant(organizationId, (tx) => {
    const where: Prisma.PackageWhereInput = {};
    if (query.active) where.isActive = query.active === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { destination: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return tx.package.findMany({ where, orderBy: { createdAt: 'desc' } });
  });
}

export async function getPackage(organizationId: string, id: string) {
  return withTenant(organizationId, async (tx) => {
    const pkg = await tx.package.findUnique({ where: { id } });
    if (!pkg) throw NotFound('Package not found');
    return pkg;
  });
}

export async function createPackage(organizationId: string, input: CreatePackageInput) {
  return withTenant(organizationId, (tx) =>
    tx.package.create({ data: { ...input, organizationId } }),
  );
}

export async function updatePackage(organizationId: string, id: string, input: UpdatePackageInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.package.findUnique({ where: { id } });
    if (!existing) throw NotFound('Package not found');
    return tx.package.update({ where: { id }, data: input });
  });
}

export async function deletePackage(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.package.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Package not found');
  });
}
