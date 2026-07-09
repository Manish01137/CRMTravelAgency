-- Travel Agency CRM — initial schema (Phase 1)
-- Tables: organizations, users, leads, invitations
-- Plus Row Level Security policies (multi-tenant safety net, PROJECT_SPEC.md §4).

-- ============================================================================
-- Enums
-- ============================================================================
CREATE TYPE "Role" AS ENUM ('ADMIN', 'AGENT');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEBSITE', 'REFERRAL', 'WALK_IN', 'PHONE', 'MANUAL', 'OTHER');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST');
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- ============================================================================
-- Tables
-- ============================================================================
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "brand_primary_color" TEXT NOT NULL DEFAULT '#4F46E5',
    "brand_secondary_color" TEXT NOT NULL DEFAULT '#0D9488',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'MANUAL',
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "destination" TEXT,
    "travel_date" DATE,
    "traveler_count" INTEGER,
    "budget_amount" INTEGER,
    "budget_currency" TEXT DEFAULT 'USD',
    "notes" TEXT,
    "assigned_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'AGENT',
    "token_hash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "leads_organization_id_idx" ON "leads"("organization_id");
CREATE INDEX "leads_organization_id_status_idx" ON "leads"("organization_id", "status");
CREATE INDEX "leads_organization_id_created_at_idx" ON "leads"("organization_id", "created_at");
CREATE INDEX "leads_assigned_to_id_idx" ON "leads"("assigned_to_id");
CREATE UNIQUE INDEX "invitations_token_hash_key" ON "invitations"("token_hash");
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");
CREATE INDEX "invitations_organization_id_email_idx" ON "invitations"("organization_id", "email");

-- ============================================================================
-- Foreign keys
-- ============================================================================
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_fkey"
    FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- Row Level Security  (PROJECT_SPEC.md §4 — the safety net)
-- ============================================================================
-- RLS is ENABLED but intentionally NOT FORCED:
--   * The table OWNER (DATABASE_URL / systemPrisma) is exempt from RLS. That is
--     exactly what lets the tiny, deliberately cross-tenant auth surface work
--     (login looks a user up by email before any org is known; signup creates a
--     brand-new org). This surface is confined to src/modules/auth.
--   * The restricted runtime role `crm_app` (APP_DATABASE_URL / tenantPrisma) is
--     NOT the owner, so RLS IS enforced for every ordinary tenant request. Even
--     if application code forgets its organization_id filter, the database
--     returns zero rows.
--
-- Policies are FAIL-CLOSED: when app.current_org_id is unset or empty the
-- comparison is NULL, so no rows are visible and no rows are writable.
-- The runtime sets it per-request via  SELECT set_config('app.current_org_id', $orgId, true)
-- inside the same transaction (see src/lib/prisma.ts / src/middleware/tenant.ts).

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "organizations"
    USING ("id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "users"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "leads"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invitations"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
