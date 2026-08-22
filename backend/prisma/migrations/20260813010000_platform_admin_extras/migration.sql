-- Super Admin panel extras: audit log + internal org notes.
-- Both get RLS enabled with NO policy — same deny-all-for-crm_app lockout as
-- platform_admins (see 20260813000000_platform_admin/migration.sql).

CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID,
    "admin_email" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "target_label" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_audit_logs_target_type_target_id_idx" ON "platform_audit_logs"("target_type", "target_id");
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");

ALTER TABLE "platform_audit_logs"
  ADD CONSTRAINT "platform_audit_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "organization_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "admin_id" UUID,
    "admin_email" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_notes_organization_id_idx" ON "organization_notes"("organization_id");

ALTER TABLE "organization_notes"
  ADD CONSTRAINT "organization_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_notes_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_notes" ENABLE ROW LEVEL SECURITY;
