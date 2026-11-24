-- A package's own WhatsApp number (LinkTree / trip page WhatsApp buttons).
-- Existing table — its tenant_isolation RLS policy already covers the new column.
ALTER TABLE "packages" ADD COLUMN "whatsapp_number" TEXT;
