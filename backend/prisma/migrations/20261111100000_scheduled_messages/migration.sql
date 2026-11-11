-- Inbox: messages scheduled for later (sent by the scheduled-messages worker).
-- CreateEnum
CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "scheduled_messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "created_by_id" UUID,
    "send_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "preview" TEXT NOT NULL,
    "status" "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "message_id" UUID,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduled_messages_organization_id_idx" ON "scheduled_messages"("organization_id");

-- CreateIndex
CREATE INDEX "scheduled_messages_conversation_id_send_at_idx" ON "scheduled_messages"("conversation_id", "send_at");

-- CreateIndex
CREATE INDEX "scheduled_messages_status_send_at_idx" ON "scheduled_messages"("status", "send_at");

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row Level Security (same fail-closed tenant pattern as every other table;
-- crm_app's grants come from roles.sql's ALTER DEFAULT PRIVILEGES).
ALTER TABLE "scheduled_messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "scheduled_messages"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
