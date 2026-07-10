-- ---------------------------------------------------------------------------
-- Restricted runtime role for the multi-tenant app (PROJECT_SPEC.md §4)
-- ---------------------------------------------------------------------------
-- `crm_app` is the role that tenantPrisma connects as (APP_DATABASE_URL). It is
-- deliberately NOT the table owner and NOT a superuser, so Row Level Security is
-- ENFORCED for every query it runs. All ordinary tenant traffic goes through it.
--
-- Run this AFTER `prisma migrate deploy` (the tables must already exist).
--
-- Two ways to run it:
--   1. `npm run db:roles`  — substitutes __CRM_APP_PASSWORD__ from CRM_APP_DB_PASSWORD
--                            and executes this file over DATABASE_URL. (recommended)
--   2. Manually (psql / Supabase SQL editor) — replace __CRM_APP_PASSWORD__ below
--                            with the password used in APP_DATABASE_URL, then run.
--
-- Safe to run repeatedly (idempotent).

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'crm_app') THEN
    CREATE ROLE crm_app LOGIN PASSWORD '__CRM_APP_PASSWORD__';
  ELSE
    ALTER ROLE crm_app LOGIN PASSWORD '__CRM_APP_PASSWORD__';
  END IF;
END
$$;

-- Keep the role unprivileged. (No NOSUPERUSER/NOBYPASSRLS here: Supabase's
-- `postgres` user may not touch those attributes, and fresh roles never have
-- them anyway — new roles are created without SUPERUSER or BYPASSRLS.)
ALTER ROLE crm_app NOCREATEDB NOCREATEROLE;

-- Connect to the DB + use the schema.
GRANT USAGE ON SCHEMA public TO crm_app;

-- Data access on existing tables (RLS still filters every row).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crm_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crm_app;

-- Auto-grant the same on tables/sequences future migrations create (as owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO crm_app;
