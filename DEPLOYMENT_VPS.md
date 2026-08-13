# Deploying Joinetra — self-hosted VPS (Phase 4)

**Architecture:** Nginx + Node backend + Redis, all in Docker Compose, on a
Hostinger **KVM 4** VPS. **Supabase remains the hosted database** — nothing
about Supabase changes; this only covers running the app itself.

```
Browser ──▶ your-domain.com (Nginx, port 443)
                 ├── /            → static React build
                 └── /api/* ──────▶ backend container (port 4000) ──▶ Supabase
                                          └── Redis (Bot Flow poller,
                                              follow-up automation)
```

This is the production path the client proposal asked for. `DEPLOYMENT.md`
(Render + Vercel) still works as a quick preview path if you ever want it —
the two are independent; this doc doesn't touch that one.

---

## 0. Prerequisites

- **The Hostinger KVM 4 VPS itself.** From the [hPanel](https://hpanel.hostinger.com) → VPS → your KVM 4 instance, install the stock **Ubuntu 22.04** OS template if you haven't already (hPanel → OS → Operating System). Note the VPS's public **IP address** — shown on the VPS overview page — you'll need it for DNS.
- **Docker** + **Docker Compose plugin** on the VPS (`docker compose version` should work after this):
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- **A domain**, bought either through Hostinger (Domains → Buy a new domain) or elsewhere (Namecheap, GoDaddy, etc. — doesn't matter, DNS works the same). Once you have it:
  1. Go to your domain's DNS zone editor (Hostinger: hPanel → Domains → your domain → DNS / Nameservers).
  2. Add an **A record**: Host `@` (root domain) → Points to `<your VPS IP>`, TTL default.
  3. Add a second **A record**: Host `www` → Points to the same VPS IP (so `www.joinetra.com` also resolves — optional but recommended).
  4. Wait for propagation — usually 10–30 min, sometimes a few hours. Check with `dig +short your-domain.com` from any machine; it should return your VPS IP.

  Certbot (step 4 below) needs this resolving correctly before it can issue a certificate — do this first.
- Your Supabase project's connection strings (already live — same ones used in local dev throughout this build): `DATABASE_URL`, `APP_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 1. Get the code onto the VPS

```bash
ssh youruser@your-vps-ip
git clone <your-repo-url> joinetra
cd joinetra
```

## 2. Configure `backend/.env`

This is the **real production `.env`** the backend container reads (via `env_file` in `docker-compose.prod.yml`). It is gitignored — create it fresh on the VPS:

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Fill in (see `backend/.env.example` for the full annotated list):

| Var | Value |
|---|---|
| `DATABASE_URL` / `APP_DATABASE_URL` | Your Supabase connection strings (same ones from local dev) |
| `CORS_ORIGIN` | `https://your-domain.com` (no trailing slash) |
| `JWT_SECRET` | A real random secret — `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` — **must be the same value already in use**, or every stored channel/AI credential becomes undecryptable. Copy it from wherever your current `.env` has it. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | Same as local dev |
| `META_*` | Same as local dev, once you have them |
| **`REDIS_URL`** | `redis://redis:6379` — **must be this exact value**. `redis` is the Docker Compose service hostname, not `localhost` (the backend runs in its own container). |

The RLS role (`crm_app`) and all migrations are already applied against this Supabase project from earlier work — nothing to re-run here unless you're pointing at a brand-new Supabase project, in which case: `cd backend && npx prisma migrate deploy && npm run db:roles`.

## 3. First boot — HTTP only (before you have a certificate)

`nginx/nginx.conf` (already in the repo) is the HTTP-only bootstrap config — deploy with this first; Certbot can't issue a cert for a domain that isn't serving anything yet.

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps      # all 4 services should be "Up" / "healthy"
curl http://your-domain.com/api/webhooks/meta      # any non-connection-refused response confirms the proxy works
```

Open `http://your-domain.com` in a browser — the app should load (over plain HTTP for now).

## 4. Get an SSL certificate (Certbot)

```bash
docker compose -f docker-compose.prod.yml run --rm certbot \
  certbot certonly --webroot -w /var/www/certbot \
  -d your-domain.com \
  --email joinetra@gmail.com --agree-tos --no-eff-email
```

This writes the cert into the `certbot_conf` volume, which `nginx.ssl.conf` (below) reads from.

## 5. Switch Nginx to HTTPS

```bash
# Edit the two YOUR_DOMAIN placeholders first:
sed -i 's/YOUR_DOMAIN/your-domain.com/g' nginx/nginx.ssl.conf
cp nginx/nginx.ssl.conf nginx/nginx.conf
docker compose -f docker-compose.prod.yml restart web
```

Visit `https://your-domain.com` — should load over HTTPS with a valid padlock. Plain `http://` now redirects to `https://` (see the SSL config's first server block).

## 6. Auto-renew the certificate

Let's Encrypt certs expire every 90 days. Add a cron job on the VPS host (outside Docker):

```bash
crontab -e
# add this line:
0 3 * * 1 cd /path/to/joinetra && docker compose -f docker-compose.prod.yml run --rm certbot certbot renew --webroot -w /var/www/certbot && docker compose -f docker-compose.prod.yml restart web
```

Runs weekly; `certbot renew` is a no-op unless the cert is within 30 days of expiry, so this is safe to run often.

## 7. Smoke test checklist

- [ ] `https://your-domain.com` loads the landing page over a valid HTTPS cert
- [ ] Log in with a real account → dashboard loads
- [ ] Leads / Bookings / Inbox list screens load
- [ ] Settings → Channels shows correctly (Connect buttons work or show "not configured" — never a crash)
- [ ] Settings → AI Agent and Settings → Automation load
- [ ] Bot Flows page loads
- [ ] Backend logs show `✓ Automation workers started (Bot Flow poller, follow-up sweep)` — confirms Redis connected:
  ```bash
  docker compose -f docker-compose.prod.yml logs backend --tail=50
  ```

## 8. Meta verification (domain + WhatsApp/Instagram)

This is what turns "the app can technically reach Meta's API" into "Meta will
actually let a real customer's WhatsApp number and Instagram account connect."
Do this once your domain is live over HTTPS (step 5 above) — several of
these steps need a real, reachable HTTPS URL.

### 8.1 Domain verification (Meta Business Manager)

1. Go to [business.facebook.com/settings](https://business.facebook.com/settings) → **Brand Safety → Domains** → **Add**.
2. Enter `your-domain.com`.
3. Verify ownership — two ways, pick whichever's easier:
   - **DNS TXT record** (recommended, no app changes needed): Meta gives you a value like `meta-domain-verification=xxxxxxxx`. Add it as a TXT record on `your-domain.com` in your DNS zone editor, wait for propagation, click **Verify** in Business Manager.
   - **HTML file upload**: Meta gives you a file like `facebook-domain-verification-xxxx.html` — drop it in `frontend/public/` in this repo (it gets served as a static file automatically by Vite/Nginx at `your-domain.com/facebook-domain-verification-xxxx.html`), rebuild/redeploy, then click **Verify**.
4. Once verified, go to your **App Dashboard** ([developers.facebook.com/apps](https://developers.facebook.com/apps)) → your app → **App Settings → Basic** → **App Domains** → add `your-domain.com`.

### 8.2 Privacy Policy + Terms of Service URLs (required by Meta, not yet built)

Meta's App Settings → Basic requires a **Privacy Policy URL** before you can
request WhatsApp/Instagram messaging permissions, and App Review usually
also expects a **Terms of Service URL** and a **Data Deletion Instructions
URL**. Right now the app doesn't have real pages for these — the landing
page footer's "Privacy Policy" link is a placeholder (`href="#"`) and there's
no Terms page at all. You'll need actual pages at, e.g., `your-domain.com/privacy`
and `your-domain.com/terms` before Meta will accept the app for anything
beyond test numbers. Flag this back to me when you're ready for this step —
happy to draft both pages and wire up the routes/footer links so this isn't
a last-minute blocker.

### 8.3 Business verification

1. Business Manager → **Business Settings → Security Center → Start Verification**.
2. Meta will ask for: legal business name, address, phone, and typically a
   business document (GST certificate, incorporation certificate, or similar,
   depending on region) that matches the name/address you enter.
3. This can take anywhere from minutes to a few business days. Required
   before WhatsApp Business API access moves past a handful of test
   conversations.

### 8.4 Webhook subscription (connects Meta → your server)

1. App Dashboard → your app → **Webhooks** → for the **WhatsApp Business
   Account** (and separately for **Instagram**) product, click **Subscribe**.
2. **Callback URL:** `https://your-domain.com/api/webhooks/meta`
3. **Verify Token:** must exactly match `META_WEBHOOK_VERIFY_TOKEN` in `backend/.env` on the VPS.
4. Subscribe to the `messages` field (WhatsApp) and `messages` / `messaging` (Instagram) — these are what feed the Inbox and Bot Flow.
5. Meta will hit the callback URL once with a `GET` challenge request the moment you click Subscribe — if the app + Nginx + Certbot steps above are all working, this succeeds automatically. If it fails, check `docker compose -f docker-compose.prod.yml logs backend` for the incoming request.

### 8.5 WhatsApp Embedded Signup Configuration ID

App Dashboard → your app → **WhatsApp → Embedded Signup** → create (or use
the existing) configuration → copy its **Configuration ID** → set
`META_WHATSAPP_CONFIG_ID` in `backend/.env` on the VPS → restart the backend
container. This is the one still missing on your current setup — without it,
Settings → Channels keeps WhatsApp's Connect button disabled even though
`META_APP_ID`/`META_APP_SECRET` are already in.

### 8.6 Going live beyond test numbers (App Review)

Everything above gets you a **working integration for test WhatsApp numbers
and your own Instagram account**. To let real client organizations connect
their *own* numbers, Meta requires **App Review** for the
`whatsapp_business_messaging` and `instagram_manage_messages` (+related)
permissions — this is where the Privacy Policy/Terms pages (8.2), domain
verification (8.1), and business verification (8.3) all get checked. Meta
typically also asks for a short screen recording showing the actual
connect → send/receive message flow in the live app.

## Day-to-day operations

**Deploy an update** (after `git pull`):
```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

**View logs:**
```bash
docker compose -f docker-compose.prod.yml logs -f backend   # API + workers
docker compose -f docker-compose.prod.yml logs -f web       # Nginx access/error
```

**Restart a single service:**
```bash
docker compose -f docker-compose.prod.yml restart backend
```

**Database migrations on future changes:** the backend image doesn't run migrations automatically on boot (by design — a bad migration shouldn't be able to take down a rolling deploy silently). Run them explicitly before/alongside a deploy:
```bash
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```
