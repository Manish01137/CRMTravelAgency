-- The package PDF brochure is now a single fixed "Signature" design — every
-- package (new and existing) renders the same layout, so pdf_template_id no
-- longer selects between designs. Backfill existing rows and update the
-- column default so the data stays consistent, even though the renderer
-- ignores this value entirely now.
ALTER TABLE "packages" ALTER COLUMN "pdf_template_id" SET DEFAULT 'signature';
UPDATE "packages" SET "pdf_template_id" = 'signature' WHERE "pdf_template_id" <> 'signature';
