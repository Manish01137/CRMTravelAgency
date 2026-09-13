import crypto from 'node:crypto';
import { env } from '../env';
import { AppError } from './errors';

/**
 * Meta Graph API client — WhatsApp Business Platform + Instagram Messaging.
 *
 * One Meta App (Developer console) is shared by the whole platform. Each
 * organization connects its OWN WhatsApp number / Instagram account via
 * Embedded Signup, logging into their own Meta account and granting
 * permission directly to Meta — we only ever receive the resulting access
 * token, never their password. See modules/channels for the connect flow.
 *
 * Uses the platform's global `fetch` (Node 20+) — no HTTP client dependency.
 */

const GRAPH_BASE = () => `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;

export function isMetaConfigured(): boolean {
  return !!(env.META_APP_ID && env.META_APP_SECRET);
}

function requireMetaConfigured(): void {
  if (!isMetaConfigured()) {
    throw new AppError(503, 'META_NOT_CONFIGURED', 'WhatsApp/Instagram connection is not configured on the server');
  }
}

async function graphFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${GRAPH_BASE()}${path}`, init);
  const data = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok) {
    const message = data?.error?.message ?? `Graph API request failed (${res.status})`;
    throw new AppError(502, 'META_API_ERROR', message);
  }
  return data as T;
}

/** One HMAC-SHA256 attempt: expected signature for `secret` vs. the provided (already `sha256=`-stripped) hex string. */
function signatureMatches(rawBody: Buffer, providedHex: string, secret: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(providedHex, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body.
 * MUST be checked against the raw (unparsed) bytes — see app.ts's `verify`
 * callback on express.json(), which stashes `req.rawBody` for this purpose.
 *
 * THREE separate Meta Apps can deliver to this one shared /webhooks/meta
 * endpoint — the original app (Facebook Login, META_APP_SECRET), "Joinetraa"
 * (WhatsApp, META_WHATSAPP_APP_SECRET), and a dedicated Instagram app
 * (META_INSTAGRAM_APP_SECRET) — each signing with its OWN App Secret. Meta
 * gives no way to tell which app sent a request before verifying it, so: try
 * every configured secret and accept on the first match, rather than
 * guessing from payload shape.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  // TEMP DEBUG — logs the received signature, the raw bytes actually being
  // signed (to catch a re-serialized/re-parsed body, a very common way to
  // silently break HMAC verification), and every configured secret's
  // computed expected signature + individual match result. Never logs a
  // secret's actual value — only its name and length.
  console.log('[verifyWebhookSignature] received X-Hub-Signature-256:', signatureHeader);
  console.log(
    '[verifyWebhookSignature] rawBody length:',
    rawBody.length,
    '| rawBody (first 500 chars):',
    rawBody.toString('utf8').slice(0, 500),
  );

  if (!signatureHeader) {
    console.log('[verifyWebhookSignature] REJECTED — no signature header present at all');
    return false;
  }
  const provided = signatureHeader.replace(/^sha256=/, '');
  console.log('[verifyWebhookSignature] provided signature (sha256= stripped):', provided);

  const namedSecrets: { name: string; secret: string | undefined }[] = [
    { name: 'META_APP_SECRET', secret: env.META_APP_SECRET },
    { name: 'META_WHATSAPP_APP_SECRET', secret: env.META_WHATSAPP_APP_SECRET },
    { name: 'META_INSTAGRAM_APP_SECRET', secret: env.META_INSTAGRAM_APP_SECRET },
  ];
  console.log(
    '[verifyWebhookSignature] configured secrets:',
    namedSecrets.map((s) => `${s.name}=${s.secret ? `set (${s.secret.length} chars)` : 'UNSET'}`).join(', '),
  );

  let matchedName: string | null = null;
  for (const { name, secret } of namedSecrets) {
    if (!secret) continue;
    // Real accept/reject decision still goes through the unmodified
    // signatureMatches() below — this expected-hex is computed separately,
    // purely so it can be logged; it does not change what gets accepted.
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const matches = signatureMatches(rawBody, provided, secret);
    console.log(`[verifyWebhookSignature] tried ${name} — expected: ${expected} | matches: ${matches}`);
    if (matches && !matchedName) matchedName = name;
  }

  if (matchedName) {
    console.log('[verifyWebhookSignature] ACCEPTED — matched', matchedName);
    return true;
  }
  console.log('[verifyWebhookSignature] REJECTED — no configured secret matched');
  return false;
}

/** Webhook verification handshake (GET /webhooks): Meta calls this once on subscribe. */
export function checkWebhookVerifyToken(mode: unknown, token: unknown): boolean {
  return mode === 'subscribe' && !!env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN;
}

// --- WhatsApp Embedded Signup -----------------------------------------------

/**
 * WhatsApp is its own separate Meta App ("Joinetraa") — its own App ID/Secret,
 * distinct from the one Instagram/Facebook Login uses. Falls back to the
 * shared META_APP_ID/SECRET when the dedicated pair isn't set, same pattern
 * as META_INSTAGRAM_APP_ID's fallback below.
 */
function resolveWhatsAppAppCredentials(): { appId: string; appSecret: string } | null {
  const appId = env.META_WHATSAPP_APP_ID ?? env.META_APP_ID;
  const appSecret = env.META_WHATSAPP_APP_SECRET ?? env.META_APP_SECRET;
  return appId && appSecret ? { appId, appSecret } : null;
}

export function isWhatsAppConfigured(): boolean {
  return !!resolveWhatsAppAppCredentials();
}

/** Exchanges the Embedded Signup `code` for an access token (long-lived for a System User). */
export async function exchangeWhatsAppCode(code: string): Promise<{ accessToken: string }> {
  const creds = resolveWhatsAppAppCredentials();
  if (!creds) {
    throw new AppError(503, 'META_NOT_CONFIGURED', 'WhatsApp connection is not configured on the server');
  }
  const params = new URLSearchParams({
    client_id: creds.appId,
    client_secret: creds.appSecret,
    code,
  });
  const data = await graphFetch<{ access_token: string }>(`/oauth/access_token?${params.toString()}`);
  return { accessToken: data.access_token };
}

export type WhatsAppDiscoveryResult =
  | { status: 'found'; wabaId: string; phoneNumberId: string }
  | { status: 'not_found' }
  /** More than one WABA (across any of the token's businesses) or more than one phone number on the one WABA found — genuinely ambiguous, not ours to guess. */
  | { status: 'ambiguous'; reason: string };

/**
 * Fallback for when the client couldn't hand us wabaId/phoneNumberId (see
 * connectWhatsAppSchema's comment) — discovers them from the exchanged token
 * itself via Graph API. Assumes a single-WABA business: checks for ambiguity
 * across EVERY business the token can see (not just the first one with any
 * WABA) before ever returning a match — never silently picks among multiple
 * candidates. No picker UI yet for the ambiguous case (see
 * channels.service.ts) — it's surfaced as an error instead of guessed.
 */
export async function discoverWhatsAppWabaAndPhoneNumber(accessToken: string): Promise<WhatsAppDiscoveryResult> {
  const businesses = await graphFetch<{ data: { id: string; name?: string }[] }>('/me/businesses', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => null);
  if (!businesses?.data?.length) return { status: 'not_found' };

  // Gather every WABA across every business this token can see — ambiguity
  // has to be judged across ALL of them, not just whichever business we
  // happen to check first.
  const wabas: { id: string; businessId: string }[] = [];
  for (const business of businesses.data) {
    const result = await graphFetch<{ data: { id: string; name?: string }[] }>(
      `/${business.id}/owned_whatsapp_business_accounts`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).catch(() => null);
    for (const w of result?.data ?? []) wabas.push({ id: w.id, businessId: business.id });
  }

  if (wabas.length === 0) return { status: 'not_found' };
  if (wabas.length > 1) {
    console.warn(
      `discoverWhatsAppWabaAndPhoneNumber: ${wabas.length} WhatsApp Business Accounts found across ${businesses.data.length} business(es) — refusing to guess`,
      wabas,
    );
    return { status: 'ambiguous', reason: `Found ${wabas.length} WhatsApp Business Accounts — can't tell which one to connect` };
  }

  const wabaId = wabas[0].id;
  const phoneNumbers = await graphFetch<{ data: { id: string; display_phone_number?: string }[] }>(
    `/${wabaId}/phone_numbers`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  ).catch(() => null);
  if (!phoneNumbers?.data?.length) return { status: 'not_found' };
  if (phoneNumbers.data.length > 1) {
    console.warn(
      `discoverWhatsAppWabaAndPhoneNumber: WABA ${wabaId} has ${phoneNumbers.data.length} phone numbers — refusing to guess`,
      phoneNumbers.data,
    );
    return { status: 'ambiguous', reason: `This WhatsApp Business Account has ${phoneNumbers.data.length} phone numbers — can't tell which one to connect` };
  }

  return { status: 'found', wabaId, phoneNumberId: phoneNumbers.data[0].id };
}

export async function fetchWhatsAppPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
): Promise<{ displayPhoneNumber: string }> {
  const data = await graphFetch<{ display_phone_number: string }>(
    `/${phoneNumberId}?fields=display_phone_number`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return { displayPhoneNumber: data.display_phone_number };
}

/** Registers our webhook to receive this WABA's messages. Required once per WABA. */
export async function subscribeWabaWebhook(wabaId: string, accessToken: string): Promise<void> {
  await graphFetch(`/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function sendWhatsAppText(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  body: string,
): Promise<{ externalMessageId: string }> {
  const data = await graphFetch<{ messages: { id: string }[] }>(`/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  return { externalMessageId: data.messages[0].id };
}

export interface WhatsAppListRow {
  /** Sent back verbatim as interactive.list_reply.id when the customer taps this row — keep it short and parseable. */
  id: string;
  title: string; // max 24 chars — Meta truncates/rejects longer
  description?: string; // max 72 chars
}

/**
 * Sends a WhatsApp "Interactive List" message — a free-form message (no
 * template/approval needed, works inside the 24h session window like a plain
 * text message) that shows a tappable list of options. This is what the Bot
 * Flow CAROUSEL step uses to show multiple packages in one message; Meta's
 * actual swipeable image-card "Carousel Template" is a different, separate
 * feature that requires a pre-approved message template — not this.
 */
export async function sendWhatsAppList(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttonLabel: string,
  rows: WhatsAppListRow[],
): Promise<{ externalMessageId: string }> {
  const data = await graphFetch<{ messages: { id: string }[] }>(`/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonLabel.slice(0, 20),
          sections: [{ rows: rows.slice(0, 10) }], // Meta caps at 10 rows total across all sections
        },
      },
    }),
  });
  return { externalMessageId: data.messages[0].id };
}

export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  language: string,
): Promise<{ externalMessageId: string }> {
  const data = await graphFetch<{ messages: { id: string }[] }>(`/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: language } },
    }),
  });
  return { externalMessageId: data.messages[0].id };
}

export async function createWhatsAppTemplate(
  wabaId: string,
  accessToken: string,
  input: { name: string; category: string; language: string; bodyText: string },
): Promise<{ externalTemplateId: string }> {
  const data = await graphFetch<{ id: string }>(`/${wabaId}/message_templates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: input.name,
      category: input.category,
      language: input.language,
      components: [{ type: 'BODY', text: input.bodyText }],
    }),
  });
  return { externalTemplateId: data.id };
}

// --- Instagram (Facebook Login flow — classic Instagram Graph API, reached
// through a connected Facebook Page). Shares the same Meta App ID/Secret as
// WhatsApp above; no separate Instagram app or credentials are used. --------

export function isInstagramConfigured(): boolean {
  return isMetaConfigured();
}

/** Step 1 — exchanges the Facebook Login `code` for a short-lived user access token. */
export async function exchangeFacebookUserCode(code: string, redirectUri: string): Promise<{ accessToken: string }> {
  requireMetaConfigured();
  const params = new URLSearchParams({
    client_id: env.META_APP_ID!,
    client_secret: env.META_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  });
  const data = await graphFetch<{ access_token: string }>(`/oauth/access_token?${params.toString()}`);
  return { accessToken: data.access_token };
}

/** Step 2 — short-lived user token → long-lived (~60 day) user token. */
export async function exchangeLongLivedUserToken(shortLivedToken: string): Promise<{ accessToken: string }> {
  requireMetaConfigured();
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.META_APP_ID!,
    client_secret: env.META_APP_SECRET!,
    fb_exchange_token: shortLivedToken,
  });
  const data = await graphFetch<{ access_token: string }>(`/oauth/access_token?${params.toString()}`);
  return { accessToken: data.access_token };
}

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

/**
 * Step 3 — lists the Facebook Pages this user manages. Each page's own access
 * token, derived from a long-lived user token, does not expire — no refresh
 * job is needed for it (unlike the old direct-Instagram-token flow).
 * Assumes a single page of results (Meta's default page size of 25) — fine
 * for a travel agency managing a handful of Pages; not worth paginating here.
 */
export async function fetchManagedFacebookPages(userAccessToken: string): Promise<FacebookPage[]> {
  const data = await graphFetch<{ data: { id: string; name: string; access_token: string }[] }>(
    '/me/accounts?fields=id,name,access_token',
    { headers: { Authorization: `Bearer ${userAccessToken}` } },
  );
  return data.data.map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
}

/** Step 4 — looks up the Instagram professional account linked to one Facebook Page, if any. */
export async function fetchPageInstagramAccount(
  pageId: string,
  pageAccessToken: string,
): Promise<{ instagramBusinessAccountId: string | null }> {
  const data = await graphFetch<{ instagram_business_account?: { id: string } }>(
    `/${pageId}?fields=instagram_business_account`,
    { headers: { Authorization: `Bearer ${pageAccessToken}` } },
  );
  return { instagramBusinessAccountId: data.instagram_business_account?.id ?? null };
}

/** Fetches the @username for display once we know which Instagram account is being connected. */
export async function fetchInstagramUsername(igAccountId: string, pageAccessToken: string): Promise<string> {
  const data = await graphFetch<{ username: string }>(`/${igAccountId}?fields=username`, {
    headers: { Authorization: `Bearer ${pageAccessToken}` },
  });
  return data.username;
}

/** Registers our webhook to receive this Page's messages. Required once per connected Page. */
export async function subscribePageWebhook(pageId: string, pageAccessToken: string): Promise<void> {
  await graphFetch(`/${pageId}/subscribed_apps?subscribed_fields=messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${pageAccessToken}` },
  });
}

export async function sendInstagramText(
  igUserId: string,
  accessToken: string,
  recipientId: string,
  text: string,
): Promise<{ externalMessageId: string }> {
  const data = await graphFetch<{ message_id: string }>(`/${igUserId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  return { externalMessageId: data.message_id };
}
