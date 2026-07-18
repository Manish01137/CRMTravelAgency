-- New status enum for events/departures.
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'LIVE', 'COMPLETED', 'CANCELLED');

-- New departure fields.
ALTER TABLE "batches"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "return_date" DATE,
  ADD COLUMN "booking_close_date" DATE,
  ADD COLUMN "pickup_city" TEXT,
  ADD COLUMN "cover_image_override" TEXT;

-- price_override -> price_per_person (same meaning, clearer name).
ALTER TABLE "batches" RENAME COLUMN "price_override" TO "price_per_person";

-- Migrate status from BatchStatus to EventStatus.
ALTER TABLE "batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "batches" ALTER COLUMN "status" TYPE "EventStatus" USING (
  CASE "status"::text
    WHEN 'ON_SALE' THEN 'LIVE'
    WHEN 'CLOSED' THEN 'COMPLETED'
    WHEN 'SOLD_OUT' THEN 'LIVE'
    ELSE 'DRAFT'
  END
)::"EventStatus";
ALTER TABLE "batches" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "BatchStatus";
