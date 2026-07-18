-- Host Page mini-website fields on the organization.
ALTER TABLE "organizations"
  ADD COLUMN "banner_image_url" TEXT,
  ADD COLUMN "about_text" TEXT,
  ADD COLUMN "contact_phone" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "address" TEXT;
