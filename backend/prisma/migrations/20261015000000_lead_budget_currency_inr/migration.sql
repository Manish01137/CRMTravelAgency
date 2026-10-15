-- Lead budgets default to INR, like every other amount in the CRM. Existing
-- "USD" budgets came from the old form default (agencies are in India), so
-- they're relabelled INR — the amounts themselves are unchanged.
ALTER TABLE "leads" ALTER COLUMN "budget_currency" SET DEFAULT 'INR';
UPDATE "leads" SET "budget_currency" = 'INR' WHERE "budget_currency" = 'USD' OR "budget_currency" IS NULL;
