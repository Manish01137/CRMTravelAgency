/**
 * Turns an incoming WhatsApp Cloud API message into the text the CRM stores
 * and shows in the Inbox.
 *
 * Anything that isn't something a person typed (voice notes, stickers,
 * reactions, messages WhatsApp won't share, ...) gets a label in [square
 * brackets]. Bots use isPlaceholderBody() to recognise those and ask the
 * traveller to type instead of taking the label as their answer.
 */

type Raw = Record<string, unknown>;

export interface DescribedMessage {
  text: string;
  /** WhatsApp media id to download and attach (images only). */
  imageId: string | null;
  interactiveSelectionId: string | null;
}

const placeholder = (label: string) => `[${label}]`;

export function isPlaceholderBody(body: string | null | undefined): boolean {
  return !!body && /^\[[^\n]*\]$/.test(body.trim());
}

/** An emoji reaction (or its removal) — not a reply to anything, so bots should let it pass silently. */
export function isReactionBody(body: string | null | undefined): boolean {
  return !!body && /^\[(Reacted |Removed a reaction\])/.test(body.trim());
}

/** What a bot sends back when the traveller's reply isn't something it can read. */
export const TYPE_YOUR_REPLY = "Sorry, I can only read typed messages here — could you type your reply?";

/**
 * Meta sends type "unsupported" when it won't pass a message to the API, with
 * unsupported.type naming what was really sent and an error code:
 * 131051 "Message type unknown", 131060 "This message is currently unavailable".
 */
function unsupportedLabel(msg: Raw): string {
  const original = String((msg.unsupported as { type?: string } | undefined)?.type ?? '');
  const code = (msg.errors as { code?: number }[] | undefined)?.[0]?.code;
  if (original === 'edit') return placeholder('Customer edited a message — WhatsApp doesn’t share edits with the CRM');
  if (original.startsWith('poll')) return placeholder('Customer sent a poll — WhatsApp doesn’t share polls with the CRM');
  if (code === 131060) return placeholder('WhatsApp didn’t share this message with the CRM — ask the customer to resend it');
  // "unknown" is Meta itself not recognising the message (e.g. a call, a view-once
  // photo, or a message from an unofficial WhatsApp app) — nothing more to show.
  const what = original && original !== 'unknown' ? ` (${original})` : '';
  return placeholder(`WhatsApp couldn’t pass this message to the CRM${what} — ask the customer to send it again as text`);
}

export function describeWhatsAppMessage(msg: Raw): DescribedMessage {
  const type = String(msg.type ?? 'text');
  const none = { imageId: null, interactiveSelectionId: null };
  switch (type) {
    case 'text':
      return { ...none, text: String((msg.text as { body?: string } | undefined)?.body ?? '') };
    case 'interactive': {
      // Tap on a list row (Bot Flow CAROUSEL) or reply button — its id is what bots match on.
      const i = (msg.interactive as { list_reply?: { id?: string; title?: string }; button_reply?: { id?: string; title?: string } }) ?? {};
      const reply = i.list_reply ?? i.button_reply;
      return { ...none, text: reply?.title ?? placeholder('Interactive reply'), interactiveSelectionId: reply?.id ?? null };
    }
    case 'button': // tap on a template's quick-reply button
      return { ...none, text: String((msg.button as { text?: string } | undefined)?.text ?? '') || placeholder('Button reply') };
    case 'image': {
      const image = msg.image as { id?: string; caption?: string } | undefined;
      return { ...none, text: image?.caption ?? '', imageId: image?.id ?? null };
    }
    case 'video': {
      const caption = (msg.video as { caption?: string } | undefined)?.caption;
      return { ...none, text: caption || placeholder('Video') };
    }
    case 'document': {
      const d = msg.document as { filename?: string; caption?: string } | undefined;
      return { ...none, text: d?.caption || placeholder(`Document${d?.filename ? `: ${d.filename}` : ''}`) };
    }
    case 'audio':
      return { ...none, text: placeholder((msg.audio as { voice?: boolean } | undefined)?.voice ? 'Voice message' : 'Audio file') };
    case 'sticker':
      return { ...none, text: placeholder('Sticker') };
    case 'reaction': {
      const emoji = (msg.reaction as { emoji?: string } | undefined)?.emoji;
      return { ...none, text: placeholder(emoji ? `Reacted ${emoji}` : 'Removed a reaction') };
    }
    case 'location': {
      const l = msg.location as { latitude?: number; longitude?: number; name?: string; address?: string } | undefined;
      const where = [l?.name, l?.address].filter(Boolean).join(', ');
      const map = l?.latitude != null && l?.longitude != null ? `https://maps.google.com/?q=${l.latitude},${l.longitude}` : '';
      return { ...none, text: placeholder(['Location', where, map].filter(Boolean).join(' — ')) };
    }
    case 'contacts': {
      const people = (msg.contacts as { name?: { formatted_name?: string }; phones?: { phone?: string }[] }[] | undefined) ?? [];
      const list = people.map((p) => [p.name?.formatted_name, p.phones?.map((x) => x.phone).filter(Boolean).join(', ')].filter(Boolean).join(' ')).join('; ');
      return { ...none, text: placeholder(`Shared contact${list ? `: ${list}` : ''}`) };
    }
    case 'unsupported':
      return { ...none, text: unsupportedLabel(msg) };
    default:
      return { ...none, text: placeholder(`${type} message — not shown in the CRM`) };
  }
}
