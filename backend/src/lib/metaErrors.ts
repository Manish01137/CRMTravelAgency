/**
 * Meta's error replies, in words an agency can act on. Meta often answers with
 * a bare "(#131000) Something went wrong" — shown as-is it tells nobody what
 * to do. Every Graph call (lib/meta.ts) and every failed-delivery webhook goes
 * through here, so the same codes read the same everywhere in the CRM.
 *
 * Only well-known codes get our own text; anything else keeps Meta's own
 * message (minus the "(#123)" prefix), which is usually specific enough.
 * The Meta code is always added at the end for support.
 */

const TEMPORARY = "Meta (WhatsApp/Instagram) had a temporary problem and couldn't finish this — please try again in a minute.";
const RATE_LIMITED = 'Meta is limiting how fast this can be done right now — wait a minute and try again.';
const RECONNECT = 'Your Meta connection has expired or was removed — reconnect it in Settings → Channels.';

const FRIENDLY: Record<number, string> = {
  1: TEMPORARY,
  2: TEMPORARY,
  131000: TEMPORARY,
  131016: TEMPORARY,
  133004: TEMPORARY,
  4: RATE_LIMITED,
  17: RATE_LIMITED,
  613: RATE_LIMITED,
  80007: RATE_LIMITED,
  130429: RATE_LIMITED,
  131048: 'Meta is limiting messages from this number because recent ones were reported or blocked — slow down and check the number’s quality in WhatsApp Manager.',
  131056: 'Too many messages to this customer in a short time — wait a minute before sending again.',
  102: RECONNECT,
  190: RECONNECT,
  463: RECONNECT,
  467: RECONNECT,
  200: 'Meta permission missing for this — reconnect the channel in Settings → Channels and allow every permission.',
  131005: 'Meta denied access — reconnect the channel in Settings → Channels.',
  131008: 'Meta needs a value that was left empty — fill in the required fields and try again.',
  131009: "Meta didn't accept one of the values — check the fields and try again.",
  131021: "You can't send a message to your own business number.",
  131026: "This customer can't receive WhatsApp messages right now (number not on WhatsApp, or their app needs an update).",
  131031: 'Meta has locked this WhatsApp Business account — check WhatsApp Manager for details.',
  131047: "It's been more than 24 hours since the customer's last message — send an approved template instead.",
  131051: "WhatsApp doesn't support this kind of message.",
  131052: "Couldn't download the customer's file from WhatsApp — ask them to send it again.",
  131053: "WhatsApp couldn't use this file — check its type and size (photos: JPG/PNG up to 5 MB).",
  132000: "The template's variables don't match what was sent — check the template.",
  132001: "This template doesn't exist in that language, or isn't approved yet.",
  132005: 'The template text is too long once its variables are filled in.',
  132007: 'Meta rejected this template for its content policy — edit the template.',
  132012: 'A template variable has the wrong format.',
  132015: 'Meta paused this template because of low quality — edit it or use another one.',
  132016: 'Meta disabled this template — create a new one.',
  133006: 'This WhatsApp number must be verified with a code first — open Settings → Channels → WhatsApp.',
  133010: "This WhatsApp number isn't activated on Meta yet — open Settings → Channels → WhatsApp and press Re-check status.",
  368: 'Meta has temporarily blocked this account for a policy issue — check Meta Business Suite for details.',
};

/** Meta's catch-all wording — never useful to show as it is. */
const GENERIC = /^(something went wrong|an unknown error (has )?occurred|unknown error|an unexpected error has occurred|service temporarily unavailable)\.?$/i;

/** Codes worth one automatic retry (safe only for requests that can be repeated). */
export const TRANSIENT_META_CODES = new Set([1, 2, 131000, 131016, 133004]);

export function friendlyMetaError(code: number | undefined, metaMessage: string | undefined, userMessage?: string): string {
  const own = code !== undefined ? FRIENDLY[code] : undefined;
  const cleaned = (userMessage || metaMessage || '').replace(/^\(#\d+\)\s*/, '').trim();
  const text = own ?? (!cleaned || GENERIC.test(cleaned) ? TEMPORARY : cleaned);
  return code ? `${text} (Meta code ${code})` : text;
}
