-- Inbox: contact groups (broadcast lists) — one message to many chats, sent to each customer individually.
-- CreateTable
CREATE TABLE "contact_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_group_members" (
    "group_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_group_members_pkey" PRIMARY KEY ("group_id","conversation_id")
);

-- CreateIndex
CREATE INDEX "contact_groups_organization_id_channel_idx" ON "contact_groups"("organization_id", "channel");

-- CreateIndex
CREATE INDEX "contact_group_members_conversation_id_idx" ON "contact_group_members"("conversation_id");

-- CreateIndex
CREATE INDEX "contact_group_members_organization_id_idx" ON "contact_group_members"("organization_id");

-- AddForeignKey
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_groups" ADD CONSTRAINT "contact_groups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "contact_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Row Level Security (same fail-closed tenant pattern as every other table;
-- crm_app's grants come from roles.sql's ALTER DEFAULT PRIVILEGES).
ALTER TABLE "contact_groups" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "contact_groups"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
ALTER TABLE "contact_group_members" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "contact_group_members"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
