import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { slugify } from '../../lib/slug';
import { NotFound } from '../../lib/errors';
import type { CreatePackageInput, ListPackagesQuery, UpdatePackageInput } from './packages.schemas';

/** Ensures a per-org-unique slug, deriving one from the name when not given. */
async function resolveSlug(
  tx: TenantTx,
  base: string,
  desired: string | undefined,
  excludeId?: string,
): Promise<string> {
  let slug = desired?.trim() || slugify(base);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const clash = await tx.package.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } });
    if (!clash) return slug;
    slug = `${desired?.trim() || slugify(base)}-${crypto.randomBytes(2).toString('hex')}`;
  }
  return `${slugify(base)}-${crypto.randomBytes(3).toString('hex')}`;
}

export async function listPackages(organizationId: string, query: ListPackagesQuery) {
  return withTenant(organizationId, (tx) => {
    const where: Prisma.PackageWhereInput = {};
    if (query.active) where.isActive = query.active === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { destination: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
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
  return withTenant(organizationId, async (tx) => {
    const slug = await resolveSlug(tx, input.name, input.slug);
    return tx.package.create({
      data: { ...input, slug, organizationId } as Prisma.PackageUncheckedCreateInput,
    });
  });
}

export async function updatePackage(organizationId: string, id: string, input: UpdatePackageInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.package.findUnique({ where: { id } });
    if (!existing) throw NotFound('Package not found');

    const data = { ...input } as Prisma.PackageUncheckedUpdateInput;
    // Only touch slug when the client sent one (or is renaming with no slug set).
    if (input.slug !== undefined) {
      data.slug =
        input.slug === null
          ? await resolveSlug(tx, input.name ?? existing.name, undefined, id)
          : await resolveSlug(tx, existing.name, input.slug, id);
    }
    return tx.package.update({ where: { id }, data });
  });
}

export async function deletePackage(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.package.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Package not found');
  });
}
