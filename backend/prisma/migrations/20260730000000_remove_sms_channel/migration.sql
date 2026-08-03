-- Remove SMS entirely. Defensive delete first (both tables are currently
-- empty in every environment we've seen, but this keeps the migration safe
-- to run against any environment where a channel was actually connected).
DELETE FROM "channel_connections" WHERE "channel" = 'SMS';
DELETE FROM "communication_logs" WHERE "channel" = 'SMS';

-- Postgres has never implemented `ALTER TYPE ... DROP VALUE` — recreate each
-- enum type without SMS and re-point the column at it (the standard pattern).
ALTER TYPE "ChannelType" RENAME TO "ChannelType_old";
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'EMAIL');
ALTER TABLE "channel_connections" ALTER COLUMN "channel" TYPE "ChannelType" USING ("channel"::text::"ChannelType");
DROP TYPE "ChannelType_old";

ALTER TYPE "CommChannel" RENAME TO "CommChannel_old";
CREATE TYPE "CommChannel" AS ENUM ('EMAIL');
ALTER TABLE "communication_logs" ALTER COLUMN "channel" TYPE "CommChannel" USING ("channel"::text::"CommChannel");
DROP TYPE "CommChannel_old";
