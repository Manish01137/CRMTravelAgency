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

/**
 * Verifies Meta's `X-Hub-Signature-256` header against the raw request body.
 * MUST be checked against the raw (unparsed) bytes — see app.ts's `verify`
 * callback on express.json(), which stashes `req.rawBody` for this purpose.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!signatureHeader || !env.META_APP_SECRET) return false;
  const expected = crypto.createHmac('sha256', env.META_APP_SECRET).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');
  const expectedBuf = Buffer.from(expected, 'hex');
  const providedBuf = Buffer.from(provided, 'hex');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/** Webhook verification handshake (GET /webhooks): Meta calls this once on subscribe. */
export function checkWebhookVerifyToken(mode: unknown, token: unknown): boolean {
  return mode === 'subscribe' && !!env.META_WEBHOOK_VERIFY_TOKEN && token === env.META_WEBHOOK_VERIFY_TOKEN;
}

// --- WhatsApp Embedded Signup -----------------------------------------------

/** Exchanges the Embedded Signup `code` for an access token (long-lived for a System User). */
export async function exchangeWhatsAppCode(code: string): Promise<{ accessToken: string }> {
  requireMetaConfigured();
  const params = new URLSearchParams({
    client_id: env.META_APP_ID!,
    client_secret: env.META_APP_SECRET!,
    code,
  });
  const data = await graphFetch<{ access_token: string }>(`/oauth/access_token?${params.toString()}`);
  return { accessToken: data.access_token };
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

// --- Instagram (API with Instagram Login — no Facebook Page required) ------

export function isInstagramConfigured(): boolean {
  return !!(env.META_INSTAGRAM_APP_ID ?? env.META_APP_ID) && !!env.META_APP_SECRET;
}

async function instagramFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => null)) as (T & { error_message?: string; error?: { message?: string } }) | null;
  if (!res.ok) {
    const message = data?.error_message ?? data?.error?.message ?? `Instagram API request failed (${res.status})`;
    throw new AppError(502, 'INSTAGRAM_API_ERROR', message);
  }
  return data as T;
}

/** Exchanges the OAuth `code` (from instagram.com/oauth/authorize) for a short-lived token. */
export async function exchangeInstagramCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; userId: string }> {
  if (!isInstagramConfigured()) {
    throw new AppError(503, 'META_NOT_CONFIGURED', 'Instagram connection is not configured on the server');
  }
  const form = new URLSearchParams({
    client_id: env.META_INSTAGRAM_APP_ID ?? env.META_APP_ID!,
    client_secret: env.META_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
  });
  const data = await instagramFetch<{ access_token: string; user_id: string }>(
    'https://api.instagram.com/oauth/access_token',
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() },
  );
  return { accessToken: data.access_token, userId: String(data.user_id) };
}

/** Short-lived (1h) → long-lived (60d) token exchange. */
export async function exchangeLongLivedInstagramToken(shortLivedToken: string): Promise<{ accessToken: string }> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: env.META_APP_SECRET!,
    access_token: shortLivedToken,
  });
  const data = await instagramFetch<{ access_token: string }>(
    `https://graph.instagram.com/access_token?${params.toString()}`,
  );
  return { accessToken: data.access_token };
}

export async function fetchInstagramProfile(accessToken: string): Promise<{ userId: string; username: string }> {
  const data = await instagramFetch<{ user_id: string; username: string }>(
    `https://graph.instagram.com/me?fields=user_id,username&access_token=${encodeURIComponent(accessToken)}`,
  );
  return { userId: String(data.user_id), username: data.username };
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
