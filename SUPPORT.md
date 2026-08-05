# 30-Day Bug Support — Voyage CRM

Covers the period **starting from the client's sign-off on Phase 4 (Final
Deployment)** and running for **30 calendar days** from that date.

## What's covered

- Any feature built across **Phases 1–4** behaving differently from its
  documented/demonstrated behavior at sign-off (a genuine bug, not a missing
  feature or a new request).
- Regressions: something that worked at sign-off and stops working without
  any change on the client's side.
- Tenant-isolation issues: any case where one organization can see or affect
  another's data. Treated as **critical, same-day priority** regardless of
  when in the 30 days it's found.
- Deployment/infrastructure issues directly tied to the delivered Docker
  Compose / Nginx / Certbot setup (e.g., the container fails to start with
  the documented configuration).

## What's not covered

- New features or scope not in the original phased proposal.
- Issues caused by editing the delivered code outside of normal use (e.g.,
  hand-editing the database schema, removing the RLS policies, changing
  `ENCRYPTION_KEY` without following the rotation steps).
- Third-party service outages (Supabase, Meta/WhatsApp, Google Gemini,
  Resend/Twilio, the VPS provider) — support here is limited to confirming
  the CRM's own integration code is behaving correctly against that service.
- The two items explicitly flagged as pending below (Meta Business/Tech
  Provider verification, and anything that only becomes testable once it
  clears) — those aren't bugs, they're an external approval still in
  progress.

## Response expectations

| Severity | Example | Target response |
|---|---|---|
| Critical | Tenant-isolation break, app down, data loss | Same day |
| High | A core feature (Leads, Bookings, Inbox, Bot Flow) broken for all users | 1–2 business days |
| Normal | A specific edge case, a display/formatting bug, a non-blocking automation miss | 3–5 business days |

## How to report

Send: what you did, what you expected, what happened instead, and — if it's
data-specific — which organization/lead/booking. Screenshots or the exact
error text speed things up considerably.

## After the 30 days

Ongoing support/maintenance beyond this window is a separate arrangement —
happy to discuss a retainer or ad-hoc basis once the 30 days are up.
