import { withTenant } from '../../lib/prisma';
import { encryptJson } from '../../lib/encryption';
import { env } from '../../env';
import {
  isMetaConfigured,
  isInstagramConfigured,
  exchangeWhatsAppCode,
  fetchWhatsAppPhoneNumber,
  subscribeWabaWebhook,
  exchangeFacebookUserCode,
  exchangeLongLivedUserToken,
  fetchManagedFacebookPages,
  fetchPageInstagramAccount,
  fetchInstagramUsername,
  subscribePageWebhook,
} from '../../lib/meta';
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
 * a Meta App ID, its Graph API version, and an Embedded-Signup Configuration
 * ID are meant to be used client-side per Meta's own docs. The App SECRET
 * never leaves the server (see lib/meta.ts). Instagram now reuses the same
 * App ID as WhatsApp (Facebook Login flow) — no separate Instagram app id.
 */
export async function getPlatformConfig() {
  return {
    whatsappEnabled: isMetaConfigured() && !!env.META_WHATSAPP_CONFIG_ID,
    instagramEnabled: isInstagramConfigured(),
    emailEnabled: true,
    metaAppId: env.META_APP_ID ?? null,
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
    const { displayPhoneNumber } = await fetchWhatsAppPhoneNumber(input.phoneNumberId, accessToken);
    await subscribeWabaWebhook(input.wabaId, accessToken);

    const credentials: WhatsAppCredentials = { accessToken, phoneNumberId: input.phoneNumberId, wabaId: input.wabaId };
    const row = await withTenant(organizationId, (tx) =>
      tx.channelConnection.upsert({
        where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
        create: {
          organizationId,
          channel: 'WHATSAPP',
          status: 'CONNECTED',
          displayName: displayPhoneNumber,
          externalId: input.wabaId,
          credentials: encryptJson(credentials),
          connectedAt: new Date(),
          lastError: null,
        },
        update: {
          status: 'CONNECTED',
          displayName: displayPhoneNumber,
          externalId: input.wabaId,
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
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: `@${option.instagramUsername}`,
        externalId: option.instagramBusinessAccountId,
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
 * Facebook Login flow: exchange the code for a user token, list the Facebook
 * Pages this user manages, and find which one(s) have an Instagram
 * professional account linked. Zero matches is a clear setup error; exactly
 * one connects immediately; more than one is handed back to the frontend as
 * a picker (see InstagramCallbackPage.tsx) rather than guessing.
 */
export async function connectInstagram(organizationId: string, input: ConnectInstagramInput): Promise<ConnectInstagramResult> {
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

/** Step 2 of the ambiguous case — the org picked one Page from connectInstagram's `options`. */
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
