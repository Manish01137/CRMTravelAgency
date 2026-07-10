# Connecting Voyage CRM to Supabase

The schema + RLS are plain Postgres, so moving from local Docker to Supabase is only a
connection-string swap. Two ways to set it up — **Option A needs no SQL editor at all.**

---

## 0. Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Pick a name (e.g. `voyage-crm`), a strong **database password** (save it!), and a region
   near you (e.g. Mumbai `ap-south-1`).
3. Wait ~2 minutes for provisioning.

## Where the connection strings live

**Project Settings → Database → Connection string.** Use the **Session pooler** tab
(port `5432`, IPv4-friendly — the "Direct connection" is often IPv6-only). It looks like:

```
postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Note the username format on the pooler: `postgres.<PROJECT_REF>` — and for our app role
it will be `crm_app.<PROJECT_REF>` (same suffix).

---

## Option A — recommended (no SQL editor)

Everything runs from your machine with the tooling already in this repo:

1. Edit `backend/.env`:

   ```env
   DATABASE_URL="postgresql://postgres.<PROJECT_REF>:<DB_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   APP_DATABASE_URL="postgresql://crm_app.<PROJECT_REF>:<CRM_APP_PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres"
   CRM_APP_DB_PASSWORD="<CRM_APP_PASSWORD>"   # pick a strong one — used by db:roles below
   ```

2. From the repo root:

   ```bash
   npm run db:migrate    # creates tables + RLS policies on Supabase
   npm run db:roles      # creates the restricted crm_app role
   npm run db:seed       # optional demo data
   npm run test:isolation  # proves tenant isolation on Supabase itself
   ```

3. `npm run dev` — the app now runs against Supabase.

## Option B — via the Supabase SQL Editor

1. Open [`supabase/setup.sql`](./supabase/setup.sql), **replace
   `CHANGE_ME_STRONG_PASSWORD`** with a password you choose (it appears twice in one block).
2. Supabase dashboard → **SQL Editor** → paste the whole file → **Run**. (It's idempotent —
   safe to run again.)
3. Fill `backend/.env` exactly as in Option A step 1.
4. One extra command so Prisma knows the schema already exists (run from `backend/`):

   ```bash
   npx prisma migrate resolve --applied 20260101000000_init
   ```

5. Optional: `npm run db:seed` and `npm run test:isolation` from the repo root.

---

## Switching back to local Docker

Just restore the local values in `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm?schema=public"
APP_DATABASE_URL="postgresql://crm_app:crm_app_pw@localhost:5432/crm?schema=public"
```

## Gotchas

- **Never commit `.env`** (it's already gitignored).
- The Supabase **anon/service API keys are not used** — this app talks to Postgres via
  Prisma, not the Supabase client SDK. Only the two connection strings matter.
- If `crm_app` fails to log in through the pooler, double-check the username is
  `crm_app.<PROJECT_REF>` (with the project-ref suffix), not plain `crm_app`.
- The Supabase dashboard's Table Editor runs as an RLS-exempt role, so it will show all
  rows across organizations — that's expected; the isolation applies to the `crm_app`
  runtime role the API uses. `npm run test:isolation` is the proof.
