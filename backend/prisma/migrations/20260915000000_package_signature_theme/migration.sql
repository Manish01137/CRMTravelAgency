-- Package view type -> Signature theme.
-- The old "view_type" concept (13 independent layout/theme choices, plain
-- string, no enum type — app-level validated) is being replaced by a single
-- "signature_theme" concept with exactly 3 values (SUNRISE/OCEAN/HERITAGE),
-- set only via the builder's template picker. Existing packages' old values
-- (CLASSIC, ADVENTURE, WILDLIFE, etc.) aren't valid under the new domain, so
-- every existing package resets to the new default (SUNRISE) — an agent can
-- pick a different Signature variant again via the template picker.
ALTER TABLE "packages" RENAME COLUMN "view_type" TO "signature_theme";
ALTER TABLE "packages" ALTER COLUMN "signature_theme" SET DEFAULT 'SUNRISE';
UPDATE "packages" SET "signature_theme" = 'SUNRISE';
