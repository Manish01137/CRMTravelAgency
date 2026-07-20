-- Simplify Sightseeing to Name + Cover Image + Description only.
-- Drops the removed fields safely (IF EXISTS won't crash on already-migrated DBs).
DROP INDEX IF EXISTS "sightseeing_organization_id_city_idx";

ALTER TABLE "sightseeing"
  DROP COLUMN IF EXISTS "city",
  DROP COLUMN IF EXISTS "country",
  DROP COLUMN IF EXISTS "timings",
  DROP COLUMN IF EXISTS "points";
