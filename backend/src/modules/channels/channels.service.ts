import { randomInt } from 'crypto';
import { systemPrisma, withTenant } from '../../lib/prisma';
import { forgetChannelCredentials } from '../bot-flow/bot-send';
import { encryptJson, decryptJson } from '../../lib/encryption';
import { env } from '../../env';
import {
  isWhatsAppConfigured,
  exchangeWhatsAppCode,
  discoverWhatsAppWabaAndPhoneNumber,
  subscribeWabaWebhook,
  registerWhatsAppPhoneNumber,
  fetchWhatsAppPhoneNumberStatus,
  requestWhatsAppVerificationCode,
  verifyWhatsAppCode,
  listWabaPhoneNumbers,
  assertPhoneBelongsToWaba,
  metaErrorCode,
  exchangeFacebookUserCode,
  exchangeLongLivedUserToken,
  fetchManagedFacebookPages,
  fetchPageInstagramAccount,
  fetchInstagramUsername,
  subscribePageWebhook,
  getWhatsAppBusinessProfile as fetchWhatsAppBusinessProfile,
  updateWhatsAppBusinessProfile as pushWhatsAppBusinessProfile,
  uploadWhatsAppProfilePhotoHandle,
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramLoginProfile,
  refreshInstagramLongLivedToken,
  subscribeInstagramLoginWebhooks,
    isInstagramLoginConfigured,
  WHATSAPP_PAYMENT_MESSAGE,
} from '../../lib/meta';
import type { WhatsAppBusinessProfile, UpdateWhatsAppBusinessProfileInput, WhatsAppPhoneNumberStatus } from '../../lib/meta';
import { AppError } from '../../lib/errors';
import type {
  ConnectEmailInput,
  ConnectInstagramInput,
  ConnectWhatsAppInput,
  SelectInstagramPageInput,
} from './channels.schemas';

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  /** Two-step verification PIN we set when registering the number on the Cloud API (6 digits). Never logged or returned. */
  registrationPin?: string;
}
/**
 * `accessToken` is now a Facebook Page Access Token (doesn't expire) and
 * `igUserId` is the Instagram professional account's id — both obtained via
 * the Facebook Login flow (see connectInstagram below), not a direct
 * Instagram user token/id as before. Field names kept as-is since every
 * consumer (inbox, bot-flow, automation) just forwards them to
 * sendInstagramText(igUserId, accessToken, ...), which is unaffected.
 */
export interface InstagramCredentials {
  accessToken: string;
  igUserId: string;
  /** Instagram Login tokens last ~60 days — renewed by refreshInstagramTokens before then. */
  tokenExpiresAt?: string;
}
export interface EmailCredentials {
  apiKey: string;
  fromAddress: string;
}

/** One Facebook Page + its linked Instagram account, as surfaced to the picker when more than one matches. */
export interface InstagramPageOption {
  pageId: string;
  pageName: string;
  instagramBusinessAccountId: string;
  instagramUsername: string;
  pageAccessToken: string;
}

export type ConnectInstagramResult =
  | { status: 'connected'; channel: ChannelStatus }
  | { status: 'needs_selection'; options: InstagramPageOption[] };

/** Public-safe shape — credentials are NEVER included. */
export interface ChannelStatus {
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL';
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'PENDING' | 'FAILED';
  displayName: string | null;
  lastError: string | null;
  connectedAt: Date | null;
  /** WhatsApp: a message recently failed because the Meta account has no payment method. */
  billingIssue?: boolean;
}

const ALL_CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'EMAIL'] as const;

/**
 * Public (non-secret) values the frontend needs to launch each OAuth flow —
 * Meta App IDs, the Graph API version, and an Embedded-Signup Configuration
 * ID are meant to be used client-side per Meta's own docs. App SECRETS never
 * leave the server (see lib/meta.ts). WhatsApp is its own Meta App
 * ("Joinetraa") with its own App ID — separate from `metaAppId`, which
 * Instagram/Facebook Login uses.
 */
// Logged at most once per server process — getPlatformConfig() is hit on
// every Channels Settings page load, and this warning would otherwise spam
// the logs on every single request.
let warnedMissingWhatsAppAppId = false;

export async function getPlatformConfig() {
  const whatsappAppId = env.META_WHATSAPP_APP_ID ?? env.META_APP_ID ?? null;
  if (whatsappAppId && !env.META_WHATSAPP_APP_ID && !warnedMissingWhatsAppAppId) {
    warnedMissingWhatsAppAppId = true;
    // No dedicated WhatsApp app configured — silently reusing META_APP_ID
    // (the Instagram/Facebook Login app) for WhatsApp Embedded Signup's
    // FB.init() too. That's fine ONLY if that app also has "Login with the
    // JavaScript SDK" enabled in Meta's dashboard; if it doesn't (e.g. you
    // created a separate WhatsApp app for this, like most setups do),
    // FB.login() fails with "JSSDK Option is Not Toggled". Fix: set
    // META_WHATSAPP_APP_ID (and META_WHATSAPP_APP_SECRET) to your dedicated
    // WhatsApp app's credentials.
    console.warn(
      '[channels] META_WHATSAPP_APP_ID is not set — WhatsApp Embedded Signup is falling back to META_APP_ID. ' +
        'If that app does not have "Login with the JavaScript SDK" enabled, connecting WhatsApp will fail with "JSSDK Option is Not Toggled".',
    );
  }

  return {
    whatsappEnabled: isWhatsAppConfigured() && !!env.META_WHATSAPP_CONFIG_ID,
    instagramEnabled: isInstagramLoginConfigured(),
    emailEnabled: true,
    metaAppId: env.META_APP_ID ?? null,
    whatsappAppId,
    instagramAppId: env.META_INSTAGRAM_APP_ID ?? null,
    metaGraphVersion: env.META_GRAPH_VERSION,
    whatsappConfigId: env.META_WHATSAPP_CONFIG_ID ?? null,
  };
}

/** Lists all three channels' status for the org, synthesizing NOT_CONNECTED for any never touched. */
export async function listChannels(organizationId: string): Promise<ChannelStatus[]> {
  return withTenant(organizationId, async (tx) => {
    const rows = await tx.channelConnection.findMany({ where: { organizationId } });
    // Billing: a WhatsApp send failed for lack of a payment method in the last
    // week, and no template has been delivered since (adding a card fixes it).
    let billingIssue = false;
    if (rows.some((r) => r.channel === 'WHATSAPP' && r.status === 'CONNECTED')) {
      const failed = await tx.message.findFirst({
        where: {
          conversation: { channel: 'WHATSAPP' },
          direction: 'OUTBOUND',
          status: 'FAILED',
          errorMessage: WHATSAPP_PAYMENT_MESSAGE,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (failed) {
        const deliveredSince = await tx.message.findFirst({
          where: {
            conversation: { channel: 'WHATSAPP' },
            direction: 'OUTBOUND',
            templateName: { not: null },
            status: { in: ['DELIVERED', 'READ'] },
            createdAt: { gt: failed.createdAt },
          },
          select: { id: true },
        });
        billingIssue = !deliveredSince;
      }
    }
    return ALL_CHANNELS.map((channel) => {
      const row = rows.find((r) => r.channel === channel);
      return {
        channel,
        status: row?.status ?? 'NOT_CONNECTED',
        displayName: row?.displayName ?? null,
        lastError: row?.lastError ?? null,
        connectedAt: row?.connectedAt ?? null,
        ...(channel === 'WHATSAPP' && { billingIssue }),
      };
    });
  });
}

/** Marks a channel FAILED with a clear message — contained to this one org's row only. */
async function markFailed(organizationId: string, channel: (typeof ALL_CHANNELS)[number], message: string) {
  await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel } },
      create: { organizationId, channel, status: 'FAILED', lastError: message },
      update: { status: 'FAILED', lastError: message },
    }),
  );
  forgetChannelCredentials(organizationId);
}

export async function connectWhatsApp(
  organizationId: string,
  input: ConnectWhatsAppInput,
): Promise<ChannelStatus & { needsVerification: boolean }> {
  try {
    const { accessToken } = await exchangeWhatsAppCode(input.code);

    let wabaId = input.wabaId;
    let phoneNumberId = input.phoneNumberId;
    if (wabaId && !phoneNumberId) {
      // Popup told us the WABA but not the number (FINISH_ONLY_WABA) — look on that WABA only.
      const numbers = await listWabaPhoneNumbers(wabaId, accessToken);
      if (numbers.length === 0) {
        throw new AppError(502, 'WABA_DISCOVERY_FAILED', 'No phone number found on this WhatsApp Business Account — add one in Meta and connect again');
      }
      if (numbers.length > 1) {
        throw new AppError(409, 'WABA_NEEDS_SELECTION', 'This WhatsApp Business Account has several phone numbers — contact support to complete setup', {
          reason: `WhatsApp Business Account has ${numbers.length} phone numbers — can't tell which one to connect`,
        });
      }
      phoneNumberId = numbers[0].id;
    } else if (!wabaId || !phoneNumberId) {
      // Client couldn't capture these from the popup (see connectWhatsAppSchema's
      // comment) — fall back to discovering them ourselves from the token.
      const discovered = await discoverWhatsAppWabaAndPhoneNumber(accessToken);
      if (discovered.status === 'not_found') {
        throw new AppError(502, 'WABA_DISCOVERY_FAILED', 'Could not find a WhatsApp Business Account for this login — please try connecting again');
      }
      if (discovered.status === 'ambiguous') {
        // Multiple candidates — connecting the wrong one silently would be
        // worse than failing here. No picker UI yet, so this just stops.
        throw new AppError(409, 'WABA_NEEDS_SELECTION', 'Multiple WhatsApp accounts found — contact support to complete setup', { reason: discovered.reason });
      }
      wabaId = discovered.wabaId;
      phoneNumberId = discovered.phoneNumberId;
    }

    // Inbound messages are routed by WABA id — it has to be the one holding the number.
    await assertPhoneBelongsToWaba(wabaId, phoneNumberId, accessToken);

    // Reconnecting the same number keeps its PIN (Meta rejects a different one once set).
    const existing = await storedWhatsAppCredentials(organizationId);
    const registrationPin = existing?.phoneNumberId === phoneNumberId && existing.registrationPin ? existing.registrationPin : newRegistrationPin();
    const credentials: WhatsAppCredentials = { accessToken, phoneNumberId, wabaId, registrationPin };

    // Every Graph call first, then one database write.
    const activation = await activateWhatsAppNumber(credentials, { register: true });
    const row = await saveWhatsAppActivation(organizationId, credentials, activation);
    return { ...toStatus(row), needsVerification: activation.needsVerification };
  } catch (err) {
    console.error(err);
    const message = err instanceof AppError ? err.message : 'Could not connect WhatsApp — please try again';
    await markFailed(organizationId, 'WHATSAPP', message);
    // Preserve a specific AppError's own status/code (e.g. WABA_NEEDS_SELECTION)
    // instead of collapsing everything to a generic 502 — the frontend needs
    // to tell "ambiguous, needs a human" apart from "just failed, try again".
    if (err instanceof AppError) throw err;
    throw new AppError(502, 'CHANNEL_CONNECT_FAILED', message);
  }
}

// --- Activating the WhatsApp number on the Cloud API --------------------------
//
// Embedded Signup only adds the number to the WABA. It stays "Pending" in
// WhatsApp Manager — and can't send or receive — until it's registered
// (POST /{id}/register with a two-step PIN), and registering needs the number
// to have passed its SMS/voice code check. The connection is only CONNECTED
// once Meta itself says the number is; otherwise PENDING with the reason.

export interface WhatsAppSyncResult {
  status: ChannelStatus['status'];
  lastError: string | null;
  /** Meta wants the number verified with an SMS / voice code before it can be registered. */
  needsVerification: boolean;
}

interface WhatsAppActivation {
  connected: boolean;
  lastError: string | null;
  needsVerification: boolean;
  displayPhoneNumber: string | null;
}

/** Meta error codes from /register with a clear next step. */
const REGISTER_HINTS: Record<number, string> = {
  133005: 'This number already has a two-step verification PIN. Turn two-step verification off for it in WhatsApp Manager (Phone numbers → Settings), then press Re-check status.',
  133006: 'Meta needs the number verified with a code first — request a code below.',
  133008: 'Too many PIN attempts — wait a few hours, then press Re-check status.',
  133009: 'PIN attempts too fast — wait a minute, then press Re-check status.',
  133016: 'Too many registration attempts for this number — wait a few hours, then press Re-check status.',
};

const UNVERIFIED = new Set(['NOT_VERIFIED', 'EXPIRED']);

function newRegistrationPin(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/** The org's stored WhatsApp credentials, whatever the connection's status (null if there are none). */
async function storedWhatsAppCredentials(organizationId: string): Promise<WhatsAppCredentials | null> {
  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } }, select: { credentials: true } }),
  );
  if (!row?.credentials) return null;
  try {
    return decryptJson<WhatsAppCredentials>(row.credentials);
  } catch {
    return null; // unreadable (e.g. ENCRYPTION_KEY rotated) — treat as none
  }
}

/** Reads Meta's view of the number into our CONNECTED / PENDING terms. */
function describeNumberStatus(status: WhatsAppPhoneNumberStatus, registerError: unknown): WhatsAppActivation {
  const connected = status.status === 'CONNECTED';
  const code = metaErrorCode(registerError);
  const needsVerification = !connected && (UNVERIFIED.has(status.codeVerificationStatus ?? '') || code === 133006);
  if (connected) return { connected, lastError: null, needsVerification: false, displayPhoneNumber: status.displayPhoneNumber };

  const parts = [
    `Meta shows this number as ${status.status ?? 'not activated'}`,
    status.codeVerificationStatus && `verification: ${status.codeVerificationStatus}`,
    status.nameStatus && `display name: ${status.nameStatus}`,
  ].filter(Boolean);
  let lastError = `${parts.join(' · ')}.`;
  if (registerError) {
    const text = registerError instanceof Error ? registerError.message : 'Registration failed';
    lastError += ` Registration failed: ${text}${code ? ` (code ${code})` : ''}.`;
    if (code && REGISTER_HINTS[code]) lastError += ` ${REGISTER_HINTS[code]}`;
  } else if (needsVerification) {
    lastError += ` ${REGISTER_HINTS[133006]}`;
  }
  return { connected, lastError: lastError.slice(0, 1000), needsVerification, displayPhoneNumber: status.displayPhoneNumber };
}

/**
 * Graph calls only (no database): registers the number (unless `register` is
 * false or Meta already shows it CONNECTED), makes sure our webhook is
 * subscribed, then reads Meta's real status. A failed registration doesn't
 * throw — its reason ends up in lastError.
 */
async function activateWhatsAppNumber(creds: WhatsAppCredentials, options: { register: boolean }): Promise<WhatsAppActivation> {
  const before = await fetchWhatsAppPhoneNumberStatus(creds.phoneNumberId, creds.accessToken);
  let registerError: unknown = null;
  if (options.register && before.status !== 'CONNECTED') {
    try {
      await registerWhatsAppPhoneNumber(creds.phoneNumberId, creds.accessToken, creds.registrationPin!);
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      registerError = err;
    }
  }
  await subscribeWabaWebhook(creds.wabaId, creds.accessToken);
  const after = options.register && before.status !== 'CONNECTED' ? await fetchWhatsAppPhoneNumberStatus(creds.phoneNumberId, creds.accessToken) : before;
  return describeNumberStatus(after, registerError);
}

/** The one database write after activation: CONNECTED or PENDING with the reason. */
async function saveWhatsAppActivation(organizationId: string, credentials: WhatsAppCredentials, activation: WhatsAppActivation) {
  const status = activation.connected ? 'CONNECTED' : 'PENDING';
  const data = {
    status,
    displayName: activation.displayPhoneNumber,
    externalId: credentials.wabaId,
    credentials: encryptJson(credentials),
    lastError: activation.lastError,
  } as const;
  const row = await withTenant(organizationId, async (tx) => {
    const current = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
      select: { connectedAt: true, status: true },
    });
    // connectedAt = when the number went live; kept across re-checks.
    const connectedAt = activation.connected ? (current?.status === 'CONNECTED' && current.connectedAt ? current.connectedAt : new Date()) : null;
    return tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
      create: { organizationId, channel: 'WHATSAPP', ...data, connectedAt },
      update: { ...data, connectedAt },
    });
  });
  forgetChannelCredentials(organizationId);
  return row;
}

/** The org's stored WhatsApp credentials, with a registration PIN (a new one if none was stored yet). */
async function whatsAppCredentialsForSync(organizationId: string): Promise<WhatsAppCredentials> {
  const creds = await storedWhatsAppCredentials(organizationId);
  if (!creds) throw new AppError(400, 'WHATSAPP_NOT_CONNECTED', 'Connect WhatsApp first');
  return { ...creds, registrationPin: creds.registrationPin ?? newRegistrationPin() };
}

async function syncWhatsApp(organizationId: string, creds: WhatsAppCredentials, register: boolean): Promise<WhatsAppSyncResult> {
  // A connection saved before this check existed may hold the wrong WABA (Embedded Signup can leave two).
  await assertPhoneBelongsToWaba(creds.wabaId, creds.phoneNumberId, creds.accessToken);
  const activation = await activateWhatsAppNumber(creds, { register });
  const row = await saveWhatsAppActivation(organizationId, creds, activation);
  return { status: row.status as ChannelStatus['status'], lastError: row.lastError, needsVerification: activation.needsVerification };
}

/** "Re-check status": Meta's real status; registers the number if it isn't live yet. */
export async function resyncWhatsApp(organizationId: string): Promise<WhatsAppSyncResult> {
  return syncWhatsApp(organizationId, await whatsAppCredentialsForSync(organizationId), true);
}

/** Sends the verification code to the number, then refreshes the status (no registration — it needs the code first). */
export async function requestWhatsAppCode(organizationId: string, method: 'SMS' | 'VOICE'): Promise<WhatsAppSyncResult> {
  const creds = await whatsAppCredentialsForSync(organizationId);
  await requestWhatsAppVerificationCode(creds.phoneNumberId, creds.accessToken, method);
  return syncWhatsApp(organizationId, creds, false);
}

/** Confirms the code, then registers the number and refreshes the status. */
export async function verifyWhatsAppNumberCode(organizationId: string, code: string): Promise<WhatsAppSyncResult> {
  const creds = await whatsAppCredentialsForSync(organizationId);
  await verifyWhatsAppCode(creds.phoneNumberId, creds.accessToken, code);
  return syncWhatsApp(organizationId, creds, true);
}

/** Persists the chosen Page's token + linked Instagram account as this org's Instagram connection. */
async function saveInstagramConnection(organizationId: string, option: InstagramPageOption): Promise<ChannelStatus> {
  const credentials: InstagramCredentials = {
    accessToken: option.pageAccessToken,
    igUserId: option.instagramBusinessAccountId,
  };
  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'INSTAGRAM' } },
      create: {
        organizationId,
        channel: 'INSTAGRAM',
        status: 'CONNECTED',
        displayName: `@${option.instagramUsername}`,
        externalId: option.instagramBusinessAccountId,
        secondaryExternalId: option.pageId,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: `@${option.instagramUsername}`,
        externalId: option.instagramBusinessAccountId,
        secondaryExternalId: option.pageId,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
    }),
  );
  await subscribePageWebhook(option.pageId, option.pageAccessToken);
  forgetChannelCredentials(organizationId);
  return toStatus(row);
}

/**
 * SUPERSEDED — kept for reference/rollback only, nothing calls this anymore.
 * Facebook Login flow: exchange the code for a user token, list the Facebook
 * Pages this user manages, and find which one(s) have an Instagram
 * professional account linked. Zero matches is a clear setup error; exactly
 * one connects immediately; more than one is handed back to the frontend as
 * a picker (see InstagramCallbackPage.tsx) rather than guessing.
 *
 * The Page access token this produces can RECEIVE Instagram DMs (its webhook
 * subscription still works) but cannot SEND them — confirmed via direct
 * Graph API Explorer testing, POST /{igUserId}/messages against
 * graph.facebook.com fails with "(#3) Application does not have the
 * capability to make this API call", 100% reproducibly, regardless of
 * granted permissions. Sending requires Instagram Login instead — see
 * connectInstagram below and the "Instagram Login" section in lib/meta.ts.
 */
export async function connectInstagramLegacy(organizationId: string, input: ConnectInstagramInput): Promise<ConnectInstagramResult> {
  try {
    const { accessToken: shortLived } = await exchangeFacebookUserCode(input.code, input.redirectUri);
    const { accessToken: userToken } = await exchangeLongLivedUserToken(shortLived);
    const pages = await fetchManagedFacebookPages(userToken);

    const options: InstagramPageOption[] = [];
    for (const page of pages) {
      const { instagramBusinessAccountId } = await fetchPageInstagramAccount(page.id, page.accessToken);
      if (!instagramBusinessAccountId) continue;
      const instagramUsername = await fetchInstagramUsername(instagramBusinessAccountId, page.accessToken);
      options.push({
        pageId: page.id,
        pageName: page.name,
        instagramBusinessAccountId,
        instagramUsername,
        pageAccessToken: page.accessToken,
      });
    }

    if (options.length === 0) {
      throw new AppError(
        422,
        'NO_INSTAGRAM_PAGE',
        'No Facebook Page with a linked Instagram professional account was found — link your Instagram account to a Facebook Page first.',
      );
    }
    if (options.length > 1) {
      return { status: 'needs_selection', options };
    }

    const channel = await saveInstagramConnection(organizationId, options[0]);
    return { status: 'connected', channel };
  } catch (err) {
    console.error(err);
    const message = err instanceof AppError ? err.message : 'Could not connect Instagram — please try again';
    await markFailed(organizationId, 'INSTAGRAM', message);
    throw new AppError(502, 'CHANNEL_CONNECT_FAILED', message);
  }
}

/** Persists an Instagram Login connection — the sending-capable counterpart to saveInstagramConnection above. No secondaryExternalId (no Facebook Page involved in this flow at all). */
async function saveInstagramLoginConnection(
  organizationId: string,
  data: { accessToken: string; igUserId: string; username: string; tokenExpiresAt: string },
): Promise<ChannelStatus> {
  const credentials: InstagramCredentials = {
    accessToken: data.accessToken,
    igUserId: data.igUserId,
    tokenExpiresAt: data.tokenExpiresAt,
  };
  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'INSTAGRAM' } },
      create: {
        organizationId,
        channel: 'INSTAGRAM',
        status: 'CONNECTED',
        displayName: `@${data.username}`,
        externalId: data.igUserId,
        secondaryExternalId: null,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: `@${data.username}`,
        externalId: data.igUserId,
        secondaryExternalId: null,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
    }),
  );
  forgetChannelCredentials(organizationId);
  return toStatus(row);
}

/**
 * Instagram Login (Business Login for Instagram) flow — the one actually
 * used now. A single redirect-based exchange (no Facebook Pages, no
 * ambiguous-picker case): the code exchange's `user_id` IS the Instagram
 * professional account id already, so there's no separate "find the linked
 * IG account" step the way the legacy Facebook Login flow needed. See the
 * "Instagram Login" section in lib/meta.ts for why this is required for
 * sending at all.
 */
export async function connectInstagram(organizationId: string, input: ConnectInstagramInput): Promise<ConnectInstagramResult> {
  try {
    const { accessToken: shortLived } = await exchangeInstagramCode(input.code, input.redirectUri);

    const { accessToken: longLived, expiresIn } = await exchangeInstagramLongLivedToken(shortLived);
    // NOTE: igUserId comes from THIS call (/me?fields=user_id,username), not
    // from exchangeInstagramCode above — that one's user_id is a different,
    // unusable app-scoped id. See the comment above fetchInstagramLoginProfile.
    const { igUserId, username } = await fetchInstagramLoginProfile(longLived);
    const channel = await saveInstagramLoginConnection(organizationId, {
      accessToken: longLived,
      igUserId,
      username,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    });
    // So this account's DMs reach the CRM. Best-effort: the connection itself already worked.
    await subscribeInstagramLoginWebhooks(longLived).catch((err) =>
      console.error('[channels] Instagram webhook subscription failed:', err instanceof Error ? err.message : err),
    );
    return { status: 'connected', channel };
  } catch (err) {
    console.error(err);
    const message = err instanceof AppError ? err.message : 'Could not connect Instagram — please try again';
    await markFailed(organizationId, 'INSTAGRAM', message);
    throw new AppError(502, 'CHANNEL_CONNECT_FAILED', message);
  }
}

/** Step 2 of the ambiguous case — the org picked one Page from connectInstagramLegacy's `options`. Dead in practice now (nothing produces a 'needs_selection' result via the new flow), kept for the same reference/rollback reason as connectInstagramLegacy. */
export async function selectInstagramPage(organizationId: string, input: SelectInstagramPageInput): Promise<ChannelStatus> {
  try {
    return await saveInstagramConnection(organizationId, input);
  } catch (err) {
    console.error(err);
    const message = err instanceof AppError ? err.message : 'Could not connect Instagram — please try again';
    await markFailed(organizationId, 'INSTAGRAM', message);
    throw new AppError(502, 'CHANNEL_CONNECT_FAILED', message);
  }
}

export async function connectEmail(organizationId: string, input: ConnectEmailInput): Promise<ChannelStatus> {
  const credentials: EmailCredentials = { apiKey: input.apiKey, fromAddress: input.fromAddress };
  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'EMAIL' } },
      create: {
        organizationId,
        channel: 'EMAIL',
        status: 'CONNECTED',
        displayName: input.fromAddress,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: input.fromAddress,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
    }),
  );
  forgetChannelCredentials(organizationId);
  return toStatus(row);
}

export async function disconnectChannel(
  organizationId: string,
  channel: (typeof ALL_CHANNELS)[number],
): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const existing = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel } },
    });
    if (!existing) return; // never connected — nothing to do, independent of other orgs
    await tx.channelConnection.update({
      where: { organizationId_channel: { organizationId, channel } },
      data: { status: 'NOT_CONNECTED', credentials: null, externalId: null, displayName: null, lastError: null, connectedAt: null },
    });
  });
  forgetChannelCredentials(organizationId);
}

/** Shared by the three Business Profile functions below — throws a clear error instead of a Meta 4xx if WhatsApp isn't connected yet. */
async function getConnectedWhatsAppCredentials(organizationId: string): Promise<WhatsAppCredentials> {
  return withTenant(organizationId, async (tx) => {
    const connection = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
    });
    if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) {
      throw new AppError(400, 'WHATSAPP_NOT_CONNECTED', 'Connect WhatsApp before managing its Business Profile');
    }
    return decryptJson<WhatsAppCredentials>(connection.credentials);
  });
}

export async function getWhatsAppBusinessProfile(organizationId: string): Promise<WhatsAppBusinessProfile> {
  const creds = await getConnectedWhatsAppCredentials(organizationId);
  return fetchWhatsAppBusinessProfile(creds.phoneNumberId, creds.accessToken);
}

export async function updateWhatsAppBusinessProfile(
  organizationId: string,
  input: UpdateWhatsAppBusinessProfileInput,
): Promise<WhatsAppBusinessProfile> {
  const creds = await getConnectedWhatsAppCredentials(organizationId);
  await pushWhatsAppBusinessProfile(creds.phoneNumberId, creds.accessToken, input);
  return fetchWhatsAppBusinessProfile(creds.phoneNumberId, creds.accessToken);
}

export async function uploadWhatsAppProfilePhoto(
  organizationId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<WhatsAppBusinessProfile> {
  const creds = await getConnectedWhatsAppCredentials(organizationId);
  const handle = await uploadWhatsAppProfilePhotoHandle(buffer, mimeType, creds.accessToken);
  await pushWhatsAppBusinessProfile(creds.phoneNumberId, creds.accessToken, { profilePictureHandle: handle });
  return fetchWhatsAppBusinessProfile(creds.phoneNumberId, creds.accessToken);
}

function toStatus(row: {
  channel: string;
  status: string;
  displayName: string | null;
  lastError: string | null;
  connectedAt: Date | null;
}): ChannelStatus {
  return {
    channel: row.channel as ChannelStatus['channel'],
    status: row.status as ChannelStatus['status'],
    displayName: row.displayName,
    lastError: row.lastError,
    connectedAt: row.connectedAt,
  };
}

/** Renew Instagram Login tokens this far ahead of expiry (they last ~60 days). */
const INSTAGRAM_REFRESH_AHEAD_MS = 20 * 24 * 3600 * 1000;

/**
 * Keeps every connected Instagram account's login alive: renews any Instagram
 * Login token due within 20 days (or with no recorded expiry). Runs on
 * startup and twice a day (index.ts). A token Meta won't renew any more marks
 * the channel so Settings asks the agency to reconnect.
 */
export async function refreshInstagramTokens(): Promise<void> {
  const rows = await systemPrisma.channelConnection.findMany({
    where: { channel: 'INSTAGRAM', status: 'CONNECTED', secondaryExternalId: null, credentials: { not: null } },
  });
  for (const row of rows) {
    try {
      const creds = decryptJson<InstagramCredentials>(row.credentials!);
      const expiresAt = creds.tokenExpiresAt ? new Date(creds.tokenExpiresAt).getTime() : 0;
      if (expiresAt - Date.now() > INSTAGRAM_REFRESH_AHEAD_MS) continue;
      const { accessToken, expiresIn } = await refreshInstagramLongLivedToken(creds.accessToken);
      const updated: InstagramCredentials = { ...creds, accessToken, tokenExpiresAt: new Date(Date.now() + expiresIn * 1000).toISOString() };
      await systemPrisma.channelConnection.update({ where: { id: row.id }, data: { credentials: encryptJson(updated), lastError: null } });
      forgetChannelCredentials(row.organizationId);
      console.log(`[channels] Instagram token renewed for org ${row.organizationId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[channels] Instagram token renewal failed for org ${row.organizationId}:`, message);
      if (/expired|invalid|session has been invalidated|error validating access token/i.test(message)) {
        await systemPrisma.channelConnection.update({
          where: { id: row.id },
          data: { lastError: 'Instagram login expired — please reconnect Instagram in Settings → Channels.' },
        });
      }
    }
  }
}
