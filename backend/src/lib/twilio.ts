import { AppError } from './errors';

/**
 * Twilio SMS client. Each organization supplies its own Account SID + Auth
 * Token + sender ID (Settings → Channels → SMS) — a plain API key field is
 * correct here (no OAuth equivalent for SMS providers), not a security gap.
 */
export async function sendSms(
  accountSid: string,
  authToken: string,
  input: { from: string; to: string; body: string },
): Promise<{ providerMessageId: string }> {
  const form = new URLSearchParams({ To: input.to, From: input.from, Body: input.body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
  if (!res.ok) {
    throw new AppError(502, 'SMS_SEND_FAILED', data?.message ?? `Twilio request failed (${res.status})`);
  }
  return { providerMessageId: data?.sid ?? '' };
}
