-- Instagram-via-Page webhook routing: object:"page" payloads identify
-- themselves by Facebook Page id, not the IG-scoped account id already
-- stored in external_id.
ALTER TABLE "channel_connections" ADD COLUMN "secondary_external_id" TEXT;
