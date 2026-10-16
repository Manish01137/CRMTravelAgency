-- Existing leads assigned to an event (a departure / batch). Links the original
-- lead — never a copy — so a lead appears at most once per event; booking_id is
-- set when it's converted into a booking for that event. Additive only.

-- CreateTable
CREATE TABLE "event_leads" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "traveler_count" INTEGER,
    "booking_id" UUID,
    "added_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_leads_organization_id_idx" ON "event_leads"("organization_id");

-- CreateIndex
CREATE INDEX "event_leads_lead_id_idx" ON "event_leads"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_leads_batch_id_lead_id_key" ON "event_leads"("batch_id", "lead_id");

-- AddForeignKey
ALTER TABLE "event_leads" ADD CONSTRAINT "event_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_leads" ADD CONSTRAINT "event_leads_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_leads" ADD CONSTRAINT "event_leads_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_leads" ADD CONSTRAINT "event_leads_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_leads" ADD CONSTRAINT "event_leads_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row Level Security (same fail-closed tenant pattern as every other table;
-- crm_app's grants come from roles.sql's ALTER DEFAULT PRIVILEGES).
ALTER TABLE "event_leads" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "event_leads"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
