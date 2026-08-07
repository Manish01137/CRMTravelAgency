-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "auto_created" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "is_repeat_customer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "repeat_booking_id" UUID;

-- CreateIndex
CREATE INDEX "leads_repeat_booking_id_idx" ON "leads"("repeat_booking_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_repeat_booking_id_fkey" FOREIGN KEY ("repeat_booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

