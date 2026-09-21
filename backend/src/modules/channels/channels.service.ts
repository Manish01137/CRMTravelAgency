import { withTenant } from '../../lib/prisma';
import { encryptJson, decryptJson } from '../../lib/encryption';
import { env } from '../../env';
import {
  isWhatsAppConfigured,
  exchangeWhatsAppCode,
  discoverWhatsAppWabaAndPhoneNumber,
  fetchWhatsAppPhoneNumber,
  subscribeWabaWebhook,
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
  diagnoseInstagramTokenExchange,
  isInstagramLoginConfigured,
} from '../../lib/meta';
import type { WhatsAppBusinessProfile, UpdateWhatsAppBusinessProfileInput } from '../../lib/meta';
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
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'FAILED';
  displayName: string | null;
  lastError: string | null;
  connectedAt: Date | null;
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
    return ALL_CHANNELS.map((channel) => {
      const row = rows.find((r) => r.channel === channel);
      return {
        channel,
        status: row?.status ?? 'NOT_CONNECTED',
        displayName: row?.displayName ?? null,
        lastError: row?.lastError ?? null,
        connectedAt: row?.connectedAt ?? null,
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
}

export async function connectWhatsApp(organizationId: string, input: ConnectWhatsAppInput): Promise<ChannelStatus> {
  try {
    const { accessToken } = await exchangeWhatsAppCode(input.code);

    let wabaId = input.wabaId;
    let phoneNumberId = input.phoneNumberId;
    if (!wabaId || !phoneNumberId) {
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

    const { displayPhoneNumber } = await fetchWhatsAppPhoneNumber(phoneNumberId, accessToken);
    await subscribeWabaWebhook(wabaId, accessToken);

    const credentials: WhatsAppCredentials = { accessToken, phoneNumberId, wabaId };
    const row = await withTenant(organizationId, (tx) =>
      tx.channelConnection.upsert({
        where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
        create: {
          organizationId,
          channel: 'WHATSAPP',
          status: 'CONNECTED',
          displayName: displayPhoneNumber,
          externalId: wabaId,
          credentials: encryptJson(credentials),
          connectedAt: new Date(),
          lastError: null,
        },
        update: {
          status: 'CONNECTED',
          displayName: displayPhoneNumber,
          externalId: wabaId,
          credentials: encryptJson(credentials),
          connectedAt: new Date(),
          lastError: null,
        },
      }),
    );
    return toStatus(row);
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
  data: { accessToken: string; igUserId: string; username: string },
): Promise<ChannelStatus> {
  const credentials: InstagramCredentials = {
    accessToken: data.accessToken,
    igUserId: data.igUserId,
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

    // TEMP DEBUG — see diagnoseInstagramTokenExchange's doc comment in
    // lib/meta.ts. Remove this line once the /access_token 400 is resolved.
    await diagnoseInstagramTokenExchange(shortLived);

    const { accessToken: longLived } = await exchangeInstagramLongLivedToken(shortLived);
    // NOTE: igUserId comes from THIS call (/me?fields=user_id,username), not
    // from exchangeInstagramCode above — that one's user_id is a different,
    // unusable app-scoped id. See the comment above fetchInstagramLoginProfile.
    const { igUserId, username } = await fetchInstagramLoginProfile(longLived);
    const channel = await saveInstagramLoginConnection(organizationId, { accessToken: longLived, igUserId, username });
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
