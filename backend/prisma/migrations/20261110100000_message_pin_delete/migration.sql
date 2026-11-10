-- Pinned messages (team-only) and "delete" = hidden from the Inbox, kept for the record.
-- All optional — existing messages are unchanged.
ALTER TABLE "messages" ADD COLUMN "pinned_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "deleted_by_id" UUID;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
