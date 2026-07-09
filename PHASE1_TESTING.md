# Phase 1 — Testing Checklist

This maps every item in **PROJECT_SPEC.md §6 (Phase 1 → Test)** to how it's verified.

Because the database was intentionally deferred ("scaffold only, DB later"), items are
split into:

- **✅ Verified now** — checks that don't need a live database (they were actually run).
- **⏳ Ready to run** — runtime checks that need a Postgres/Supabase connection. The exact
  command / steps are given so they can be executed the moment a DB is connected.

---

## ✅ Verified now (no database required)

| Check | Result |
|---|---|
| Backend TypeScript typechecks (`npm run typecheck --prefix backend`) | Pass |
| Backend production build (`npm run build --prefix backend`) | Pass |
| Prisma schema validates (`npx prisma validate`) | Pass |
| Prisma Client generates | Pass |
| Backend boots and serves `/health` → `{"status":"ok"}` | Pass |
| Unknown route → 404 JSON; `/api/auth/me` w/o token → 401 JSON | Pass |
| Invalid signup body → 400 JSON with per-field errors (zod) | Pass |
| Frontend TypeScript typechecks (`npm run typecheck --prefix frontend`) | Pass |
| Frontend production build (`npm run build --prefix frontend`) | Pass |
| RLS policies + restricted-role design reviewed (fail-closed, owner-vs-crm_app) | See §4 of spec / migration.sql |

---

## ⏳ Ready to run (connect a database first)

One-time setup:

```bash
# option A — local Postgres
npm run db:up

# then, against whichever DB is configured in backend/.env:
npm run db:migrate     # creates tables + RLS policies
npm run db:roles       # creates the restricted crm_app role (RLS enforcement)
npm run db:seed        # optional demo data (two orgs)
npm run dev            # api :4000 + web :5173
```

### Spec test checklist

| Spec item | How to verify | Status |
|---|---|---|
| **Signup creates org + admin** | Sign up at `/signup`. One `organizations` row + one `users` row (role ADMIN) are created in a single transaction. Verify in `npx prisma studio`. | ⏳ |
| **Login works, session persists** | Log in; refresh the page — you stay signed in (httpOnly cookie + `/auth/me` rehydrate). | ⏳ |
| **Dashboard loads without errors** | Land on `/dashboard`; stat cards + recent leads render (empty-state if no leads). | ⏳ |
| **Lead CRUD works** | On `/leads`: create, edit, delete, search, and filter (status / source / assignee) + pagination. | ⏳ |
| **Org A cannot see Org B's leads (app + direct query)** | `npm run test:isolation` — automated proof via the restricted `crm_app` role (see below). Also verifiable by hand: log in as each seeded org. | ⏳ |
| **User invite flow works** | As admin, `/team` → Invite → copy the generated link → open it in a private window → accept → new member appears. | ⏳ |
| **Every screen on mobile viewport** | Resize to <768px (or device toolbar): sidebar → hamburger drawer, tables → cards, forms single-column, 44px targets. | ⏳ |

### The tenant-isolation test (spec §4.5 — the most important one)

```bash
npm run test:isolation
```

Asserts, running as the restricted `crm_app` role, that Org A:
1. sees only its own leads via the app path,
2. sees only its own rows via a raw `SELECT * FROM leads` with **no** WHERE clause,
3. cannot read, update, or delete Org B's rows even when asking for them by id,
4. cannot forge a row into Org B (RLS `WITH CHECK`),
5. sees **zero** rows when no org context is set (fail-closed).

> Requires `APP_DATABASE_URL` to point at the `crm_app` role (`npm run db:roles`). The test
> refuses to run against the owner connection so it can never produce a false "pass".

---

## Known issues / shortcuts taken in Phase 1

- **Email delivery is stubbed.** Invitations generate a secure link the admin copies/shares
  manually; real email sending (Resend/SendGrid) is Phase 3. The invite→accept flow itself is
  fully working.
- **Logo is a URL, not an upload.** Org branding takes a logo image URL; direct file upload
  (Supabase Storage) is a later enhancement.
- **Global-unique email.** A person can belong to one organization. If two orgs invite the same
  email, the first to accept wins; the second sees a clear "already exists" error at accept time.
- **Frontend bundle is a single chunk (~560 kB).** Fine for Phase 1; code-splitting is part of
  Phase 4 performance work.
- **Auth is a single JWT in an httpOnly cookie (7-day).** No refresh-token rotation yet — a
  reasonable Phase 1 posture; can be hardened later.
