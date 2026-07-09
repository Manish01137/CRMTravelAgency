# Travel Agency CRM — Master Build Specification
*For use with Claude Code. Read this entire document before writing any code.*

---

## 0. How to use this document

1. Save this file as `PROJECT_SPEC.md` in the root of your repo.
2. Paste the **Kickoff Prompt** (Section 7) into Claude Code to start Phase 1.
3. After each phase, Claude Code will stop and ask your permission before continuing — this is enforced by the **Phase Gate Rule** in Section 5. Just reply `"approved, start phase 2"` (etc.) when you're ready.

---

## 1. Project Overview

A **multi-tenant, self-service Travel Agency CRM** (SaaS product, not a one-off client build). One shared codebase and one database serve every client — each travel agency is an `Organization` row, and every other table is scoped by `organization_id`. New agencies can sign up themselves, get their own branded dashboard, and manage everything (leads, bookings, packages, team, integrations) without developer involvement.

Core loop: an enquiry comes in on WhatsApp/Instagram/Facebook/website → a bot captures it as a lead automatically → the agency's team follows up, builds a package/itinerary, confirms the booking, and generates an invoice → automation handles follow-up nudges and AI assists with replies throughout.

---

## 2. Tech Stack (locked — do not substitute without asking)

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | Supabase (managed PostgreSQL) + Prisma ORM |
| Automation / queue | Redis + BullMQ |
| AI | Google Gemini API (Gemini Flash for chat/bot replies) |
| WhatsApp | Meta WhatsApp Cloud API (or BSP wrapper — confirm which before Phase 3) |
| Instagram / Facebook | Instagram Graph API + Facebook Messenger Platform API |
| Email | Resend (or SendGrid) |
| SMS | Twilio (or MSG91) |
| Auth | JWT-based, role-based permissions (Admin / Agent) |
| Hosting | Backend + Redis + Nginx on a KVM VPS via Docker Compose; database hosted separately on Supabase |

---

## 3. Design System — Premium, White + Accent

- **Base surfaces:** white / near-white (`#FFFFFF`, `#F8F9FB`) — clean, spacious, no clutter
- **Primary accent:** deep indigo/violet — `#4F46E5`
- **Secondary accent:** teal — `#0D9488` (used for success states, confirmed bookings, positive metrics)
- **Text:** near-black navy — `#1A2340` for headings, `#5B6270` for secondary text
- **Typography:**
  - Headings/display: **Cabinet Grotesk** or **General Sans** (free on Fontshare) — gives that premium SaaS feel
  - Body/UI: **Inter** or **Plus Jakarta Sans** (Google Fonts) — clean, highly legible at small sizes
- **Corners:** 8–12px radius on cards/buttons — soft, modern, never sharp
- **Shadows:** subtle only (`0 1px 3px rgba(0,0,0,0.06)`) — no heavy drop shadows
- **Motion:** 150–200ms transitions on hover/state changes; skeleton loaders instead of spinners where content is loading
- **Mobile responsive — non-negotiable on every screen:**
  - Sidebar collapses to a hamburger/bottom nav below 768px
  - Tables convert to stacked cards on mobile, never horizontal-scroll-only
  - Forms stack to single-column on mobile
  - Touch targets minimum 44px height
- Reference aesthetic: think Linear, Stripe Dashboard, Vercel — clean, confident, lots of whitespace, one accent color doing the work, not five.

---

## 4. Multi-Tenant Rules (non-negotiable)

1. Every table storing client data **must** have an `organization_id` foreign key.
2. Every single database query **must** filter by the authenticated user's `organization_id`. No exceptions, no "just for now."
3. **Enable Supabase Row Level Security (RLS) on every client-data table**, with a policy that only returns rows matching the requesting user's `organization_id`. This is a database-level safety net — even if a query in the application code forgets the filter, the database itself must refuse to return another organization's rows.
4. Signup automatically creates one `Organization` row + one `Admin` user in a single transaction.
5. Before Phase 4 sign-off, explicitly test that Organization A can never see Organization B's data, both through the application AND by attempting a direct query without the organization filter — this is the single most important thing to get right in this entire build.

---

## 5. Phase Gate Rule (critical — follow exactly)

> After completing all features and all testing checklist items for the **current phase only**:
> 1. Summarize what was built and what was tested, including any known issues or shortcuts taken.
> 2. **Stop.** Do not write any code for the next phase.
> 3. Explicitly ask the user for permission to continue.
> 4. Only proceed once the user replies with clear approval (e.g. "approved, start phase 2").
>
> Never skip this gate, even if the next phase seems small or related work is tempting to start early.

---

## 6. Phase-by-Phase Breakdown

### Phase 1 — Foundation
**Build:**
- Public signup page (auto-creates Organization + Admin user)
- Login / Authentication (JWT)
- Roles & Permissions (Admin / Agent)
- Dashboard shell (empty-state ready, structured for widgets later)
- Profile page + Organization settings (name, logo, brand colors)
- Users management (Admin invites/manages Agents)
- Leads Management (Add, Edit, Delete, Search, Filter) — organization-scoped
- Database schema (Prisma, hosted on Supabase): `organizations`, `users`, `leads` — with Row Level Security policies enabled from the start, not added later
- Full design system applied: fonts, colors, base components, mobile-responsive shell

**Test:**
- Signup correctly creates org + admin
- Login works, session persists
- Dashboard loads without errors
- Lead CRUD works, and a second test organization cannot see the first org's leads
- User invite flow works
- Every Phase 1 screen checked on mobile viewport

### Phase 2 — Core CRM
**Build:** Bookings, Itinerary builder, Package builder, Scheduler, Follow-up reminders, Events/Departure calendar, Invoice, Bills — all organization-scoped

**Test:** Lead → Booking flow, Booking → Itinerary, Package management, Invoice generation, Event & scheduler working, mobile check on all new screens

### Phase 3 — Communication
**Build:** WhatsApp Inbox, Instagram Inbox, Email integration, SMS integration, Call Log/Call Monitor. Each organization connects its **own** API keys via Settings (WhatsApp Business number, Instagram/Facebook, email/SMS provider, Gemini API key).

**Test:** Send & receive messages, email sending, SMS sending, call logs working, and confirm messages/leads route only to the correct organization

### Phase 4 — Automation & Final Delivery
**Build:** Bot Flow builder, AI Agent Builder (Google Gemini API), AI Automation (auto follow-up via BullMQ — nudges a lead automatically if no reply within a set time), bug fixes, performance optimization, final deployment (Docker Compose + Nginx, database on Supabase), 30 days of included bug support.

**Test:** Complete CRM regression test, AI workflow test, Bot flow test, **multi-organization/multi-user testing under real conditions** (this is where tenant isolation gets verified for real), final deployment check.

---

## 7. Kickoff Prompt (paste this into Claude Code)

```
You are building a multi-tenant Travel Agency CRM. Read PROJECT_SPEC.md in this repo
fully before writing any code. Follow the tech stack (Section 2) — including Supabase
as the database with Prisma, and Google Gemini as the AI provider — the design system
(Section 3), and the multi-tenant rules (Section 4) exactly as specified, including
enabling Row Level Security on every client-data table. Do not substitute technologies
or skip the organization_id scoping.

Start with Phase 1 only (Section 6). Do not write any code for Phase 2, 3, or 4 yet.

Follow the Phase Gate Rule in Section 5 strictly: once Phase 1's features and testing
checklist are complete, stop, summarize what was built and tested, flag any known
issues, and explicitly ask for my permission before starting Phase 2. Do not proceed
automatically under any circumstances.

Design requirements: premium, clean, white-based UI using the indigo/violet accent
and typography defined in Section 3. Every single screen must be fully mobile
responsive — check this before considering any screen done. Functionality and visual
polish are both required, not a tradeoff.

Begin Phase 1 now.
```

**To continue after each phase**, once you've reviewed and are happy, just reply:
```
Approved — start Phase 2.
```
(swap the number each time.)
