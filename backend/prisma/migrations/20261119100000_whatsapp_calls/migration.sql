-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('RINGING', 'ANSWERED', 'COMPLETED', 'MISSED', 'DECLINED', 'NO_ANSWER', 'FAILED');

-- CreateTable
CREATE TABLE "whatsapp_calls" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "external_call_id" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "status" "CallStatus" NOT NULL DEFAULT 'RINGING',
    "remote_sdp" TEXT,
    "answered_by_id" UUID,
    "started_by_id" UUID,
    "answered_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_calls_external_call_id_key" ON "whatsapp_calls"("external_call_id");

-- CreateIndex
CREATE INDEX "whatsapp_calls_organization_id_created_at_idx" ON "whatsapp_calls"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_calls_conversation_id_created_at_idx" ON "whatsapp_calls"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "whatsapp_calls_status_idx" ON "whatsapp_calls"("status");

-- AddForeignKey
ALTER TABLE "whatsapp_calls" ADD CONSTRAINT "whatsapp_calls_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_calls" ADD CONSTRAINT "whatsapp_calls_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_calls" ADD CONSTRAINT "whatsapp_calls_answered_by_id_fkey" FOREIGN KEY ("answered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_calls" ADD CONSTRAINT "whatsapp_calls_started_by_id_fkey" FOREIGN KEY ("started_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Row Level Security (same fail-closed tenant pattern as every other table).
ALTER TABLE "whatsapp_calls" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "whatsapp_calls"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
