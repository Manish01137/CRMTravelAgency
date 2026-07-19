-- LinkTree (public travel package hub) fields.
ALTER TABLE "packages" ADD COLUMN "show_on_linktree" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organizations" ADD COLUMN "linktree_cover_url" TEXT;
