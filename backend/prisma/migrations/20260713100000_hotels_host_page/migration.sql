-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "host_links" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "star_rating" INTEGER NOT NULL DEFAULT 3,
    "phone" TEXT,
    "email" TEXT,
    "price_per_night" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotels_organization_id_idx" ON "hotels"("organization_id");

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row Level Security for hotels (same fail-closed tenant pattern).
ALTER TABLE "hotels" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "hotels"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
