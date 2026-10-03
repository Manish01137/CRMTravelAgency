-- Bot Flow phase 2: several flows per org started by keyword / Meta ad,
-- three automatic step types, and lead tags. Additive only.

-- AlterEnum
ALTER TYPE "BotFlowStepType" ADD VALUE 'SET_ATTRIBUTE';
ALTER TYPE "BotFlowStepType" ADD VALUE 'ADD_TAG';
ALTER TYPE "BotFlowStepType" ADD VALUE 'UPDATE_STAGE';

-- AlterTable
ALTER TABLE "bot_flows" ADD COLUMN "trigger_keywords" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "keyword_match" TEXT NOT NULL DEFAULT 'contains',
ADD COLUMN "trigger_ad_ids" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "leads" ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
