# Travel Agency CRM

A multi-tenant, self-service Travel Agency CRM (SaaS). One codebase + one database serve
every agency; each agency is an `Organization` and every other row is scoped by
`organization_id`, with Postgres Row Level Security (RLS) as a database-level safety net.

See [`PROJECT_SPEC.md`](./PROJECT_SPEC.md) for the full product spec and phase plan.

> **Status: Phase 1 — Foundation (code complete, awaiting a database connection to run).**
> Signup, JWT auth, roles, dashboard shell, profile/org settings, user management, and
> organization-scoped Leads CRUD are all implemented. Migrations and the runtime test
> checklist run as soon as you point `DATABASE_URL` at a Postgres/Supabase instance.

---

## Repository layout

```
CRMTravel/
├── PROJECT_SPEC.md        # product spec (source of truth)
├── docker-compose.yml     # local Postgres for development
├── package.json           # root convenience scripts (dev/build/db)
├── backend/               # Node + Express + TypeScript + Prisma
│   ├── prisma/
│   │   ├── schema.prisma         # organizations, users, leads, invitations
│   │   ├── migrations/           # base tables + RLS policies (versioned)
│   │   ├── rls/roles.sql         # restricted runtime role + grants
│   │   └── seed.ts               # demo data (two orgs, for isolation testing)
│   ├── src/
│   │   ├── lib/                  # prisma clients, jwt, password, errors, validation
│   │   ├── middleware/           # auth, tenant RLS context, roles, errors
│   │   └── modules/             # auth, organizations, users, leads
│   └── tests/isolation.test.ts   # proves Org A cannot read/write Org B's data
└── frontend/              # React + Vite + TS + Tailwind + shadcn-style UI
    └── src/
        ├── components/ui/        # design-system primitives
        ├── components/layout/    # responsive app shell (sidebar / mobile nav)
        ├── context/AuthContext   # session
        └── pages/                # signup, login, dashboard, leads, users, settings
```

---

## Prerequisites

- Node.js 20+ (tested on 22) and npm 10+
- A Postgres database. Either:
  - **Local (recommended for dev):** Docker Desktop running → `npm run db:up`
  - **Supabase (production target):** a project + its connection strings

---

## Quick start

### 1. Install dependencies

```bash
npm install                 # root (concurrently helper)
npm run install:all         # backend + frontend
```

### 2. Configure the backend environment

```bash
cp backend/.env.example backend/.env
```

Then edit `backend/.env`. The two important variables:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | **Owner/admin** connection. Used for migrations and the *narrow* auth surface (login lookup + signup). |
| `APP_DATABASE_URL` | **Restricted runtime** connection (`crm_app` role). Used by every tenant request; RLS is enforced on it. Falls back to `DATABASE_URL` with a loud warning if unset. |

**Local Postgres** (after `npm run db:up`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm?schema=public"
APP_DATABASE_URL="postgresql://crm_app:crm_app_pw@localhost:5432/crm?schema=public"
JWT_SECRET="dev-secret-change-me"
```

**Supabase**: use the Session pooler / direct string from *Project Settings → Database*.
Put the privileged `postgres` string in `DATABASE_URL`, and (after creating the `crm_app`
role — see below) its string in `APP_DATABASE_URL`.

### 3. Create the schema, RLS policies, and runtime role

```bash
npm run db:migrate          # prisma migrate deploy  (tables + RLS policies)
npm run db:roles            # creates the restricted crm_app role + grants
npm run db:seed             # optional: two demo orgs for isolation testing
```

### 4. Run

```bash
npm run dev                 # backend :4000 + frontend :5173 together
```

Open http://localhost:5173 and sign up — that creates your Organization + Admin in one
transaction.

---

## Verifying tenant isolation (the most important test)

```bash
npm run test:isolation
```

This seeds two organizations and asserts, using the **restricted runtime connection**, that:
1. Org A's session sees only Org A's leads.
2. A raw `SELECT * FROM leads` with **no** `organization_id` filter still returns only Org A's rows (RLS at work).
3. Org A cannot read, update, or delete Org B's rows even when it asks for them by id.

---

## Design system

Indigo/violet primary (`#4F46E5`), teal success (`#0D9488`), white/near-white surfaces,
General Sans (display) + Inter (body), 8–12px radii, subtle shadows. Every screen is mobile
responsive (sidebar → hamburger drawer, tables → cards, single-column forms, ≥44px targets).

---

## Scripts (root)

| Command | Does |
|---|---|
| `npm run dev` | Run backend + frontend together |
| `npm run build` | Type-check + build both apps |
| `npm run typecheck` | Type-check both apps |
| `npm run db:up` / `db:down` | Start / stop local Postgres |
| `npm run db:migrate` | Apply migrations (tables + RLS) |
| `npm run db:seed` | Seed demo data |
| `npm run test:isolation` | Prove cross-org isolation |
# CRMTravelAgency
