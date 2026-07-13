-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('FOLLOW_UP', 'CALL', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillCategory" AS ENUM ('HOTEL', 'FLIGHT', 'TRANSPORT', 'ACTIVITY', 'VISA', 'FOOD', 'OTHER');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "nights" INTEGER NOT NULL DEFAULT 1,
    "days" INTEGER NOT NULL DEFAULT 2,
    "price_amount" INTEGER NOT NULL,
    "price_currency" TEXT NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "inclusions" TEXT,
    "exclusions" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "booking_number" INTEGER NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "destination" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "traveler_count" INTEGER,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "lead_id" UUID,
    "package_id" UUID,
    "assigned_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "day_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itinerary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "type" "TaskType" NOT NULL DEFAULT 'FOLLOW_UP',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "due_at" TIMESTAMP(3) NOT NULL,
    "lead_id" UUID,
    "booking_id" UUID,
    "assigned_to_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "color" TEXT NOT NULL DEFAULT '#4F46E5',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_number" INTEGER NOT NULL,
    "booking_id" UUID,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT,
    "customer_phone" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issue_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE,
    "items" JSONB NOT NULL DEFAULT '[]',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "booking_id" UUID,
    "vendor_name" TEXT NOT NULL,
    "category" "BillCategory" NOT NULL DEFAULT 'OTHER',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "bill_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "BillStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "packages_organization_id_idx" ON "packages"("organization_id");

-- CreateIndex
CREATE INDEX "bookings_organization_id_idx" ON "bookings"("organization_id");

-- CreateIndex
CREATE INDEX "bookings_organization_id_status_idx" ON "bookings"("organization_id", "status");

-- CreateIndex
CREATE INDEX "bookings_organization_id_start_date_idx" ON "bookings"("organization_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_organization_id_booking_number_key" ON "bookings"("organization_id", "booking_number");

-- CreateIndex
CREATE INDEX "itinerary_items_organization_id_idx" ON "itinerary_items"("organization_id");

-- CreateIndex
CREATE INDEX "itinerary_items_booking_id_day_number_idx" ON "itinerary_items"("booking_id", "day_number");

-- CreateIndex
CREATE INDEX "tasks_organization_id_idx" ON "tasks"("organization_id");

-- CreateIndex
CREATE INDEX "tasks_organization_id_status_due_at_idx" ON "tasks"("organization_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "tasks_lead_id_idx" ON "tasks"("lead_id");

-- CreateIndex
CREATE INDEX "tasks_booking_id_idx" ON "tasks"("booking_id");

-- CreateIndex
CREATE INDEX "events_organization_id_date_idx" ON "events"("organization_id", "date");

-- CreateIndex
CREATE INDEX "invoices_organization_id_idx" ON "invoices"("organization_id");

-- CreateIndex
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "invoices_booking_id_idx" ON "invoices"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organization_id_invoice_number_key" ON "invoices"("organization_id", "invoice_number");

-- CreateIndex
CREATE INDEX "bills_organization_id_idx" ON "bills"("organization_id");

-- CreateIndex
CREATE INDEX "bills_booking_id_idx" ON "bills"("booking_id");

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_items" ADD CONSTRAINT "itinerary_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ============================================================================
-- Row Level Security — Phase 2 tables (PROJECT_SPEC.md §4, same fail-closed
-- tenant_isolation pattern as Phase 1; enforced on the crm_app runtime role).
-- ============================================================================

ALTER TABLE "packages" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "packages"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "bookings" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bookings"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "itinerary_items" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "itinerary_items"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "tasks"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "events"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "invoices"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "bills" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "bills"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
