-- Bot Flow: after a flow finishes, an AI assistant answers new requests
-- (sends matching packages from the CRM, or hands over to the team).
ALTER TABLE "bot_flows" ADD COLUMN "ai_follow_up" BOOLEAN NOT NULL DEFAULT true;
