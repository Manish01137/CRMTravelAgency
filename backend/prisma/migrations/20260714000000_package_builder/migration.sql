-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "banner_image_url" TEXT,
ADD COLUMN     "booking_title" TEXT,
ADD COLUMN     "cancellation_policy" TEXT,
ADD COLUMN     "categories" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "code" TEXT,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_number" TEXT,
ADD COLUMN     "faqs" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "gallery_images" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "highlights" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "itinerary" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "original_price" INTEGER,
ADD COLUMN     "payment_terms" TEXT,
ADD COLUMN     "pickup_points" TEXT,
ADD COLUMN     "pricing_options" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "terms_conditions" TEXT,
ADD COLUMN     "things_to_carry" TEXT,
ADD COLUMN     "view_type" TEXT NOT NULL DEFAULT 'CLASSIC',
ADD COLUMN     "whatsapp_banner_url" TEXT,
ADD COLUMN     "whatsapp_description" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "packages_organization_id_slug_key" ON "packages"("organization_id", "slug");

