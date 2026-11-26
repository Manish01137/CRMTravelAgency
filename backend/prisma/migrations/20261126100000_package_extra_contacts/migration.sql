-- More contacts per package ({name?, phone?, email?}[]), shown on the trip page and brochures.
-- Existing table — its tenant_isolation RLS policy already covers the new column.
ALTER TABLE "packages" ADD COLUMN "extra_contacts" JSONB NOT NULL DEFAULT '[]';
