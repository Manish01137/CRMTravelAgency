import { AppError } from './errors';

/**
 * Resend email client. Each organization supplies its own API key (Settings →
 * Channels → Email) — there is no OAuth/Embedded-Signup equivalent for email
 * providers, so a plain API key field is correct here, not a security gap.
 */
export async function sendEmail(
  apiKey: string,
  input: { from: string; to: string; subject: string; text: string },
): Promise<{ providerMessageId: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: input.from, to: [input.to], subject: input.subject, text: input.text }),
  });
  const data = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
  if (!res.ok) {
    throw new AppError(502, 'EMAIL_SEND_FAILED', data?.message ?? `Resend request failed (${res.status})`);
  }
  return { providerMessageId: data?.id ?? '' };
}
