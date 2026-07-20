-- Host Page mini-website: gallery, team public fields, reviews, per-package flag.
ALTER TABLE "packages" ADD COLUMN "show_on_hostpage" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "organizations" ADD COLUMN "host_gallery" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "users"
  ADD COLUMN "feature_on_hostpage" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "public_photo_url" TEXT,
  ADD COLUMN "public_title" TEXT,
  ADD COLUMN "public_bio" TEXT;

-- CreateTable
CREATE TABLE "host_reviews" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "reviewer_name" TEXT NOT NULL,
    "photo_url" TEXT,
    "quote" TEXT NOT NULL,
    "rating" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "host_reviews_organization_id_idx" ON "host_reviews"("organization_id");
CREATE INDEX "host_reviews_organization_id_sort_order_idx" ON "host_reviews"("organization_id", "sort_order");

ALTER TABLE "host_reviews" ADD CONSTRAINT "host_reviews_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security (fail-closed tenant pattern).
ALTER TABLE "host_reviews" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "host_reviews"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
