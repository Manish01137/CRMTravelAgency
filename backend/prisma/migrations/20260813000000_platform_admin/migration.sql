-- Super Admin panel: platform-owner control, entirely outside the tenant model.

CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "organizations"
  ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "suspended_at" TIMESTAMP(3),
  ADD COLUMN "suspended_reason" TEXT;

CREATE TABLE "platform_admins" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- ============================================================================
-- Row Level Security — deliberately NO policy.
-- ============================================================================
-- Unlike every tenant table (policy scoped to app.current_org_id), this table
-- gets RLS enabled with ZERO policies. Postgres RLS defaults to deny-all for
-- every command when a table has RLS enabled and no matching policy exists.
-- That means the restricted `crm_app` role — which already has table-level
-- SELECT/INSERT/UPDATE/DELETE via the blanket grant in roles.sql — gets
-- nothing here: ordinary tenant requests can never read or write platform
-- admin credentials, even by mistake. Only the privileged systemPrisma
-- connection (table owner, exempt from RLS entirely) can touch this table,
-- exactly the surface the Super Admin panel's backend uses.
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;
