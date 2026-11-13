-- Adventure brochure: the trip route ("Delhi to Delhi") and the amount that books a seat.
ALTER TABLE "packages" ADD COLUMN "route" TEXT;
ALTER TABLE "packages" ADD COLUMN "booking_amount" INTEGER;
