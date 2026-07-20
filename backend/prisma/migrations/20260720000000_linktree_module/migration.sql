-- LinkTree module: categories, package<->category join, org theme.
-- New packages default to hidden on LinkTree (existing rows keep their value).
ALTER TABLE "packages" ALTER COLUMN "show_on_linktree" SET DEFAULT false;

ALTER TABLE "organizations" ADD COLUMN "linktree_theme" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_categories" (
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "package_categories_pkey" PRIMARY KEY ("package_id", "category_id")
);

-- Indexes
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");
CREATE INDEX "categories_organization_id_sort_order_idx" ON "categories"("organization_id", "sort_order");
CREATE INDEX "package_categories_organization_id_idx" ON "package_categories"("organization_id");
CREATE INDEX "package_categories_category_id_idx" ON "package_categories"("category_id");

-- FKs
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row Level Security (same fail-closed tenant pattern as every client table).
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "categories"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "package_categories" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "package_categories"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
