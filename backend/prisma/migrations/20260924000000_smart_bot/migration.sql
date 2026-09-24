-- Smart Bot: webhook-inline WhatsApp bot (POC, feature-flagged per org).
-- See prisma/schema.prisma's "Smart Bot" section comment for how this
-- relates to (and is deliberately kept separate from) Bot Flow.

-- AlterTable: one-time greeting + Click-to-WhatsApp ad attribution on Lead
ALTER TABLE "leads" ADD COLUMN "has_greeted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "leads" ADD COLUMN "source_ad_id" TEXT;
ALTER TABLE "leads" ADD COLUMN "source_package_id" UUID;

-- CreateTable
CREATE TABLE "smart_bot_settings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "smart_bot_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_package_mappings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "ad_id" TEXT NOT NULL,
    "package_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_package_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_interaction_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "raw_message" TEXT NOT NULL,
    "matched_tool" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "smart_bot_settings_organization_id_key" ON "smart_bot_settings"("organization_id");

-- CreateIndex
CREATE INDEX "ad_package_mappings_organization_id_idx" ON "ad_package_mappings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ad_package_mappings_organization_id_ad_id_key" ON "ad_package_mappings"("organization_id", "ad_id");

-- CreateIndex
CREATE INDEX "bot_interaction_logs_organization_id_idx" ON "bot_interaction_logs"("organization_id");

-- CreateIndex
CREATE INDEX "bot_interaction_logs_lead_id_created_at_idx" ON "bot_interaction_logs"("lead_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_source_package_id_idx" ON "leads"("source_package_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_package_id_fkey" FOREIGN KEY ("source_package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_bot_settings" ADD CONSTRAINT "smart_bot_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_package_mappings" ADD CONSTRAINT "ad_package_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_package_mappings" ADD CONSTRAINT "ad_package_mappings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_interaction_logs" ADD CONSTRAINT "bot_interaction_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_interaction_logs" ADD CONSTRAINT "bot_interaction_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row Level Security — same fail-closed tenant pattern as every other
-- client-data table (PROJECT_SPEC.md §4). Grants for crm_app on these new
-- tables are already covered by roles.sql's ALTER DEFAULT PRIVILEGES; no
-- need to re-run npm run db:roles for this migration.
ALTER TABLE "smart_bot_settings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "smart_bot_settings"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "ad_package_mappings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "ad_package_mappings"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "bot_interaction_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bot_interaction_logs"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
