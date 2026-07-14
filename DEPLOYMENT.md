# Deploying Voyage CRM (client-preview setup)

**Architecture:** Frontend on **Vercel** · API on **Render** (free tier) · Database on
**Supabase** (already live). The Vercel domain proxies `/api/*` to Render via
`frontend/vercel.json`, so auth cookies stay first-party and no frontend code changes
are needed.

```
Browser ──▶ your-app.vercel.app  (static React app)
                 └── /api/* ──proxied──▶ voyage-crm-api.onrender.com ──▶ Supabase
```

> Phase 4 still ships the spec's Docker/VPS deployment; this is the quick client-preview path.

---

## Step 1 — Deploy the API on Render (~5 min)

1. Go to [render.com](https://render.com) → sign in with GitHub → **New → Web Service**.
2. Select the **CRMTravelAgency** repo.
3. Settings:
   | Field | Value |
   |---|---|
   | Name | `voyage-crm-api` ← keep this exact name if available (it's baked into vercel.json) |
   | Region | Singapore (closest to your Supabase in Seoul) |
   | Root Directory | `backend` |
   | Build Command | `npm install --include=dev && npm run build` ← the `--include=dev` matters: with `NODE_ENV=production` set, plain `npm install` skips TypeScript/@types and the build fails |
   | Start Command | `npm start` |
   | Instance Type | Free |
4. **Environment tab** → add every variable from `backend/.env.production`
   (that file is local-only; never commit it). Skip `PORT` — Render sets it.
   This includes the **Supabase Storage** vars (`SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`) that power image
   uploads — without them the app runs fine but the upload button returns 503.
5. Deploy. When it's live, verify: `https://voyage-crm-api.onrender.com/health` → `{"status":"ok"}`.
6. **If Render gave you a different URL** (name taken), edit `frontend/vercel.json` and put
   your actual URL in the `/api/:path*` destination, then commit + push.

## Step 2 — Deploy the frontend on Vercel (~3 min)

1. Go to [vercel.com](https://vercel.com) → sign in with GitHub → **Add New → Project** →
   import **CRMTravelAgency**.
2. Settings:
   | Field | Value |
   |---|---|
   | Root Directory | `frontend` |
   | Framework Preset | Vite (auto-detected) |
   | Build Command | `npm run build` (default) |
   | Output Directory | `dist` (default) |
   | Environment variables | **none needed** |
3. Deploy → you get `https://<something>.vercel.app`.

## Step 3 — Close the CORS loop (1 min)

1. Copy your Vercel URL.
2. Render → your service → Environment → set `CORS_ORIGIN=https://<something>.vercel.app`
   (exact, no trailing slash) → save (auto-redeploys).

## Step 4 — Smoke test

- Open the Vercel URL → landing page loads.
- Sign in with a demo login (`admin@wanderlust.test` / `Password123!`) → dashboard + leads load.
- Sign up a fresh agency → works end to end.

---

## Gotchas & notes

- **Render free tier sleeps** after ~15 min idle; the first request after a nap takes
  30–60 s to wake. Tell your client to give the first login a moment (or upgrade the
  service to remove sleeping).
- **Auto-deploys**: both platforms redeploy on every push to `main`.
- The demo data (Wanderlust / Globe Hoppers) is whatever is in Supabase — the same data
  you see locally, since local dev also points at Supabase now.
- Before real customers: rotate the Supabase database password (it was shared in chat)
  and update `DATABASE_URL` in Render + your local `.env`.
