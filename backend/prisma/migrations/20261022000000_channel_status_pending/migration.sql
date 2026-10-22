-- WhatsApp connections whose number Meta hasn't activated yet (Embedded Signup
-- done, but the number isn't registered / verified on the Cloud API).
ALTER TYPE "ChannelConnectionStatus" ADD VALUE IF NOT EXISTS 'PENDING';
