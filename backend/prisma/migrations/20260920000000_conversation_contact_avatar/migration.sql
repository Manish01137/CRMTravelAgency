-- Instagram DM sender's profile picture, re-hosted on our own storage since
-- Meta's profile_pic URL (Instagram User Profile API) expires after a few
-- days — see webhooks.service.ts's resolveInstagramContactInfo.
ALTER TABLE "conversations" ADD COLUMN "contact_avatar_url" TEXT;
