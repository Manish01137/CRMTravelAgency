-- Bills: how much of the bill has been paid to the vendor (partial payments).
ALTER TABLE "bills" ADD COLUMN "amount_paid" INTEGER NOT NULL DEFAULT 0;

-- Bills already marked paid were paid in full.
UPDATE "bills" SET "amount_paid" = "amount" WHERE "status" = 'PAID';
