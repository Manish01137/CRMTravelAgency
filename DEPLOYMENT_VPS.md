# Deploying Voyage CRM — self-hosted VPS (Phase 4)

**Architecture:** Nginx + Node backend + Redis, all in Docker Compose, on a
KVM VPS (e.g. Hostinger). **Supabase remains the hosted database** — nothing
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

- A KVM VPS with **Docker** + **Docker Compose plugin** installed (`docker compose version` should work). Hostinger's KVM plans ship a stock Ubuntu image — install via:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- A domain (or subdomain) with its **A record pointed at the VPS's IP address**. Certbot needs this resolving correctly before it can issue a certificate — do this first, DNS can take a few minutes to a few hours to propagate.
- Your Supabase project's connection strings (already live — same ones used in local dev throughout this build): `DATABASE_URL`, `APP_DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

## 1. Get the code onto the VPS

```bash
ssh youruser@your-vps-ip
git clone <your-repo-url> voyage-crm
cd voyage-crm
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
  --email you@youragency.com --agree-tos --no-eff-email
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
0 3 * * 1 cd /path/to/voyage-crm && docker compose -f docker-compose.prod.yml run --rm certbot certbot renew --webroot -w /var/www/certbot && docker compose -f docker-compose.prod.yml restart web
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
