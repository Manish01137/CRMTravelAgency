-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('NOT_CONNECTED', 'CONNECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "CommStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "channel_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "display_name" TEXT,
    "external_id" TEXT,
    "credentials" TEXT,
    "last_error" TEXT,
    "connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "external_contact_id" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "lead_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "last_message_preview" TEXT,
    "last_inbound_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "external_message_id" TEXT,
    "body" TEXT,
    "media_url" TEXT,
    "template_name" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "error_message" TEXT,
    "sent_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'UTILITY',
    "language" TEXT NOT NULL DEFAULT 'en_US',
    "body_text" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'PENDING',
    "external_template_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommStatus" NOT NULL DEFAULT 'SENT',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "sent_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_connections_organization_id_idx" ON "channel_connections"("organization_id");

-- CreateIndex
CREATE INDEX "channel_connections_channel_external_id_idx" ON "channel_connections"("channel", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_connections_organization_id_channel_key" ON "channel_connections"("organization_id", "channel");

-- CreateIndex
CREATE INDEX "conversations_organization_id_idx" ON "conversations"("organization_id");

-- CreateIndex
CREATE INDEX "conversations_organization_id_channel_last_message_at_idx" ON "conversations"("organization_id", "channel", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_lead_id_idx" ON "conversations"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_organization_id_channel_external_contact_id_key" ON "conversations"("organization_id", "channel", "external_contact_id");

-- CreateIndex
CREATE INDEX "messages_organization_id_idx" ON "messages"("organization_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "message_templates_organization_id_idx" ON "message_templates"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_templates_organization_id_name_language_key" ON "message_templates"("organization_id", "name", "language");

-- CreateIndex
CREATE INDEX "communication_logs_organization_id_idx" ON "communication_logs"("organization_id");

-- CreateIndex
CREATE INDEX "communication_logs_lead_id_created_at_idx" ON "communication_logs"("lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (PROJECT_SPEC.md §4) — every Phase 3 client-data table
-- gets the same tenant_isolation policy as every table before it. The
-- restricted crm_app role (not the table owner) enforces this on every query.

ALTER TABLE "channel_connections" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "channel_connections"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "conversations"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "messages"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "message_templates"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "communication_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "communication_logs"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
