import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { sendEmail } from '../../lib/resend';
import { sendSms } from '../../lib/twilio';
import { BadRequest, NotFound } from '../../lib/errors';
import type { EmailCredentials, SmsCredentials } from '../channels/channels.service';
import type { SendEmailInput, SendSmsInput } from './communications.schemas';

export async function listLog(organizationId: string, leadId: string) {
  return withTenant(organizationId, async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw NotFound('Lead not found');
    return tx.communicationLog.findMany({ where: { organizationId, leadId }, orderBy: { createdAt: 'desc' } });
  });
}

export async function sendLeadEmail(organizationId: string, leadId: string, userId: string, input: SendEmailInput) {
  return withTenant(organizationId, async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw NotFound('Lead not found');
    const to = input.to ?? lead.email;
    if (!to) throw BadRequest('This lead has no email address — add one, or specify a "to" address');

    const connection = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'EMAIL' } },
    });
    if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) {
      throw BadRequest('Connect Email in Settings → Channels first');
    }
    const creds = decryptJson<EmailCredentials>(connection.credentials);

    try {
      const { providerMessageId } = await sendEmail(creds.apiKey, {
        from: creds.fromAddress,
        to,
        subject: input.subject,
        text: input.body,
      });
      return tx.communicationLog.create({
        data: {
          organizationId,
          leadId,
          channel: 'EMAIL',
          toAddress: to,
          subject: input.subject,
          body: input.body,
          status: 'SENT',
          providerMessageId,
          sentById: userId,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Send failed';
      await tx.communicationLog.create({
        data: {
          organizationId,
          leadId,
          channel: 'EMAIL',
          toAddress: to,
          subject: input.subject,
          body: input.body,
          status: 'FAILED',
          errorMessage,
          sentById: userId,
        },
      });
      throw err;
    }
  });
}

export async function sendLeadSms(organizationId: string, leadId: string, userId: string, input: SendSmsInput) {
  return withTenant(organizationId, async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw NotFound('Lead not found');
    const to = input.to ?? lead.phone;
    if (!to) throw BadRequest('This lead has no phone number — add one, or specify a "to" number');

    const connection = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'SMS' } },
    });
    if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) {
      throw BadRequest('Connect SMS in Settings → Channels first');
    }
    const creds = decryptJson<SmsCredentials>(connection.credentials);

    try {
      const { providerMessageId } = await sendSms(creds.accountSid, creds.authToken, { from: creds.senderId, to, body: input.body });
      return tx.communicationLog.create({
        data: { organizationId, leadId, channel: 'SMS', toAddress: to, body: input.body, status: 'SENT', providerMessageId, sentById: userId },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Send failed';
      await tx.communicationLog.create({
        data: { organizationId, leadId, channel: 'SMS', toAddress: to, body: input.body, status: 'FAILED', errorMessage, sentById: userId },
      });
      throw err;
    }
  });
}
