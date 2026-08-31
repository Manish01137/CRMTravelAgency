-- AlterTable: organizations — tax-invoice header/footer details
ALTER TABLE "organizations" ADD COLUMN "secondary_phone" TEXT;
ALTER TABLE "organizations" ADD COLUMN "secondary_email" TEXT;
ALTER TABLE "organizations" ADD COLUMN "state_name" TEXT;
ALTER TABLE "organizations" ADD COLUMN "state_code" TEXT;
ALTER TABLE "organizations" ADD COLUMN "bank_name" TEXT;
ALTER TABLE "organizations" ADD COLUMN "bank_account_number" TEXT;
ALTER TABLE "organizations" ADD COLUMN "ifsc_code" TEXT;
ALTER TABLE "organizations" ADD COLUMN "gstin" TEXT;
ALTER TABLE "organizations" ADD COLUMN "pan" TEXT;
ALTER TABLE "organizations" ADD COLUMN "hsn_code" TEXT;
ALTER TABLE "organizations" ADD COLUMN "signature_image_url" TEXT;
ALTER TABLE "organizations" ADD COLUMN "signatory_title" TEXT;
ALTER TABLE "organizations" ADD COLUMN "invoice_terms_conditions" TEXT;

-- AlterTable: invoices — bill-to extras + advance amount
ALTER TABLE "invoices" ADD COLUMN "customer_company_name" TEXT;
ALTER TABLE "invoices" ADD COLUMN "customer_address" TEXT;
ALTER TABLE "invoices" ADD COLUMN "advance_amount" INTEGER NOT NULL DEFAULT 0;
