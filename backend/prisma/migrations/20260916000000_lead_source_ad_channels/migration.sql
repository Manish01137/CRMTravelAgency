-- AlterEnum: distinct paid-ad lead sources (Meta Ads / Facebook Ads / Instagram Ads),
-- separate from the existing organic FACEBOOK / INSTAGRAM sources.
ALTER TYPE "LeadSource" ADD VALUE 'META_ADS';
ALTER TYPE "LeadSource" ADD VALUE 'FACEBOOK_ADS';
ALTER TYPE "LeadSource" ADD VALUE 'INSTAGRAM_ADS';
