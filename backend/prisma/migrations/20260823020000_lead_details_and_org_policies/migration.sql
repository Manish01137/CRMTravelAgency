-- AlterEnum: more lead sources
ALTER TYPE "LeadSource" ADD VALUE 'GOOGLE_ADS';
ALTER TYPE "LeadSource" ADD VALUE 'GOOGLE_MY_BUSINESS';
ALTER TYPE "LeadSource" ADD VALUE 'YOUTUBE';
ALTER TYPE "LeadSource" ADD VALUE 'EMAIL';
ALTER TYPE "LeadSource" ADD VALUE 'JUSTDIAL';
ALTER TYPE "LeadSource" ADD VALUE 'EXHIBITION';

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('B2C', 'B2B', 'CORPORATE', 'VIP');

-- AlterTable: leads
ALTER TABLE "leads" ADD COLUMN "customer_type" "CustomerType" NOT NULL DEFAULT 'B2C';
ALTER TABLE "leads" ADD COLUMN "package_id" UUID;
ALTER TABLE "leads" ADD CONSTRAINT "leads_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: organizations (default policy text, auto-filled into new packages)
ALTER TABLE "organizations" ADD COLUMN "default_cancellation_policy" TEXT;
ALTER TABLE "organizations" ADD COLUMN "default_payment_terms" TEXT;
ALTER TABLE "organizations" ADD COLUMN "default_terms_conditions" TEXT;
