-- AlterEnum: new Bot Flow step types
ALTER TYPE "BotFlowStepType" ADD VALUE 'MESSAGE';
ALTER TYPE "BotFlowStepType" ADD VALUE 'HANDOFF';
ALTER TYPE "BotFlowStepType" ADD VALUE 'SEND_PACKAGE';
ALTER TYPE "BotFlowStepType" ADD VALUE 'AI_OPEN';

-- AlterTable: per-type extra parameters (SEND_PACKAGE's packageId, AI_OPEN's instructions)
ALTER TABLE "bot_flow_steps" ADD COLUMN "config" JSONB NOT NULL DEFAULT '{}';
