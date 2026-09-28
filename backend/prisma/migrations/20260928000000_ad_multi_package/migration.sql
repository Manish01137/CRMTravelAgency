-- Ads -> Packages: allow several packages per ad (one row per ad+package).
-- Additive-safe in either deploy order: until this runs, the old unique
-- index just rejects a second package for the same ad (a clean 409).

-- DropIndex
DROP INDEX "ad_package_mappings_organization_id_ad_id_key";

-- CreateIndex
CREATE UNIQUE INDEX "ad_package_mappings_organization_id_ad_id_package_id_key" ON "ad_package_mappings"("organization_id", "ad_id", "package_id");

-- CreateIndex
CREATE INDEX "ad_package_mappings_organization_id_ad_id_idx" ON "ad_package_mappings"("organization_id", "ad_id");
