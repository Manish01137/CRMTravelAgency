-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('ON_SALE', 'CLOSED', 'SOLD_OUT');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "batch_id" UUID;

-- CreateTable
CREATE TABLE "batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" UUID NOT NULL,
    "departure_date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "price_override" INTEGER,
    "status" "BatchStatus" NOT NULL DEFAULT 'ON_SALE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batches_organization_id_idx" ON "batches"("organization_id");

-- CreateIndex
CREATE INDEX "batches_package_id_departure_date_idx" ON "batches"("package_id", "departure_date");

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row Level Security for batches (same fail-closed tenant pattern).
ALTER TABLE "batches" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "batches"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
