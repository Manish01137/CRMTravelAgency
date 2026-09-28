import type { TenantTx } from '../../lib/prisma';

export const MAX_PACKAGES_PER_AD = 5;

export interface AdPackage {
  id: string;
  name: string;
  destination: string;
  isActive: boolean;
}

/** The packages linked to one ad, in the order they're sent (alphabetical by name). */
export async function findAdPackages(tx: TenantTx, organizationId: string, adId: string): Promise<AdPackage[]> {
  const rows = await tx.adPackageMapping.findMany({
    where: { organizationId, adId },
    include: { package: { select: { id: true, name: true, destination: true, isActive: true } } },
  });
  return rows.map((r) => r.package).sort((a, b) => a.name.localeCompare(b.name));
}

/** The destination to pre-fill for a lead from this ad — only when every linked package shares it. */
export function sharedDestination(packages: AdPackage[]): string | null {
  const first = packages[0]?.destination?.trim();
  if (!first) return null;
  return packages.every((p) => p.destination?.trim().toLowerCase() === first.toLowerCase()) ? first : null;
}
