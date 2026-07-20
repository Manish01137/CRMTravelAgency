import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { slugify } from '../../lib/slug';
import { BadRequest, NotFound } from '../../lib/errors';
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

const categoryIdsInclude = {
  packageCategories: { select: { categoryId: true } },
} satisfies Prisma.PackageInclude;

type PackageWithJoins = Prisma.PackageGetPayload<{ include: typeof categoryIdsInclude }>;

/** Flatten join rows into a categoryIds array for the API shape. */
function withCategoryIds({ packageCategories, ...pkg }: PackageWithJoins) {
  return { ...pkg, categoryIds: packageCategories.map((pc) => pc.categoryId) };
}

/** Replace a package's LinkTree category assignments (validates ownership via RLS). */
async function setCategories(tx: TenantTx, organizationId: string, packageId: string, categoryIds: string[]) {
  if (categoryIds.length > 0) {
    const owned = await tx.category.count({ where: { id: { in: categoryIds } } });
    if (owned !== new Set(categoryIds).size) throw BadRequest('Category not found in your organization');
  }
  await tx.packageCategory.deleteMany({ where: { packageId } });
  if (categoryIds.length > 0) {
    await tx.packageCategory.createMany({
      data: [...new Set(categoryIds)].map((categoryId) => ({ organizationId, packageId, categoryId })),
      skipDuplicates: true,
    });
  }
}

export async function listPackages(organizationId: string, query: ListPackagesQuery) {
  return withTenant(organizationId, async (tx) => {
    const where: Prisma.PackageWhereInput = {};
    if (query.active) where.isActive = query.active === 'true';
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { destination: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const rows = await tx.package.findMany({ where, orderBy: { createdAt: 'desc' }, include: categoryIdsInclude });
    return rows.map(withCategoryIds);
  });
}

export async function getPackage(organizationId: string, id: string) {
  return withTenant(organizationId, async (tx) => {
    const pkg = await tx.package.findUnique({ where: { id }, include: categoryIdsInclude });
    if (!pkg) throw NotFound('Package not found');
    return withCategoryIds(pkg);
  });
}

export async function createPackage(organizationId: string, input: CreatePackageInput) {
  return withTenant(organizationId, async (tx) => {
    const { categoryIds, ...rest } = input;
    const slug = await resolveSlug(tx, input.name, input.slug);
    const created = await tx.package.create({
      data: { ...rest, slug, organizationId } as Prisma.PackageUncheckedCreateInput,
    });
    if (categoryIds !== undefined) await setCategories(tx, organizationId, created.id, categoryIds);
    const full = await tx.package.findUniqueOrThrow({ where: { id: created.id }, include: categoryIdsInclude });
    return withCategoryIds(full);
  });
}

export async function updatePackage(organizationId: string, id: string, input: UpdatePackageInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.package.findUnique({ where: { id } });
    if (!existing) throw NotFound('Package not found');

    const { categoryIds, ...rest } = input;
    const data = { ...rest } as Prisma.PackageUncheckedUpdateInput;
    // Only touch slug when the client sent one (or is renaming with no slug set).
    if (input.slug !== undefined) {
      data.slug =
        input.slug === null
          ? await resolveSlug(tx, input.name ?? existing.name, undefined, id)
          : await resolveSlug(tx, existing.name, input.slug, id);
    }
    await tx.package.update({ where: { id }, data });
    if (categoryIds !== undefined) await setCategories(tx, organizationId, id, categoryIds);
    const full = await tx.package.findUniqueOrThrow({ where: { id }, include: categoryIdsInclude });
    return withCategoryIds(full);
  });
}

export async function deletePackage(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.package.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Package not found');
  });
}
