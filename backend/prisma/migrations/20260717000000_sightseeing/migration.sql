-- CreateTable
CREATE TABLE "sightseeing" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "timings" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sightseeing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sightseeing_organization_id_idx" ON "sightseeing"("organization_id");

-- CreateIndex
CREATE INDEX "sightseeing_organization_id_city_idx" ON "sightseeing"("organization_id", "city");

-- AddForeignKey
ALTER TABLE "sightseeing" ADD CONSTRAINT "sightseeing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row Level Security for sightseeing (same fail-closed tenant pattern).
ALTER TABLE "sightseeing" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "sightseeing"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
