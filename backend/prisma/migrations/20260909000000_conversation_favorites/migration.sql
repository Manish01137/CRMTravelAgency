-- Inbox filter chips: Favorites (starred conversations). "Read"/"Unread"
-- reuse the existing unread_count column — no schema change needed for those.
ALTER TABLE "conversations" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;
