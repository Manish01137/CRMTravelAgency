-- Super Admin panel: owner-only finance tracking (manual — no payment gateway).
-- Same RLS lockout as platform_admins / organization_notes: enabled, no policy.

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ExpenseCategory" AS ENUM ('HOSTING', 'API_COSTS', 'SOFTWARE', 'MARKETING', 'PAYROLL', 'OTHER');

CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_name" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "started_at" TIMESTAMP(3) NOT NULL,
    "renews_at" TIMESTAMP(3),
    "notes" TEXT,
    "admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions"("organization_id");

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "organization_subscriptions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "organization_subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE TABLE "platform_expenses" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "expense_date" TIMESTAMP(3) NOT NULL,
    "admin_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "platform_expenses_expense_date_idx" ON "platform_expenses"("expense_date");

ALTER TABLE "platform_expenses"
  ADD CONSTRAINT "platform_expenses_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "platform_admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_expenses" ENABLE ROW LEVEL SECURITY;
