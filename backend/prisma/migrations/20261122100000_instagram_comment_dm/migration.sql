-- CreateEnum
CREATE TYPE "CommentReplyStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "instagram_comment_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "media" JSONB NOT NULL DEFAULT '[]',
    "keywords" JSONB NOT NULL DEFAULT '[]',
    "package_id" UUID,
    "dm_text" TEXT NOT NULL,
    "public_reply" TEXT,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_comment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_comment_replies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rule_id" UUID,
    "comment_id" TEXT NOT NULL,
    "media_id" TEXT,
    "ad_id" TEXT,
    "ig_user_id" TEXT NOT NULL,
    "username" TEXT,
    "comment_text" TEXT,
    "conversation_id" UUID,
    "status" "CommentReplyStatus" NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instagram_comment_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "instagram_comment_rules_organization_id_idx" ON "instagram_comment_rules"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_comment_replies_comment_id_key" ON "instagram_comment_replies"("comment_id");

-- CreateIndex
CREATE INDEX "instagram_comment_replies_organization_id_created_at_idx" ON "instagram_comment_replies"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "instagram_comment_replies_ig_user_id_media_id_idx" ON "instagram_comment_replies"("ig_user_id", "media_id");

-- AddForeignKey
ALTER TABLE "instagram_comment_rules" ADD CONSTRAINT "instagram_comment_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comment_rules" ADD CONSTRAINT "instagram_comment_rules_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comment_replies" ADD CONSTRAINT "instagram_comment_replies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instagram_comment_replies" ADD CONSTRAINT "instagram_comment_replies_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "instagram_comment_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "instagram_comment_rules" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "instagram_comment_rules"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);

ALTER TABLE "instagram_comment_replies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON "instagram_comment_replies"
    USING ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid)
    WITH CHECK ("organization_id" = NULLIF(current_setting('app.current_org_id', true), '')::uuid);
