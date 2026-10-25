-- Quick replies get a button name shown above the message box ("Price list").
ALTER TABLE "quick_replies" ADD COLUMN "title" TEXT;

-- Replies saved before this: their shortcut as the name ("price-list" → "Price list").
UPDATE "quick_replies"
SET "title" = upper(left(replace(replace("shortcut", '-', ' '), '_', ' '), 1)) || substr(replace(replace("shortcut", '-', ' '), '_', ' '), 2)
WHERE "title" IS NULL;

ALTER TABLE "quick_replies" ALTER COLUMN "title" SET NOT NULL;
