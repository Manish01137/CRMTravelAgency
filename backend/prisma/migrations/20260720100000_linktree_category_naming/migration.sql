-- Rename the LinkTree category tables to unambiguous LinkTree-specific names.
-- Pure renames: data, FKs and the attached RLS tenant policies are preserved.
ALTER TABLE "categories" RENAME TO "linktree_categories";
ALTER TABLE "package_categories" RENAME TO "package_linktree_categories";
ALTER TABLE "package_linktree_categories" RENAME COLUMN "category_id" TO "linktree_category_id";
