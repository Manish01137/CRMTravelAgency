-- CreateEnum
CREATE TYPE "BotFlowStepType" AS ENUM ('COLLECT', 'CONFIRM', 'CLOSING');

-- CreateEnum
CREATE TYPE "BotFlowSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "needs_review" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "needs_review_reason" TEXT;

-- CreateTable
CREATE TABLE "bot_flows" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "fallback_message" TEXT NOT NULL DEFAULT 'Sorry, I didn''t quite get that — let me get a team member to help you.',
    "needs_review_keywords" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_flow_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "type" "BotFlowStepType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT,
    "lead_field" TEXT,
    "options" JSONB,
    "next_step_id" TEXT,
    "canvas_x" INTEGER,
    "canvas_y" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_flow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_flow_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "flow_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_flow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_flow_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "flow_id" UUID NOT NULL,
    "current_step_id" UUID,
    "collected_data" JSONB NOT NULL DEFAULT '{}',
    "status" "BotFlowSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_processed_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bot_flow_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_agent_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "system_prompt" TEXT,
    "agency_facts" TEXT,
    "tone" TEXT DEFAULT 'Friendly, warm and professional',
    "gemini_api_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_agent_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "delay_hours" INTEGER NOT NULL DEFAULT 48,
    "nudge_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_attempts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_flows_organization_id_idx" ON "bot_flows"("organization_id");

-- CreateIndex
CREATE INDEX "bot_flow_steps_organization_id_idx" ON "bot_flow_steps"("organization_id");

-- CreateIndex
CREATE INDEX "bot_flow_steps_flow_id_idx" ON "bot_flow_steps"("flow_id");

-- CreateIndex
CREATE INDEX "bot_flow_assignments_organization_id_idx" ON "bot_flow_assignments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "bot_flow_assignments_organization_id_channel_key" ON "bot_flow_assignments"("organization_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "bot_flow_sessions_conversation_id_key" ON "bot_flow_sessions"("conversation_id");

-- CreateIndex
CREATE INDEX "bot_flow_sessions_organization_id_idx" ON "bot_flow_sessions"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_agent_settings_organization_id_key" ON "ai_agent_settings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "automation_settings_organization_id_key" ON "automation_settings"("organization_id");

-- CreateIndex
CREATE INDEX "follow_up_attempts_organization_id_idx" ON "follow_up_attempts"("organization_id");

-- CreateIndex
CREATE INDEX "follow_up_attempts_lead_id_created_at_idx" ON "follow_up_attempts"("lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "bot_flows" ADD CONSTRAINT "bot_flows_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_steps" ADD CONSTRAINT "bot_flow_steps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_steps" ADD CONSTRAINT "bot_flow_steps_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_assignments" ADD CONSTRAINT "bot_flow_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_assignments" ADD CONSTRAINT "bot_flow_assignments_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_sessions" ADD CONSTRAINT "bot_flow_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_sessions" ADD CONSTRAINT "bot_flow_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_flow_sessions" ADD CONSTRAINT "bot_flow_sessions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "bot_flows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_agent_settings" ADD CONSTRAINT "ai_agent_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_settings" ADD CONSTRAINT "automation_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_attempts" ADD CONSTRAINT "follow_up_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_attempts" ADD CONSTRAINT "follow_up_attempts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security (PROJECT_SPEC.md §4) — every Phase 4 client-data table
-- gets the same tenant_isolation policy as every table before it. The
-- restricted crm_app role (not the table owner) enforces this on every query.

ALTER TABLE "bot_flows" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bot_flows"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "bot_flow_steps" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bot_flow_steps"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "bot_flow_assignments" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bot_flow_assignments"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "bot_flow_sessions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bot_flow_sessions"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "ai_agent_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ai_agent_settings"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "automation_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "automation_settings"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "follow_up_attempts" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "follow_up_attempts"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
