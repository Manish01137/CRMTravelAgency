-- Inbox message extras: team stars, emoji reactions (customer's and ours),
-- and the delivered / read times shown in Message info. All optional — existing
-- messages are unchanged.
ALTER TABLE "messages" ADD COLUMN "starred_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "customer_reaction" TEXT;
ALTER TABLE "messages" ADD COLUMN "agent_reaction" TEXT;
ALTER TABLE "messages" ADD COLUMN "delivered_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "read_at" TIMESTAMP(3);
