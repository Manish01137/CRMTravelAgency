import { withTenant } from '../../lib/prisma';
import { encryptJson } from '../../lib/encryption';
import { env } from '../../env';
import {
  isMetaConfigured,
  isInstagramConfigured,
  exchangeWhatsAppCode,
  fetchWhatsAppPhoneNumber,
  subscribeWabaWebhook,
  exchangeInstagramCode,
  exchangeLongLivedInstagramToken,
  fetchInstagramProfile,
} from '../../lib/meta';
import { AppError } from '../../lib/errors';
import type {
  ConnectEmailInput,
  ConnectInstagramInput,
  ConnectSmsInput,
  ConnectWhatsAppInput,
} from './channels.schemas';

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
}
export interface InstagramCredentials {
  accessToken: string;
  igUserId: string;
}
export interface EmailCredentials {
  apiKey: string;
  fromAddress: string;
}
export interface SmsCredentials {
  accountSid: string;
  authToken: string;
  senderId: string;
}

/** Public-safe shape — credentials are NEVER included. */
export interface ChannelStatus {
  channel: 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'SMS';
  status: 'NOT_CONNECTED' | 'CONNECTED' | 'FAILED';
  displayName: string | null;
  lastError: string | null;
  connectedAt: Date | null;
}

const ALL_CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'EMAIL', 'SMS'] as const;

/**
 * Public (non-secret) values the frontend needs to launch each OAuth flow —
 * a Meta App ID and an Embedded-Signup Configuration ID are meant to be used
 * client-side per Meta's own Embedded Signup docs. The App SECRET never
 * leaves the server (see lib/meta.ts).
 */
export async function getPlatformConfig() {
  return {
    whatsappEnabled: isMetaConfigured() && !!env.META_WHATSAPP_CONFIG_ID,
    instagramEnabled: isInstagramConfigured(),
    emailEnabled: true,
    smsEnabled: true,
    metaAppId: env.META_APP_ID ?? null,
    whatsappConfigId: env.META_WHATSAPP_CONFIG_ID ?? null,
    instagramAppId: env.META_INSTAGRAM_APP_ID ?? env.META_APP_ID ?? null,
  };
}

/** Lists all four channels' status for the org, synthesizing NOT_CONNECTED for any never touched. */
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
    const message = err instanceof AppError ? err.message : 'Could not connect WhatsApp — please try again';
    await markFailed(organizationId, 'WHATSAPP', message);
    throw new AppError(502, 'CHANNEL_CONNECT_FAILED', message);
  }
}

export async function connectInstagram(organizationId: string, input: ConnectInstagramInput): Promise<ChannelStatus> {
  try {
    const { accessToken: shortLived } = await exchangeInstagramCode(input.code, input.redirectUri);
    const { accessToken } = await exchangeLongLivedInstagramToken(shortLived);
    const { userId, username } = await fetchInstagramProfile(accessToken);

    const credentials: InstagramCredentials = { accessToken, igUserId: userId };
    const row = await withTenant(organizationId, (tx) =>
      tx.channelConnection.upsert({
        where: { organizationId_channel: { organizationId, channel: 'INSTAGRAM' } },
        create: {
          organizationId,
          channel: 'INSTAGRAM',
          status: 'CONNECTED',
          displayName: `@${username}`,
          externalId: userId,
          credentials: encryptJson(credentials),
          connectedAt: new Date(),
          lastError: null,
        },
        update: {
          status: 'CONNECTED',
          displayName: `@${username}`,
          externalId: userId,
          credentials: encryptJson(credentials),
          connectedAt: new Date(),
          lastError: null,
        },
      }),
    );
    return toStatus(row);
  } catch (err) {
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

export async function connectSms(organizationId: string, input: ConnectSmsInput): Promise<ChannelStatus> {
  const credentials: SmsCredentials = { accountSid: input.accountSid, authToken: input.authToken, senderId: input.senderId };
  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'SMS' } },
      create: {
        organizationId,
        channel: 'SMS',
        status: 'CONNECTED',
        displayName: input.senderId,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: input.senderId,
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
