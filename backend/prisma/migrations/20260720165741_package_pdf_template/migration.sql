-- AlterTable
ALTER TABLE "linktree_categories" RENAME CONSTRAINT "categories_pkey" TO "linktree_categories_pkey";

-- AlterTable
ALTER TABLE "package_linktree_categories" RENAME CONSTRAINT "package_categories_pkey" TO "package_linktree_categories_pkey";

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "pdf_template_id" TEXT NOT NULL DEFAULT 'alpine';

-- RenameForeignKey
ALTER TABLE "linktree_categories" RENAME CONSTRAINT "categories_organization_id_fkey" TO "linktree_categories_organization_id_fkey";

-- RenameForeignKey
ALTER TABLE "package_linktree_categories" RENAME CONSTRAINT "package_categories_category_id_fkey" TO "package_linktree_categories_linktree_category_id_fkey";

-- RenameForeignKey
ALTER TABLE "package_linktree_categories" RENAME CONSTRAINT "package_categories_organization_id_fkey" TO "package_linktree_categories_organization_id_fkey";

-- RenameForeignKey
ALTER TABLE "package_linktree_categories" RENAME CONSTRAINT "package_categories_package_id_fkey" TO "package_linktree_categories_package_id_fkey";

-- RenameIndex
ALTER INDEX "categories_organization_id_idx" RENAME TO "linktree_categories_organization_id_idx";

-- RenameIndex
ALTER INDEX "categories_organization_id_sort_order_idx" RENAME TO "linktree_categories_organization_id_sort_order_idx";

-- RenameIndex
ALTER INDEX "package_categories_category_id_idx" RENAME TO "package_linktree_categories_linktree_category_id_idx";

-- RenameIndex
ALTER INDEX "package_categories_organization_id_idx" RENAME TO "package_linktree_categories_organization_id_idx";
