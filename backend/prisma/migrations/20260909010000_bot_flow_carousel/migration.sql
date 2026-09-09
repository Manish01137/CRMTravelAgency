-- Bot Flow CAROUSEL step (WhatsApp Interactive List message of packages).
ALTER TYPE "BotFlowStepType" ADD VALUE 'CAROUSEL';

-- Captures which row a customer tapped on an interactive list/button message.
ALTER TABLE "messages" ADD COLUMN "interactive_selection_id" TEXT;
