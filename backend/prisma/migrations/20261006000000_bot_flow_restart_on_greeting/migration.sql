-- Bot Flow: start the flow again when a returning customer just says "hi".
ALTER TABLE "bot_flows" ADD COLUMN "restart_on_greeting" BOOLEAN NOT NULL DEFAULT true;

-- Which channels a flow's keyword / ad triggers apply to (a WhatsApp flow and
-- an Instagram flow may share the same keyword).
ALTER TABLE "bot_flows" ADD COLUMN "trigger_channels" JSONB NOT NULL DEFAULT '["WHATSAPP","INSTAGRAM"]';
