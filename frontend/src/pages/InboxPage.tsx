import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Check,
  ChevronDown,
  UserPlus,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  ArrowLeft,
  Smile,
  MoreVertical,
  Plus,
  Inbox as InboxIcon,
  Instagram,
  MessageCircle,
  MailOpen,
  Pause,
  Phone,
  RotateCcw,
  Bot,
  Search,
  Send,
  Sparkles,
  Star,
  X,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  MapPin,
  UserRound,
  Pin,
  Forward,
  Copy,
  Trash2,
  CalendarClock,
  Video as VideoIcon,
  Mic,
  Users,
  Sticker as StickerIcon,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  ChannelMessage,
  Conversation,
  ConversationChannel,
  ScheduledMessage,
  ConversationFilter,
  ConversationStage,
  ConversationStageCounts,
  LeadStatus,
  MessageTemplate,
  User,
  ChatBotState,
  ChannelStatus,
  QuickReply,
  MessageInfo,
} from '@/types';
import { LEAD_STATUSES, LEAD_STATUS_STYLES } from '@/lib/leadMeta';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { initials } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';
import { toWhatsAppImage } from '@/lib/whatsappImage';
import { POLL, livePolling } from '@/lib/livePolling';
import { copyToClipboard } from '@/lib/share';
import { EmojiPicker } from '@/components/inbox/EmojiPicker';
import { MessageMenu, ReactionBadges } from '@/components/inbox/MessageMenu';
import { ContactCard, LocationCard, contactBody, locationBody, parseContacts, parseLocation, richCopyText, richSummary, type SharedLocation } from '@/components/inbox/RichCards';
import { ForwardDialog } from '@/components/inbox/ForwardDialog';
import { ContactDialog, LocationDialog } from '@/components/inbox/ShareDialogs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { VoiceNote, isAudioUrl, isMediaLabel, isStickerMessage } from '@/components/inbox/MediaPlayers';
import { ContactInfoPanel } from '@/components/inbox/ContactInfoPanel';
import { VoiceRecorderBar, canRecordVoice } from '@/components/inbox/VoiceRecorder';
import { GroupsDialog } from '@/components/inbox/GroupsDialog';
import { StickerPicker } from '@/components/inbox/StickerPicker';
import { ScheduleDialog, ScheduledListDialog, ScheduledStrip } from '@/components/inbox/ScheduleDialogs';
import { AddPaymentMethodLink, WhatsAppBillingBanner, isWhatsAppPaymentError } from '@/components/channels/WhatsAppBilling';
import {
  ManageQuickRepliesDialog,
  QuickReplyBar,
  QuickReplySuggestions,
  fillQuickReply,
  insertQuickReply,
  matchQuickReplies,
  slashQuery,
  useQuickReplies,
} from '@/components/inbox/QuickReplies';

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

/** WhatsApp's chat wallpaper: warm beige with a faint doodle. */
const WA_WALLPAPER_STYLE: React.CSSProperties = {
  backgroundColor: '#efeae2',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cg fill='none' stroke='%23000000' stroke-opacity='0.045' stroke-width='1.4' stroke-linecap='round'%3E%3Ccircle cx='22' cy='26' r='4'/%3E%3Cpath d='M112 118q12-20 24 0q-12 20-24 0'/%3E%3Cpath d='M40 104q9-15 18 0q-9 15-18 0'/%3E%3Ccircle cx='128' cy='34' r='3'/%3E%3Cpath d='M80 12v16M72 20h16'/%3E%3Cpath d='M18 146l10-10 10 10'/%3E%3Crect x='92' y='64' width='14' height='10' rx='2'/%3E%3Cpath d='M58 52c6-6 14-6 20 0'/%3E%3C/g%3E%3C/svg%3E\")",
  backgroundSize: '160px 160px',
};

/** No separate "media kind" column — a file is recognised by the extension on its mediaUrl. */
const documentExtension = (url: string) => url.match(/\.(pdf|docx?|xlsx?|pptx?|txt|csv)(?:[?#]|$)/i)?.[1].toLowerCase() ?? null;
const isDocumentUrl = (url: string) => documentExtension(url) !== null;
const DOCUMENT_BADGE: Record<string, { label: string; color: string }> = {
  pdf: { label: 'PDF', color: 'bg-[#ff5c5c]' },
  doc: { label: 'DOC', color: 'bg-[#2b6cdb]' },
  docx: { label: 'DOC', color: 'bg-[#2b6cdb]' },
  xls: { label: 'XLS', color: 'bg-[#1f9d55]' },
  xlsx: { label: 'XLS', color: 'bg-[#1f9d55]' },
  ppt: { label: 'PPT', color: 'bg-[#e8710a]' },
  pptx: { label: 'PPT', color: 'bg-[#e8710a]' },
  txt: { label: 'TXT', color: 'bg-[#667781]' },
  csv: { label: 'CSV', color: 'bg-[#1f9d55]' },
};
const isVideoUrl = (url: string) => /\.(mp4|mov|webm|3gp)(?:[?#]|$)/i.test(url);

/** Recovers the human filename embedded in a document upload's storage key
 *  (see backend storage.ts) — works for both a just-sent and a re-fetched
 *  historical message, since it's derived purely from mediaUrl. */
function documentNameFromUrl(url: string): string {
  const last = url.split('/').pop() ?? 'document.pdf';
  const withoutQuery = last.split(/[?#]/)[0];
  const name = decodeURIComponent(withoutQuery.replace(/^\d+-[0-9a-f]+-?/, ''));
  return name && !name.startsWith('.') ? name : `document${name || '.pdf'}`;
}

/**
 * The template as the customer will read it: the first {{...}} placeholder —
 * braces included — becomes the contact's name, the same value the server
 * sends ("there" when there's no name). Mirrors templateBodyVariables in
 * backend/src/lib/meta.ts: numbered placeholders go by number, named ones by
 * first appearance.
 */
function fillTemplatePreview(bodyText: string, contactName: string | null | undefined): string {
  const keys = [...new Set(Array.from(bodyText.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g), (m) => m[1]))];
  if (keys.length === 0) return bodyText;
  const first = keys.every((k) => /^\d+$/.test(k)) ? [...keys].sort((a, b) => Number(a) - Number(b))[0] : keys[0];
  const name = contactName?.trim() || 'there';
  return bodyText.replace(new RegExp(`\\{\\{\\s*${first}\\s*\\}\\}`, 'g'), name);
}

// --- The open chat's messages ---------------------------------------------------

type Thread = { conversation: Conversation; messages: ChannelMessage[]; /** Pinned to the top (newest pin first). */ pinned?: ChannelMessage[] };
/** A poll's answer: messages since the newest one on screen, and the latest ticks of recent sent ones. */
type ThreadUpdate = Thread & {
  statuses?: {
    id: string;
    status: ChannelMessage['status'];
    errorMessage: string | null;
    externalMessageId: string | null;
    customerReaction: string | null;
    agentReaction: string | null;
    /** Set when a teammate deleted it (hidden in the CRM). */
    deletedAt?: string | null;
  }[];
};

/** The bubble shown while a message is going out (replaced by the server's copy). */
const SENDING_PREFIX = 'sending-';
const isSending = (m: ChannelMessage) => m.id.startsWith(SENDING_PREFIX);

/** Adds a poll's new messages to the ones on screen and updates ticks — nothing is reloaded. */
function mergeThread(have: Thread, update: ThreadUpdate): Thread {
  const statusById = new Map((update.statuses ?? []).map((s) => [s.id, s]));
  const incomingById = new Map(update.messages.map((m) => [m.id, m]));
  const messages = have.messages.filter((m) => !statusById.get(m.id)?.deletedAt).map((m) => {
    const fresh = incomingById.get(m.id);
    if (fresh) return fresh;
    const s = statusById.get(m.id);
    return s &&
      (s.status !== m.status ||
        s.errorMessage !== m.errorMessage ||
        s.externalMessageId !== m.externalMessageId ||
        s.customerReaction !== (m.customerReaction ?? null) ||
        s.agentReaction !== (m.agentReaction ?? null))
      ? {
          ...m,
          status: s.status,
          errorMessage: s.errorMessage,
          externalMessageId: s.externalMessageId,
          customerReaction: s.customerReaction,
          agentReaction: s.agentReaction,
        }
      : m;
  });
  const shown = new Set(messages.map((m) => m.id));
  for (const m of update.messages) {
    if (shown.has(m.id)) continue;
    // The server's copy of a message still showing as "sending…" takes its place.
    const sendingIdx = messages.findIndex(
      (t) => isSending(t) && m.direction === 'OUTBOUND' && (t.mediaUrl ?? null) === (m.mediaUrl ?? null) && (t.templateName ?? null) === (m.templateName ?? null) && (t.templateName || (t.body ?? null) === (m.body ?? null)),
    );
    if (sendingIdx >= 0) messages.splice(sendingIdx, 1);
    messages.push(m);
  }
  messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return { conversation: update.conversation, messages, pinned: update.pinned ?? have.pinned };
}

// --- Look & feel ----------------------------------------------------------------
// Each channel wears its own app's skin: the WhatsApp tab looks like WhatsApp
// Web, the Instagram tab like Instagram's DMs.

/** Today → "6:33 pm"; yesterday → "Yesterday"; this week → "Monday"; older → "12/10/26". */
function listTime(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days <= 0) return clockTime(iso);
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/** Instagram's short "ago": "now", "5m", "3h", "2d", "4w". */
function agoShort(iso: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d`;
  return `${Math.floor(mins / (60 * 24 * 7))}w`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayKey = (iso: string) => startOfDay(new Date(iso)).getTime();

/** "Today", "Yesterday", "Monday", or "12 October 2026" — WhatsApp's date pills. */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((startOfDay(new Date()).getTime() - startOfDay(d).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** WhatsApp's ticks: clock → ✓ → ✓✓ → blue ✓✓ (read), or a red mark when it failed. */
function WaTicks({ status }: { status: ChannelMessage['status'] }) {
  switch (status) {
    case 'QUEUED':
      return <Clock className="size-3 text-[#667781]" />;
    case 'SENT':
      return <Check className="size-4 text-[#667781]" strokeWidth={2.2} />;
    case 'DELIVERED':
      return <CheckCheck className="size-4 text-[#667781]" strokeWidth={2.2} />;
    case 'READ':
      return <CheckCheck className="size-4 text-[#53bdeb]" strokeWidth={2.2} />;
    case 'FAILED':
      return <AlertCircle className="size-3.5 text-[#ea0038]" />;
  }
}

function StagePill({ status, className }: { status: LeadStatus; className?: string }) {
  const style = LEAD_STATUS_STYLES[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-medium ring-1 ring-inset', style.pill, className)}>
      <span className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

type InboxView = 'normal' | 'full' | 'compact';
const INBOX_VIEW_KEY = 'inbox_view';

const VIEW_OPTIONS: { key: InboxView; label: string; icon: typeof Maximize2 }[] = [
  { key: 'compact', label: 'Compact chat list', icon: PanelLeftClose },
  { key: 'normal', label: 'Normal view', icon: Minimize2 },
  { key: 'full', label: 'Full screen', icon: Maximize2 },
];

function ContactAvatar({ c, className, fallbackClassName }: { c: Pick<Conversation, 'contactAvatarUrl' | 'contactName' | 'contactPhone' | 'externalContactId'>; className?: string; fallbackClassName?: string }) {
  const label = c.contactName || c.contactPhone || c.externalContactId;
  return (
    <Avatar className={className}>
      {c.contactAvatarUrl && <AvatarImage src={c.contactAvatarUrl} alt="" className="object-cover" />}
      <AvatarFallback className={fallbackClassName}>{initials(label)}</AvatarFallback>
    </Avatar>
  );
}

function ConversationRow({
  c,
  channel,
  active,
  onClick,
  onToggleFavorite,
  compact,
}: {
  c: Conversation;
  channel: ConversationChannel;
  active: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
  compact?: boolean;
}) {
  const label = c.contactName || c.contactPhone || c.externalContactId;
  const unread = c.unreadCount > 0;
  const wa = channel === 'WHATSAPP';

  if (compact) {
    // Compact list: just the picture, with the unread count on it.
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${label}${c.lastMessagePreview ? ` — ${c.lastMessagePreview}` : ''}`}
        aria-label={label}
        className={cn('relative flex w-full justify-center py-2.5 transition-colors', active ? (wa ? 'bg-[#f0f2f5]' : 'bg-[#efefef]') : 'hover:bg-black/[0.03]')}
      >
        <ContactAvatar c={c} className="size-11" fallbackClassName={wa ? 'bg-[#dfe5e7] text-[#54656f]' : 'bg-[#efefef] text-[#262626]'} />
        {unread && (
          <span className={cn('absolute right-2 top-1.5 flex min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white', wa ? 'bg-[#25d366]' : 'bg-[#0095f6]')}>
            {c.unreadCount > 9 ? '9+' : c.unreadCount}
          </span>
        )}
      </button>
    );
  }

  const favorite = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite();
      }}
      aria-label={c.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      title={c.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      className={cn('absolute bottom-3 right-3 rounded-full p-1 transition-opacity', c.isFavorite ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100')}
    >
      <Star className={cn('size-3.5', c.isFavorite ? 'fill-amber-400 text-amber-400' : wa ? 'text-[#8696a0]' : 'text-[#737373]')} />
    </button>
  );

  const badges = (
    <>
      {c.lead && <StagePill status={c.lead.status} className="shrink-0" />}
      {c.lead?.assignedTo && (
        <span
          title={`Assigned to ${c.lead.assignedTo.name}`}
          className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-700"
        >
          {initials(c.lead.assignedTo.name)}
        </span>
      )}
    </>
  );

  if (wa) {
    // WhatsApp Web's chat row.
    return (
      <div className="group relative">
        <button
          type="button"
          onClick={onClick}
          className={cn('flex w-full items-center gap-3 pl-3 text-left transition-colors', active ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]')}
        >
          <ContactAvatar c={c} className="size-[49px]" fallbackClassName="bg-[#dfe5e7] text-sm text-[#54656f]" />
          <div className="flex min-w-0 flex-1 flex-col justify-center border-b border-[#e9edef] py-3 pr-3 group-last:border-b-transparent">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[16px] leading-[21px] text-[#111b21]">{label}</p>
              {c.lastMessageAt && (
                <span className={cn('shrink-0 text-xs', unread ? 'font-medium text-[#1fa855]' : 'text-[#667781]')}>{listTime(c.lastMessageAt)}</span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 pr-5">
              <p className={cn('min-w-0 flex-1 truncate text-[14px] leading-5', unread ? 'text-[#111b21]' : 'text-[#667781]')}>
                {c.lastMessagePreview || 'No messages yet'}
              </p>
              {badges}
              {unread && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-white">
                  {c.unreadCount > 99 ? '99+' : c.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
        {favorite}
      </div>
    );
  }

  // Instagram's DM row: big round photo (story ring when unread), bold when unread, blue dot.
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={cn('flex w-full items-center gap-3 px-4 py-2 text-left transition-colors sm:px-5', active ? 'bg-[#efefef]' : 'hover:bg-[#fafafa]')}
      >
        <span className={cn('shrink-0 rounded-full p-[2px]', unread ? 'bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5]' : 'bg-transparent')}>
          <span className="block rounded-full bg-white p-[2px]">
            <ContactAvatar c={c} className="size-[50px]" fallbackClassName="bg-[#efefef] text-sm text-[#262626]" />
          </span>
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <p className={cn('truncate text-sm text-[#000]', unread && 'font-semibold')}>{label}</p>
          <div className="flex items-center gap-1 text-xs">
            <p className={cn('min-w-0 truncate', unread ? 'font-semibold text-[#000]' : 'text-[#737373]')}>{c.lastMessagePreview || 'No messages yet'}</p>
            {c.lastMessageAt && <span className="shrink-0 text-[#737373]">· {agoShort(c.lastMessageAt)}</span>}
          </div>
          {c.lead && <div className="mt-1 flex items-center gap-1">{badges}</div>}
        </div>
        {unread && <span className="absolute right-4 top-1/2 size-2 -translate-y-1/2 rounded-full bg-[#0095f6]" />}
      </button>
      {!unread && favorite}
    </div>
  );
}

/** WhatsApp's little bubble tail (top corner of the first bubble in a run). */
function BubbleTail({ outbound }: { outbound: boolean }) {
  return outbound ? (
    <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -right-2 top-0 text-[#d9fdd3]" aria-hidden>
      <path fill="currentColor" d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
    </svg>
  ) : (
    <svg viewBox="0 0 8 13" width="8" height="13" className="absolute -left-2 top-0 text-white" aria-hidden>
      <path fill="currentColor" d="M2.812 1H8v11.193L1.533 3.568C.474 2.156 1.042 1 2.812 1z" />
    </svg>
  );
}

/** A photo / video / file inside a bubble. */
function MessageMedia({ m, rounded, tone = 'wa-in' }: { m: ChannelMessage; rounded: string; tone?: 'wa-out' | 'wa-in' | 'ig-out' | 'ig-in' }) {
  if (!m.mediaUrl) return null;
  if (isAudioUrl(m.mediaUrl)) return <VoiceNote src={m.mediaUrl} tone={tone} voice={m.body?.trim() !== '[Audio file]'} />;
  const ext = documentExtension(m.mediaUrl);
  if (ext) {
    const badge = DOCUMENT_BADGE[ext];
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noreferrer"
        title="Open this file"
        className={cn('mb-1 flex min-w-[200px] items-center gap-2.5 bg-black/[0.06] p-2.5 transition-colors hover:bg-black/[0.1]', rounded)}
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white', badge.color)}>{badge.label}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{documentNameFromUrl(m.mediaUrl)}</span>
      </a>
    );
  }
  if (isVideoUrl(m.mediaUrl)) {
    return <video src={m.mediaUrl} controls playsInline preload="metadata" className={cn('mb-1 block max-h-80 w-full min-w-[220px] bg-black', rounded)} />;
  }
  return (
    <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="mb-1 block">
      <img src={m.mediaUrl} alt="" className={cn('max-h-80 w-full object-cover', rounded)} />
    </a>
  );
}

function FailedNote({ m, className }: { m: ChannelMessage; className?: string }) {
  if (m.status !== 'FAILED' || !m.errorMessage) return null;
  return (
    <div className={cn('mt-1 max-w-[85%] text-[11.5px] leading-4 text-[#ea0038] sm:max-w-[65%]', className)}>
      <p>{m.errorMessage}</p>
      {isWhatsAppPaymentError(m.errorMessage) && <AddPaymentMethodLink className="text-[#ea0038]" />}
    </div>
  );
}

/** A file a customer sent is stored with a "[Document: x.pdf]" label — the card already says that. */
const shownBody = (m: ChannelMessage) =>
  m.mediaUrl && ((isDocumentUrl(m.mediaUrl) && /^\[Document(: [^\n]*)?\]$/.test(m.body ?? '')) || isMediaLabel(m.body)) ? null : m.body;

/** One line describing a quoted message. */
function quotedText(q: NonNullable<ChannelMessage['replyTo']>): string {
  const body = q.body?.trim();
  const rich = richSummary(body);
  if (rich) return rich;
  if (q.mediaUrl && isDocumentUrl(q.mediaUrl)) return `📄 ${documentNameFromUrl(q.mediaUrl)}`;
  if (q.mediaUrl && isAudioUrl(q.mediaUrl)) return '🎤 Voice message';
  if (q.mediaUrl && body === '[Sticker]') return '🙂 Sticker';
  if (q.mediaUrl && body === '[Video]') return '🎥 Video';
  if (body) return body;
  if (q.mediaUrl) return isVideoUrl(q.mediaUrl) ? '🎥 Video' : '📷 Photo';
  return q.templateName ? `Template · ${q.templateName}` : 'Message';
}

/** The quoted message: inside a reply's bubble, and above the message box while replying. */
function QuotedMessage({ quote, contactName, onClick, className }: { quote: NonNullable<ChannelMessage['replyTo']>; contactName: string; onClick?: () => void; className?: string }) {
  const out = quote.direction === 'OUTBOUND';
  const inner = (
    <>
      <span className={cn('block truncate text-[12.5px] font-medium', out ? 'text-[#06a77d]' : 'text-[#027eb5]')}>{out ? 'You' : contactName}</span>
      <span className="line-clamp-2 whitespace-pre-line break-words text-[12.5px] leading-[16px] text-[#54656f]">{quotedText(quote)}</span>
    </>
  );
  const classes = cn('block w-full min-w-0 rounded-[5px] border-l-4 bg-black/[0.05] px-2 py-1 text-left', out ? 'border-[#06cf9c]' : 'border-[#53bdeb]', className);
  return onClick ? (
    <button type="button" onClick={onClick} title="Go to this message" className={cn(classes, 'transition-colors hover:bg-black/[0.09]')}>
      {inner}
    </button>
  ) : (
    <div className={classes}>{inner}</div>
  );
}

/** "7 Nov, 6:52 pm" (with the year when it isn't this year). */
function fullTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Message info: sent / delivered / read times (or the failure), and who sent it. */
function MessageInfoRows({ info, wa }: { info: MessageInfo; wa: boolean }) {
  if (info.direction === 'INBOUND') {
    return (
      <dl className="space-y-3 text-sm">
        <InfoRow icon={<Check className="size-4" />} label="Received" value={fullTime(info.createdAt)} />
        {info.starredAt && <InfoRow icon={<Star className="size-4 fill-amber-400 text-amber-400" />} label="Starred" value={fullTime(info.starredAt)} />}
      </dl>
    );
  }
  // Older messages were delivered / read before these times were recorded.
  const reached = (s: MessageInfo['status'][]) => s.includes(info.status);
  return (
    <dl className="space-y-3 text-sm">
      <InfoRow icon={<Check className="size-4 text-[#667781]" />} label="Sent" value={fullTime(info.createdAt)} />
      {info.status === 'FAILED' ? (
        <InfoRow icon={<AlertCircle className="size-4 text-[#ea0038]" />} label="Failed" value={info.errorMessage ?? 'Not delivered'} />
      ) : (
        <>
          <InfoRow
            icon={<CheckCheck className="size-4 text-[#667781]" />}
            label="Delivered"
            value={info.deliveredAt ? fullTime(info.deliveredAt) : reached(['DELIVERED', 'READ']) ? 'Yes (time not recorded)' : '—'}
          />
          <InfoRow
            icon={<CheckCheck className="size-4 text-[#53bdeb]" />}
            label={wa ? 'Read' : 'Seen'}
            value={info.readAt ? fullTime(info.readAt) : info.status === 'READ' ? 'Yes (time not recorded)' : '—'}
          />
        </>
      )}
      <InfoRow icon={<UserPlus className="size-4 text-[#667781]" />} label="Sent by" value={info.sentBy?.name ?? 'Bot / automation'} />
      {info.templateName && <InfoRow icon={<FileText className="size-4 text-[#667781]" />} label="Template" value={info.templateName} />}
      {info.starredAt && <InfoRow icon={<Star className="size-4 fill-amber-400 text-amber-400" />} label="Starred" value={fullTime(info.starredAt)} />}
    </dl>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <dt className="w-20 shrink-0 font-medium text-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-muted-foreground">{value}</dd>
    </div>
  );
}

/** One WhatsApp message: green (sent) or white (received), tail on the first of a run, time + ticks inside. */
function WaBubble({
  m,
  first,
  contactName,
  menu,
  onJump,
  highlighted,
}: {
  m: ChannelMessage;
  first: boolean;
  contactName: string;
  /** The ⌄ options menu (reply, react, copy, star, info). */
  menu?: React.ReactNode;
  onJump: (id: string) => void;
  highlighted: boolean;
}) {
  const out = m.direction === 'OUTBOUND';
  const body = shownBody(m);
  const location = parseLocation(body);
  const people = location ? null : parseContacts(body);
  const reacted = !!(m.customerReaction || m.agentReaction);
  const sticker = isStickerMessage(m);
  // A photo / video fills the bubble edge to edge; voice notes and files keep the normal padding.
  const visual = !!m.mediaUrl && !isDocumentUrl(m.mediaUrl) && !isAudioUrl(m.mediaUrl) && !sticker;
  const meta = (
    <span className="float-right ml-2.5 mt-[3px] flex translate-y-[5px] items-center gap-[3px] text-[11px] leading-none text-[#667781]">
      {m.pinnedAt && <Pin className="size-3 text-[#8696a0]" aria-label="Pinned" />}
      {m.starredAt && <Star className="size-3 fill-[#8696a0] text-[#8696a0]" aria-label="Starred" />}
      {clockTime(m.createdAt)}
      {out && <WaTicks status={m.status} />}
    </span>
  );
  return (
    <div id={`msg-${m.id}`} className={cn('flex flex-col', out ? 'items-end' : 'items-start', first ? 'mt-3' : 'mt-[2px]', reacted && 'mb-[18px]')}>
      <div className={cn('group flex w-full items-center gap-1', out ? 'flex-row-reverse' : 'flex-row')}>
        <div
          className={cn(
            'relative max-w-[85%] rounded-[7.5px] px-[9px] pb-2 pt-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] transition-[box-shadow] duration-300 sm:max-w-[65%]',
            sticker ? 'bg-transparent p-0 shadow-none' : out ? 'bg-[#d9fdd3]' : 'bg-white',
            first && !sticker && (out ? 'rounded-tr-none' : 'rounded-tl-none'),
            visual && 'p-[3px] pb-1.5',
            highlighted && 'ring-2 ring-[#00a884]/60',
          )}
        >
          {first && !sticker && <BubbleTail outbound={out} />}
          {m.replyTo && <QuotedMessage quote={m.replyTo} contactName={contactName} onClick={() => onJump(m.replyTo!.id)} className="mb-1 min-w-[150px]" />}
          {m.templateName && <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#008069]">Template · {m.templateName}</p>}
          {sticker ? (
            <a href={m.mediaUrl!} target="_blank" rel="noreferrer" className="block">
              <img src={m.mediaUrl!} alt="Sticker" className="size-[150px] object-contain" />
            </a>
          ) : (
            <MessageMedia m={m} rounded="rounded-[6px]" tone={out ? 'wa-out' : 'wa-in'} />
          )}
          <div
            className={cn(
              'after:block after:clear-both after:content-[""]',
              visual && 'px-1.5',
              sticker && 'w-fit rounded-full bg-white/85 px-2 pb-1.5 shadow-sm [&>span]:translate-y-[3px]',
              sticker && (out ? 'ml-auto' : ''),
            )}
          >
            {location ? (
              <LocationCard location={location} tone="wa" />
            ) : people ? (
              <ContactCard people={people} tone="wa" />
            ) : (
              body && <span className="whitespace-pre-wrap break-words">{body}</span>
            )}
            {meta}
          </div>
          <ReactionBadges m={m} contactName={contactName} side={out ? 'right' : 'left'} />
        </div>
        {menu}
      </div>
      <FailedNote m={m} className={out ? 'text-right' : undefined} />
    </div>
  );
}

/**
 * One Instagram message: blue (sent) or grey (received) rounded bubbles that
 * join up in a run, their small photo beside the last of a run.
 */
function IgBubble({
  m,
  first,
  last,
  contact,
  showStatus,
  menu,
}: {
  m: ChannelMessage;
  first: boolean;
  last: boolean;
  contact: Conversation;
  showStatus: boolean;
  menu?: React.ReactNode;
}) {
  const out = m.direction === 'OUTBOUND';
  const mediaOnly = !!m.mediaUrl && (!m.body || isMediaLabel(m.body)) && !isDocumentUrl(m.mediaUrl) && !isAudioUrl(m.mediaUrl);
  const corners = out
    ? cn('rounded-[22px]', !first && 'rounded-tr-[6px]', !last && 'rounded-br-[6px]')
    : cn('rounded-[22px]', !first && 'rounded-tl-[6px]', !last && 'rounded-bl-[6px]');
  return (
    <div className={cn('flex flex-col', out ? 'items-end' : 'items-start', first ? 'mt-3' : 'mt-[2px]')}>
      <div className={cn('group flex max-w-full items-center gap-2', out && 'flex-row-reverse')}>
        {!out && (last ? <ContactAvatar c={contact} className="size-7" fallbackClassName="bg-[#efefef] text-[10px] text-[#262626]" /> : <span className="w-7 shrink-0" />)}
        <div
          title={clockTime(m.createdAt)}
          className={cn(
            'max-w-[78vw] text-[15px] leading-5 sm:max-w-[60%]',
            m.mediaUrl && isDocumentUrl(m.mediaUrl) && 'min-w-[244px]',
            mediaOnly ? 'overflow-hidden' : 'px-3 py-2',
            mediaOnly ? corners : cn(corners, out ? 'bg-[#3797f0] text-white' : 'bg-[#efefef] text-[#000]'),
            m.status === 'QUEUED' && 'opacity-70',
          )}
        >
          {m.templateName && <p className="mb-0.5 text-[11px] font-semibold opacity-80">Template · {m.templateName}</p>}
          <MessageMedia m={m} rounded={mediaOnly ? corners : 'rounded-[14px]'} tone={out ? 'ig-out' : 'ig-in'} />
          {parseLocation(m.body) ? (
            <LocationCard location={parseLocation(m.body)!} tone={out ? 'ig-out' : 'ig-in'} />
          ) : parseContacts(m.body) ? (
            <ContactCard people={parseContacts(m.body)!} tone={out ? 'ig-out' : 'ig-in'} />
          ) : (
            shownBody(m) && <p className="whitespace-pre-wrap break-words">{shownBody(m)}</p>
          )}
        </div>
        {m.pinnedAt && <Pin className="size-3.5 shrink-0 text-[#737373]" aria-label="Pinned" />}
        {m.starredAt && <Star className="size-3.5 shrink-0 fill-[#737373] text-[#737373]" aria-label="Starred" />}
        {out && m.status === 'FAILED' && <AlertCircle className="size-4 shrink-0 text-[#ed4956]" />}
        {menu}
      </div>
      <FailedNote m={m} className={cn('text-[#ed4956]', out ? 'text-right' : 'ml-9')} />
      {showStatus && m.status !== 'FAILED' && (
        <p className="mr-1 mt-1 text-[11px] text-[#737373]">{m.status === 'READ' ? 'Seen' : m.status === 'QUEUED' ? 'Sending…' : 'Sent'}</p>
      )}
    </div>
  );
}

/** In Select mode a tap anywhere on the row picks the message (links and menus inside don't fire). */
function SelectableRow({
  selecting,
  checked,
  onToggle,
  wa,
  first,
  children,
}: {
  selecting: boolean;
  checked: boolean;
  onToggle: () => void;
  wa: boolean;
  first: boolean;
  children: React.ReactNode;
}) {
  if (!selecting) return <>{children}</>;
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      tabIndex={0}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        '-mx-3 flex cursor-pointer select-none items-center gap-2 px-3 transition-colors sm:-mx-2 sm:px-2',
        checked ? (wa ? 'bg-[#00a884]/[0.12]' : 'bg-[#3797f0]/[0.08]') : 'hover:bg-black/[0.03]',
      )}
    >
      <span
        className={cn(
          'flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border-2',
          first ? 'mt-3' : 'mt-[2px]',
          checked ? (wa ? 'border-[#00a884] bg-[#00a884] text-white' : 'border-[#3797f0] bg-[#3797f0] text-white') : 'border-[#8696a0] bg-white',
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <div className="pointer-events-none min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<ConversationChannel>('WHATSAPP');
  const [wideScreen, setWideScreen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setWideScreen(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // Inbox size: normal, full screen (covers the whole window) or a compact chat list.
  const [view, setView] = useState<InboxView>(() => {
    try {
      const saved = window.localStorage.getItem(INBOX_VIEW_KEY);
      return saved === 'full' || saved === 'compact' ? saved : 'normal';
    } catch {
      return 'normal';
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(INBOX_VIEW_KEY, view);
    } catch {
      /* storage unavailable — the choice just isn't remembered */
    }
    if (view !== 'full') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setView('normal');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [stage, setStage] = useState<ConversationStage | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; kind: 'image' | 'document' | 'video'; name: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChannelMessage | null>(null);
  // A reply belongs to the chat it was started in.
  useEffect(() => setReplyingTo(null), [selectedId]);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', channel, filter, stage, search],
    queryFn: () =>
      api.get<Conversation[]>(
        `/inbox/conversations?channel=${channel}&filter=${filter}${stage ? `&stage=${stage}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    ...livePolling(POLL.chatList),
  });

  const stageCountsQuery = useQuery({
    queryKey: ['conversations', 'stage-counts', channel],
    queryFn: () => api.get<ConversationStageCounts>(`/inbox/conversations/stage-counts?channel=${channel}`),
    ...livePolling(POLL.stageCounts),
  });
  const stageCounts = stageCountsQuery.data;

  const conversations = conversationsQuery.data ?? [];

  const favoriteMutation = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      api.patch<Conversation>(`/inbox/conversations/${id}/favorite`, { isFavorite }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['conversations'] }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update favorite'),
  });

  // Switching channels drops the selection — the two channels are entirely separate threads.
  useEffect(() => {
    setSelectedId(null);
    setDraft('');
    setTemplateName(null);
    setPendingMedia(null);
  }, [channel]);

  // The open chat: its newest messages on first open, then each poll asks only
  // for what's new since the last message on screen (plus tick updates).
  const threadQuery = useQuery({
    queryKey: ['messages', selectedId],
    queryFn: async () => {
      const key = ['messages', selectedId];
      const have = queryClient.getQueryData<Thread>(key);
      const newest = have?.messages.filter((m) => !isSending(m)).at(-1);
      if (!have || !newest) return api.get<Thread>(`/inbox/conversations/${selectedId}/messages`);
      const update = await api.get<ThreadUpdate>(`/inbox/conversations/${selectedId}/messages?after=${encodeURIComponent(newest.createdAt)}`);
      return mergeThread(queryClient.getQueryData<Thread>(key) ?? have, update);
    },
    enabled: !!selectedId,
    ...livePolling(POLL.openChat),
  });
  // Stays open even when a stage change moves the chat out of the filtered list.
  const listed = conversations.find((c) => c.id === selectedId) ?? null;
  const fromThread = threadQuery.data?.conversation.id === selectedId ? threadQuery.data.conversation : null;
  const selected = listed ?? fromThread;
  const selectedStatus = (fromThread ?? listed)?.lead?.status ?? null;
  const selectedLeadId = (fromThread ?? listed)?.lead?.id ?? selected?.leadId ?? null;
  const selectedTags = (fromThread ?? listed)?.lead?.tags ?? [];
  const selectedAssignee = (fromThread ?? listed)?.lead?.assignedTo ?? null;
  const { user: me, isAdmin } = useAuth();

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });
  // WhatsApp templates failing because the Meta account has no payment method.
  const channelsQuery = useQuery({ queryKey: ['channels'], queryFn: () => api.get<ChannelStatus[]>('/channels'), staleTime: 60_000 });
  const whatsappBillingIssue = !!channelsQuery.data?.find((c) => c.channel === 'WHATSAPP')?.billingIssue;
  const teammates = usersQuery.data ?? [];

  // The bot on this chat — why it's quiet, and restart / pause.
  const botQuery = useQuery({
    queryKey: ['chat-bot', selectedId],
    queryFn: () => api.get<ChatBotState>(`/inbox/conversations/${selectedId}/bot`),
    enabled: !!selectedId,
    ...livePolling(POLL.chatBot),
  });
  const bot = botQuery.data;
  const botMutation = useMutation({
    mutationFn: (action: 'restart' | 'pause') => api.post<ChatBotState>(`/inbox/conversations/${selectedId}/bot`, { action }),
    onSuccess: (state, action) => {
      queryClient.setQueryData(['chat-bot', selectedId], state);
      toast.success(action === 'restart' ? 'Bot restarted — it starts from the first step' : 'Bot paused — your team is handling this chat');
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not change the bot'),
  });

  // Hands the chat to a teammate: assigns its lead (same as on the Leads page).
  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) => api.patch(`/leads/${selectedLeadId}`, { assignedToId }),
    onSuccess: (_d, assignedToId) => {
      const who = teammates.find((u) => u.id === assignedToId);
      toast.success(assignedToId ? `Assigned to ${assignedToId === me?.id ? 'you' : who?.name ?? 'teammate'}` : 'Unassigned');
      // An agent only sees their own chats — one handed to someone else leaves their Inbox.
      if (!isAdmin && assignedToId !== me?.id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not assign this chat'),
  });

  const stageMutation = useMutation({
    mutationFn: (status: LeadStatus) => api.patch(`/leads/${selectedLeadId}`, { status }),
    onSuccess: (_data, status) => {
      toast.success(`Moved to ${LEAD_STATUS_STYLES[status].label}`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not change the stage'),
  });

  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get<MessageTemplate[]>('/inbox/templates'),
    enabled: channel === 'WHATSAPP',
  });
  const approvedTemplates = (templatesQuery.data ?? []).filter((t) => t.status === 'APPROVED');

  const outsideWindow = useMemo(() => {
    if (!selected || channel !== 'WHATSAPP') return false;
    return !selected.lastInboundAt || Date.now() - new Date(selected.lastInboundAt).getTime() > WHATSAPP_WINDOW_MS;
  }, [selected, channel]);

  // Instagram has no templates: a normal reply within 24h of their last message,
  // a team member's reply up to 7 days, then nothing until they write again.
  const igWindow = useMemo<'open' | 'agent' | 'closed'>(() => {
    if (!selected || channel !== 'INSTAGRAM') return 'open';
    const since = selected.lastInboundAt ? Date.now() - new Date(selected.lastInboundAt).getTime() : Infinity;
    return since <= WHATSAPP_WINDOW_MS ? 'open' : since <= 7 * WHATSAPP_WINDOW_MS ? 'agent' : 'closed';
  }, [selected, channel]);
  const composerBlocked = (outsideWindow && !templateName) || igWindow === 'closed';

  type SendVars = {
    body?: string;
    mediaUrl?: string;
    templateName?: string;
    replyToMessageId?: string;
    location?: SharedLocation;
    contact?: { name: string; phone: string; email?: string };
  };
  const sendMutation = useMutation({
    mutationFn: (vars: SendVars) => api.post<ChannelMessage>(`/inbox/conversations/${selectedId}/messages`, vars),
    // The bubble shows straight away (clock icon) while it goes out; the server's
    // copy replaces it — SENT, or FAILED with the reason, which stays in the chat.
    onMutate: async (vars) => {
      const key = ['messages', selectedId];
      await queryClient.cancelQueries({ queryKey: key });
      const draftBefore = draft;
      const replyBefore = replyingTo;
      queryClient.setQueryData<Thread>(key, (old) =>
        old
          ? {
              ...old,
              messages: [
                ...old.messages,
                {
                  id: `${SENDING_PREFIX}${Date.now()}`,
                  conversationId: selectedId!,
                  direction: 'OUTBOUND',
                  externalMessageId: null,
                  body: vars.location
                    ? locationBody(vars.location)
                    : vars.contact
                      ? contactBody([{ name: vars.contact.name, phones: [vars.contact.phone] }])
                      : (vars.body ?? (vars.templateName ? `Template: ${vars.templateName}` : null)),
                  mediaUrl: vars.mediaUrl ?? null,
                  templateName: vars.templateName ?? null,
                  replyTo: replyBefore,
                  status: 'QUEUED',
                  errorMessage: null,
                  sentById: me?.id ?? null,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : old,
      );
      const shared = !!(vars.location || vars.contact);
      if (!shared) {
        setDraft('');
        setTemplateName(null);
        setPendingMedia(null);
      }
      setReplyingTo(null);
      return { draftBefore: shared ? '' : draftBefore, replyBefore };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    },
    onError: (err, _vars, context) => {
      toast.error(err instanceof ApiError ? err.message : 'Send failed');
      // Text back in the box, so it can be fixed and sent again.
      if (context?.draftBefore) setDraft((d) => d || context.draftBefore);
      if (context?.replyBefore) setReplyingTo((r) => r ?? context.replyBefore);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
      // No payment method on Meta → the banner shows right away.
      if (err instanceof ApiError && err.code === 'WHATSAPP_PAYMENT_REQUIRED') queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: 'image' | 'document' | 'video' }) =>
      api.upload(kind === 'document' ? '/uploads/document' : kind === 'video' ? '/uploads/video' : '/uploads', file),
    onSuccess: (data, { file, kind }) => setPendingMedia({ url: data.url, kind, name: file.name }),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not upload the file'),
  });

  // "Call" — WhatsApp/Instagram's Business APIs have no calling capability at
  // all (only the customer's own app can place a call), so this dials the
  // agent's own phone via tel: and just logs that it happened as a note.
  const logCallMutation = useMutation({
    mutationFn: () => api.post<ChannelMessage>(`/inbox/conversations/${selectedId}/log-call`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    },
  });

  // AI Agent Builder (Phase 4) — human-in-the-loop only: these fill the
  // composer / show a summary for an agent to review, never send anything themselves.
  const [summary, setSummary] = useState<string | null>(null);
  const suggestMutation = useMutation({
    mutationFn: () => api.post<{ reply: string }>('/ai-agent/suggest-reply', { conversationId: selectedId }),
    onSuccess: (res) => setDraft(res.reply),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not draft a reply'),
  });
  const summarizeMutation = useMutation({
    mutationFn: () => api.post<{ summary: string }>('/ai-agent/summarize', { conversationId: selectedId }),
    onSuccess: (res) => setSummary(res.summary),
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not summarize'),
  });

  // Quick replies: typing "/" shows saved messages (like WhatsApp Business).
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const quickReplies = useQuickReplies().data ?? [];
  const [manageQuickReplies, setManageQuickReplies] = useState<false | 'list' | 'new'>(false);
  const [qrIndex, setQrIndex] = useState(0);
  const [qrDismissedFor, setQrDismissedFor] = useState<string | null>(null);
  const qrQuery = slashQuery(draft);
  const qrMatches = qrQuery === null ? [] : matchQuickReplies(quickReplies, qrQuery).slice(0, 8);
  const qrOpen = qrQuery !== null && qrDismissedFor !== draft;
  const pickQuickReply = (reply: QuickReply, fromSlash: boolean) => {
    const text = fillQuickReply(reply.message, selected?.contactName);
    setDraft((d) => (fromSlash ? insertQuickReply(d, text) : d.trim() ? `${d.trimEnd()}\n${text}` : text));
    setQrIndex(0);
    composerRef.current?.focus();
  };
  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!qrOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setQrDismissedFor(draft);
    } else if (qrMatches.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setQrIndex((i) => (i + (e.key === 'ArrowDown' ? 1 : qrMatches.length - 1)) % qrMatches.length);
    } else if (qrMatches.length > 0 && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
      e.preventDefault();
      pickQuickReply(qrMatches[Math.min(qrIndex, qrMatches.length - 1)], true);
    }
  };

  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let picking the same file twice in a row still fire onChange
    if (!file) return;
    // WhatsApp only shows JPG / PNG up to 5 MB — convert anything else first.
    toWhatsAppImage(file)
      .then((ready) => uploadMutation.mutate({ file: ready, kind: 'image' }))
      .catch((err: Error) => toast.error(err.message));
  };
  const videoInputRef = useRef<HTMLInputElement>(null);
  const handleVideoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // WhatsApp's own limits: MP4, up to 16 MB.
    if (file.type !== 'video/mp4') return void toast.error('WhatsApp only accepts MP4 videos');
    if (file.size > 16 * 1024 * 1024) return void toast.error('That video is over 16 MB — WhatsApp’s limit. Trim or compress it first.');
    uploadMutation.mutate({ file, kind: 'video' });
  };
  const handleDocumentSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadMutation.mutate({ file, kind: 'document' });
  };

  const pickTemplate = (name: string) => {
    const tpl = approvedTemplates.find((t) => t.name === name);
    setTemplateName(name);
    setDraft(tpl ? fillTemplatePreview(tpl.bodyText, selected?.contactName) : '');
  };

  const full = view === 'full';
  const compact = view === 'compact' && wideScreen; // phones stack list and chat — no compact list there
  const wa = channel === 'WHATSAPP';

  // Phones: the list fills the screen and a chat opens over it, like the real
  // apps — the phone's own back button closes the chat again.
  const openChat = (id: string) => {
    setSelectedId(id);
    if (!wideScreen) window.history.pushState({ inboxChat: id }, '');
  };
  const closeChat = () => {
    if (!wideScreen && (window.history.state as { inboxChat?: string } | null)?.inboxChat) window.history.back();
    else setSelectedId(null);
  };
  useEffect(() => {
    const onPop = () => setSelectedId(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const chatOverPhone = !wideScreen && !!selected;
  useEffect(() => {
    if (!chatOverPhone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [chatOverPhone]);

  // The message box grows with the text (up to ~6 lines).
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [draft, selectedId]);

  // Newest message in view when a chat opens or a message arrives — and kept
  // there while photos load, unless the agent has scrolled up to read.
  const threadRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);
  const autoScrollTop = useRef<number | null>(null);
  const scrollToBottom = () => {
    const el = threadRef.current;
    if (!el || !pinnedToBottom.current) return;
    el.scrollTop = el.scrollHeight;
    autoScrollTop.current = el.scrollTop;
  };
  const messageCount = threadQuery.data?.messages.length ?? 0;
  useEffect(() => {
    pinnedToBottom.current = true;
  }, [selectedId]);
  useEffect(() => {
    scrollToBottom();
  }, [selectedId, messageCount]);
  // Photos load after the text — follow the list as it grows.
  const threadContentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const content = threadContentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => scrollToBottom());
    ro.observe(content);
    return () => ro.disconnect();
  }, [selectedId, threadQuery.isLoading]);

  const canSend = (!!draft.trim() || !!pendingMedia) && !sendMutation.isPending && !composerBlocked;
  const sendNow = () => {
    if (!canSend) return;
    sendMutation.mutate({
      body: draft.trim() || undefined,
      mediaUrl: pendingMedia?.url || undefined,
      templateName: templateName || undefined,
      replyToMessageId: replyingTo?.id,
    });
  };
  // --- One message: react, star, copy, info ------------------------------------
  const patchMessage = (id: string, patch: Partial<ChannelMessage>) =>
    queryClient.setQueryData<Thread>(['messages', selectedId], (old) =>
      old ? { ...old, messages: old.messages.map((x) => (x.id === id ? { ...x, ...patch } : x)) } : old,
    );
  const reactMutation = useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string; before: string | null }) =>
      api.post(`/inbox/conversations/${selectedId}/messages/${id}/react`, { emoji }),
    // Shows straight away; put back if Meta refuses it.
    onMutate: ({ id, emoji }) => patchMessage(id, { agentReaction: emoji || null }),
    onError: (err, { id, before }) => {
      patchMessage(id, { agentReaction: before });
      toast.error(err instanceof ApiError ? err.message : 'Could not send the reaction');
    },
  });
  const starMutation = useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.patch(`/inbox/conversations/${selectedId}/messages/${id}/star`, { starred }),
    onMutate: ({ id, starred }) => patchMessage(id, { starredAt: starred ? new Date().toISOString() : null }),
    onSuccess: (_d, { starred }) => {
      toast.success(starred ? 'Starred' : 'Unstarred');
      queryClient.invalidateQueries({ queryKey: ['starred', selectedId] });
    },
    onError: (err, { id, starred }) => {
      patchMessage(id, { starredAt: starred ? null : new Date().toISOString() });
      toast.error(err instanceof ApiError ? err.message : 'Could not update the star');
    },
  });
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const infoQuery = useQuery({
    queryKey: ['message-info', infoFor],
    queryFn: () => api.get<MessageInfo>(`/inbox/conversations/${selectedId}/messages/${infoFor}`),
    enabled: !!infoFor && !!selectedId,
    staleTime: 0,
  });
  const [starredOpen, setStarredOpen] = useState(false);
  const starredQuery = useQuery({
    queryKey: ['starred', selectedId],
    queryFn: () => api.get<ChannelMessage[]>(`/inbox/conversations/${selectedId}/starred`),
    enabled: starredOpen && !!selectedId,
    staleTime: 0,
  });
  // The emoji picker: typing into the message box, or a "more reactions" pick for one message.
  const [emojiFor, setEmojiFor] = useState<null | { kind: 'insert' } | { kind: 'react'; id: string }>(null);
  const insertEmoji = (emoji: string) => {
    const el = composerRef.current;
    const at = el?.selectionStart ?? draft.length;
    const end = el?.selectionEnd ?? at;
    setDraft((d) => d.slice(0, at) + emoji + d.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + emoji.length, at + emoji.length);
    });
  };
  const copyMessage = async (m: ChannelMessage) => {
    const text = richCopyText(m.body) ?? shownBody(m) ?? m.mediaUrl ?? '';
    if (!text) return;
    if (await copyToClipboard(text)) toast.success('Copied');
    else toast.error('Could not copy');
  };
  /** The ⌄ menu for one message — what each item does, and which ones apply. */
  const messageMenu = (m: ChannelMessage) => {
    if (isSending(m)) return undefined;
    const reachable = !!m.externalMessageId && m.status !== 'FAILED';
    return (
      <MessageMenu
        align={m.direction === 'OUTBOUND' ? 'end' : 'start'}
        reactions={
          wa && reachable
            ? {
                current: m.agentReaction ?? null,
                onReact: (emoji) => reactMutation.mutate({ id: m.id, emoji, before: m.agentReaction ?? null }),
                onMore: () => setEmojiFor({ kind: 'react', id: m.id }),
              }
            : undefined
        }
        onReply={wa && reachable && !outsideWindow ? () => startReply(m) : undefined}
        onCopy={shownBody(m) || m.mediaUrl ? () => void copyMessage(m) : undefined}
        starred={!!m.starredAt}
        onStar={() => starMutation.mutate({ id: m.id, starred: !m.starredAt })}
        onInfo={() => setInfoFor(m.id)}
        pinned={!!m.pinnedAt}
        onPin={() => pinMutation.mutate({ id: m.id, pinned: !m.pinnedAt })}
        onForward={canForward(m) ? () => setForwardIds([m.id]) : undefined}
        onSelect={() => setSelectedMsgs([m.id])}
        onDelete={() => setDeleteIds([m.id])}
      />
    );
  };

  // --- Pin, select, forward, delete ---------------------------------------------
  const pinnedList = threadQuery.data?.conversation.id === selectedId ? (threadQuery.data.pinned ?? []) : [];
  const [pinIndex, setPinIndex] = useState(0);
  useEffect(() => setPinIndex(0), [selectedId, pinnedList.length]);
  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.patch<ChannelMessage[]>(`/inbox/conversations/${selectedId}/messages/${id}/pin`, { pinned }),
    onSuccess: (list, { pinned }) => {
      const ids = new Set(list.map((x) => x.id));
      queryClient.setQueryData<Thread>(['messages', selectedId], (old) =>
        old
          ? {
              ...old,
              pinned: list,
              messages: old.messages.map((x) => {
                const p = list.find((l) => l.id === x.id);
                return p ? { ...x, pinnedAt: p.pinnedAt } : x.pinnedAt && !ids.has(x.id) ? { ...x, pinnedAt: null } : x;
              }),
            }
          : old,
      );
      toast.success(pinned ? 'Pinned — only your team sees pins' : 'Unpinned');
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update the pin'),
  });
  /** Pinned message shown in the bar: click to jump to it. */
  const jumpToPinned = (m: ChannelMessage) => {
    if (document.getElementById(`msg-${m.id}`)) jumpToMessage(m.id);
    else toast.info('That message is older than the ones shown in this chat');
    if (pinnedList.length > 1) setPinIndex((i) => (i + 1) % pinnedList.length);
  };

  // Select mode: tap messages, then copy / star / forward / delete them together.
  const [selectedMsgs, setSelectedMsgs] = useState<string[] | null>(null);
  const selecting = selectedMsgs !== null;
  useEffect(() => setSelectedMsgs(null), [selectedId]);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) setSelectedMsgs(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting]);
  const toggleSelected = (id: string) =>
    setSelectedMsgs((list) => (list ? (list.includes(id) ? list.filter((x) => x !== id) : list.length >= 100 ? list : [...list, id]) : [id]));
  const pickedMessages = () => (threadQuery.data?.messages ?? []).filter((m) => selectedMsgs?.includes(m.id));
  const canForward = (m: ChannelMessage) => !isSending(m) && !m.templateName && m.status !== 'FAILED' && !!(m.mediaUrl || (m.body && (!/^\[.*\]$/s.test(m.body.trim()) || richSummary(m.body))));
  const copySelected = async () => {
    const picked = pickedMessages();
    const text = picked
      .map((m) => `[${clockTime(m.createdAt)}] ${m.direction === 'OUTBOUND' ? 'You' : label}: ${richCopyText(m.body) ?? shownBody(m) ?? m.mediaUrl ?? ''}`)
      .join('\n');
    if (await copyToClipboard(text)) toast.success(`Copied ${picked.length} message${picked.length === 1 ? '' : 's'}`);
    else toast.error('Could not copy');
    setSelectedMsgs(null);
  };
  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }: { action: 'star' | 'unstar' | 'delete'; ids: string[] }) =>
      api.post<{ count: number }>(`/inbox/conversations/${selectedId}/messages/bulk`, { action, messageIds: ids }),
    onSuccess: (r, { action, ids }) => {
      const now = new Date().toISOString();
      queryClient.setQueryData<Thread>(['messages', selectedId], (old) =>
        old
          ? action === 'delete'
            ? { ...old, messages: old.messages.filter((x) => !ids.includes(x.id)), pinned: old.pinned?.filter((x) => !ids.includes(x.id)) }
            : { ...old, messages: old.messages.map((x) => (ids.includes(x.id) ? { ...x, starredAt: action === 'star' ? now : null } : x)) }
          : old,
      );
      queryClient.invalidateQueries({ queryKey: ['starred', selectedId] });
      toast.success(
        action === 'delete'
          ? `Deleted ${r.count} message${r.count === 1 ? '' : 's'} from the CRM`
          : `${action === 'star' ? 'Starred' : 'Unstarred'} ${r.count} message${r.count === 1 ? '' : 's'}`,
      );
      setSelectedMsgs(null);
      setDeleteIds(null);
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not update those messages'),
  });
  const [forwardIds, setForwardIds] = useState<string[] | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [shareDialog, setShareDialog] = useState<null | 'location' | 'contact'>(null);

  // --- Contact info panel -------------------------------------------------------
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  useEffect(() => setContactInfoOpen(false), [selectedId]);

  // --- Scheduled messages ---------------------------------------------------------
  const scheduledQuery = useQuery({
    queryKey: ['scheduled', selectedId],
    queryFn: () => api.get<ScheduledMessage[]>(`/inbox/conversations/${selectedId}/scheduled`),
    enabled: !!selectedId,
    // Only while something is waiting, and only in a visible tab — sent ones then drop off the list.
    refetchInterval: (q) =>
      q.state.data?.some((x) => x.status === 'PENDING' || x.status === 'SENDING') && document.visibilityState === 'visible' ? 60_000 : false,
  });
  const scheduledList = scheduledQuery.data ?? [];
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledListOpen, setScheduledListOpen] = useState(false);
  const openSchedule = () => setScheduleOpen(true);

  // --- Voice notes: record → the server converts to OGG Opus → sent as a WhatsApp voice note
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  useEffect(() => setStickersOpen(false), [selectedId]);
  const [recording, setRecording] = useState(false);
  useEffect(() => setRecording(false), [selectedId]);
  const voiceMutation = useMutation({
    mutationFn: (file: File) => api.upload('/uploads/voice', file),
    onSuccess: ({ url }) => {
      setRecording(false);
      sendMutation.mutate({ mediaUrl: url, body: '[Voice message]', replyToMessageId: replyingTo?.id });
    },
    onError: (err) => {
      setRecording(false);
      toast.error(err instanceof ApiError ? err.message : 'Could not send the voice note');
    },
  });

  const startReply = (m: ChannelMessage) => {
    setReplyingTo(m);
    composerRef.current?.focus();
  };
  // Tapping a quote goes to the original (when it's among the messages on screen) and flashes it.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const jumpToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((h) => (h === id ? null : h)), 1500);
  };
  // Enter sends, Shift+Enter is a new line (like WhatsApp Web) — on a computer; phones keep Enter for new lines.
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleComposerKeyDown(e);
    if (!e.defaultPrevented && e.key === 'Escape' && replyingTo) {
      e.preventDefault();
      setReplyingTo(null);
      return;
    }
    if (e.defaultPrevented || e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    sendNow();
  };

  const messages = threadQuery.data?.messages ?? [];
  const lastOutboundId = [...messages].reverse().find((m) => m.direction === 'OUTBOUND')?.id;
  const label = selected ? selected.contactName || selected.contactPhone || selected.externalContactId : '';

  // Header controls — styled for a light header (WhatsApp Web grey / Instagram white).
  const headerIconBtn = cn(
    'inline-flex size-10 items-center justify-center rounded-full transition-colors disabled:opacity-50',
    wa ? 'text-[#54656f] hover:bg-black/[0.06]' : 'text-[#000] hover:bg-black/[0.05]',
  );
  const headerPill = cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors disabled:opacity-60',
    wa ? 'bg-white text-[#3b4a54] shadow-[0_1px_1px_rgba(11,20,26,0.06)] ring-1 ring-[#e9edef] hover:bg-[#f5f6f6]' : 'bg-[#efefef] text-[#000] hover:bg-[#e3e3e3]',
  );

  const filterChips = (
    [
      { key: 'all', label: 'All' },
      { key: 'unread', label: 'Unread' },
      { key: 'favorites', label: 'Favourites' },
      { key: 'mine', label: 'Mine' },
      { key: 'unassigned', label: 'Unassigned' },
    ] as const
  )
    // An agent's Inbox is only their own chats, so "Mine" / "Unassigned" mean nothing there.
    .filter((f) => isAdmin || (f.key !== 'mine' && f.key !== 'unassigned'));

  return (
    <div className={cn(full && 'fixed inset-0 z-40 flex flex-col bg-background p-3 sm:p-4')}>
      {!full && <PageHeader title="Inbox" description="WhatsApp and Instagram conversations — auto-created from incoming messages." />}
      <ManageQuickRepliesDialog
        open={!!manageQuickReplies}
        startNew={manageQuickReplies === 'new'}
        onOpenChange={(o) => setManageQuickReplies(o ? 'list' : false)}
      />

      <div className={cn('flex flex-wrap items-center justify-between gap-2', full ? 'mb-3' : 'mb-4')}>
        {/* Channel switcher */}
        <div className="inline-flex rounded-full border border-border bg-card p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setChannel('WHATSAPP')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
              wa ? 'bg-[#00a884] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <MessageCircle className="size-4" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => setChannel('INSTAGRAM')}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all',
              !wa ? 'bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Instagram className="size-4" /> Instagram
          </button>
        </div>

        {/* Inbox size */}
        <div className="hidden rounded-full border border-border bg-card p-1 shadow-sm md:inline-flex" role="group" aria-label="Inbox size">
          {VIEW_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setView(o.key)}
              aria-pressed={view === o.key}
              aria-label={o.label}
              title={o.key === 'full' ? 'Full screen (Esc to exit)' : o.label}
              className={cn(
                'flex size-8 items-center justify-center rounded-full transition-colors',
                view === o.key ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <o.icon className="size-4" />
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-1 overflow-hidden rounded-2xl border shadow-[0_8px_30px_rgba(15,23,42,0.06)]',
          wa ? 'border-[#e9edef] bg-white' : 'border-[#dbdbdb] bg-white',
          full ? 'min-h-0 flex-1' : 'h-[calc(100dvh-210px)] min-h-[560px]',
          compact ? 'md:grid-cols-[76px_1fr]' : 'md:grid-cols-[340px_1fr] xl:grid-cols-[380px_1fr]',
        )}
      >
        {/* ---------------- Chat list ---------------- */}
        <div className={cn('flex min-h-0 flex-col md:border-r', wa ? 'border-[#e9edef]' : 'border-[#dbdbdb]')}>
          <div className={cn(compact && 'hidden')}>
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className={cn('text-[22px] font-bold tracking-tight', wa ? 'text-[#111b21]' : 'text-[#000]')}>{wa ? 'Chats' : 'Messages'}</h2>
              <div className="flex items-center gap-2">
                {stageCounts && <span className={cn('text-xs', wa ? 'text-[#667781]' : 'text-[#737373]')}>{stageCounts.total} chats</span>}
                <button
                  type="button"
                  onClick={() => setGroupsOpen(true)}
                  title="Groups — message many customers at once"
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                    wa ? 'bg-[#e7fce3] text-[#008069] hover:bg-[#d1f4cc]' : 'bg-[#e8f3fe] text-[#0064e0] hover:bg-[#d6eafd]',
                  )}
                >
                  <Users className="size-3.5" /> Groups
                </button>
              </div>
            </div>
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className={cn('pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2', wa ? 'text-[#54656f]' : 'text-[#737373]')} />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={wa ? 'Search or start a new chat' : 'Search'}
                  aria-label="Search conversations"
                  className={cn(
                    'h-9 w-full rounded-lg pl-10 pr-3 text-sm outline-none transition-shadow placeholder:text-[#667781] focus:ring-2',
                    wa ? 'bg-[#f0f2f5] text-[#111b21] focus:ring-[#00a884]/30' : 'bg-[#efefef] text-[#000] placeholder:text-[#737373] focus:ring-[#0095f6]/25',
                  )}
                />
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto px-3 pb-2 [scrollbar-width:none]">
              {filterChips.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1 text-[13px] font-medium transition-colors',
                    wa
                      ? filter === f.key
                        ? 'bg-[#d9fdd3] text-[#008069]'
                        : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                      : filter === f.key
                        ? 'bg-[#000] text-white'
                        : 'bg-[#efefef] text-[#000] hover:bg-[#e3e3e3]',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {/* Lead stages */}
            <div className="flex gap-1.5 overflow-x-auto px-3 pb-2.5 [scrollbar-width:none]" role="group" aria-label="Filter by lead stage">
              <button
                type="button"
                onClick={() => setStage(null)}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors',
                  stage === null ? 'bg-foreground text-background ring-foreground' : 'bg-card text-muted-foreground ring-border hover:text-foreground',
                )}
              >
                All stages{stageCounts ? ` · ${stageCounts.total}` : ''}
              </button>
              {LEAD_STATUSES.map(({ value }) => {
                const style = LEAD_STATUS_STYLES[value];
                const count = stageCounts?.byStage[value] ?? 0;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStage(stage === value ? null : value)}
                    className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors', stage === value ? style.chipActive : style.chipIdle)}
                  >
                    {style.label} · {count}
                  </button>
                );
              })}
              {(stageCounts?.none ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => setStage(stage === 'none' ? null : 'none')}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors',
                    stage === 'none' ? 'bg-slate-600 text-white ring-slate-600' : 'bg-card text-muted-foreground ring-border hover:text-foreground',
                  )}
                >
                  No lead · {stageCounts!.none}
                </button>
              )}
            </div>
            <div className={cn('border-b', wa ? 'border-[#e9edef]' : 'border-[#efefef]')} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="space-y-1 p-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-1 py-2">
                    <Skeleton className="size-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-1/2" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={filter === 'favorites' ? <Star /> : filter === 'unread' ? <MailOpen /> : <InboxIcon />}
                title={
                  stage
                    ? `No chats in ${stage === 'none' ? 'No lead' : LEAD_STATUS_STYLES[stage].label}`
                    : filter === 'mine'
                      ? 'No chats assigned to you'
                      : filter === 'unassigned'
                        ? 'Every chat is assigned'
                        : filter === 'favorites'
                          ? 'No favourites yet'
                          : filter === 'unread'
                            ? 'No unread chats'
                            : 'No conversations yet'
                }
                description={
                  stage
                    ? 'Try another stage, or All stages.'
                    : filter === 'mine'
                      ? 'Chats your team assigns to you show up here.'
                      : filter === 'unassigned'
                        ? 'Nothing waiting for an owner.'
                        : filter === 'favorites'
                          ? 'Star a chat to pin it here.'
                          : filter === 'unread'
                            ? "You're all caught up."
                            : `Incoming ${wa ? 'WhatsApp messages' : 'Instagram DMs'} will show up here automatically.`
                }
                className="border-none"
              />
            ) : (
              conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  c={c}
                  channel={channel}
                  active={c.id === selectedId}
                  onClick={() => openChat(c.id)}
                  onToggleFavorite={() => favoriteMutation.mutate({ id: c.id, isFavorite: !c.isFavorite })}
                  compact={compact}
                />
              ))
            )}
          </div>
        </div>

        {/* ---------------- Chat ---------------- */}
        <div
          className={cn(
            'relative min-h-0 flex-col',
            // Phones: the open chat covers the screen; no chat → just the list.
            selected ? 'flex' : 'hidden md:flex',
            chatOverPhone && 'fixed inset-0 z-50 bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]',
          )}
        >
          {!selected ? (
            <div className={cn('flex flex-1 flex-col items-center justify-center px-8 text-center', wa ? 'bg-[#f0f2f5]' : 'bg-white')}>
              {wa ? (
                <>
                  <span className="flex size-24 items-center justify-center rounded-full bg-[#d9fdd3]">
                    <MessageCircle className="size-11 text-[#00a884]" strokeWidth={1.6} />
                  </span>
                  <h3 className="mt-6 text-[28px] font-light text-[#41525d]">WhatsApp Inbox</h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#667781]">
                    Pick a chat to reply. Messages go out from your connected WhatsApp Business number — the bot, quick replies and AI suggestions work right here.
                  </p>
                </>
              ) : (
                <>
                  <span className="flex size-24 items-center justify-center rounded-full border-2 border-[#000]">
                    <Send className="size-10 -rotate-12 text-[#000]" strokeWidth={1.5} />
                  </span>
                  <h3 className="mt-5 text-xl font-semibold text-[#000]">Your messages</h3>
                  <p className="mt-1.5 max-w-xs text-sm text-[#737373]">Pick a chat to reply to your Instagram DMs.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                className={cn(
                  'flex shrink-0 items-center gap-2 px-2 sm:px-4',
                  wa ? 'h-[60px] border-b border-[#d1d7db] bg-[#f0f2f5]' : 'h-[68px] border-b border-[#dbdbdb] bg-white',
                )}
              >
                <button type="button" onClick={closeChat} className={cn(headerIconBtn, 'md:hidden')} aria-label="Back to chats">
                  <ArrowLeft className="size-5" />
                </button>
                <button type="button" onClick={() => setContactInfoOpen(true)} title="Contact info" className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <ContactAvatar
                    c={selected}
                    className={wa ? 'size-10' : 'size-11'}
                    fallbackClassName={wa ? 'bg-[#dfe5e7] text-[#54656f]' : 'bg-[#efefef] text-[#262626]'}
                  />
                  <div className="min-w-0 flex-1 pl-1">
                    <p className={cn('truncate text-[16px] leading-tight', wa ? 'text-[#111b21]' : 'font-semibold text-[#000]')}>{label}</p>
                    <p className={cn('truncate text-[13px] leading-tight', wa ? 'text-[#667781]' : 'text-[#737373]')}>
                      {[selected.contactName && selected.contactPhone ? selected.contactPhone : null, ...selectedTags.slice(0, 3)].filter(Boolean).join(' · ') ||
                        (wa ? 'WhatsApp' : 'Instagram')}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                  {bot && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={botMutation.isPending}
                          aria-label="Bot on this chat"
                          title={
                            bot.state === 'off'
                              ? 'The bot hasn’t run on this chat'
                              : bot.state === 'waiting'
                                ? `Flow “${bot.flowName}” — waiting for an answer to: ${bot.question ?? ''}`
                                : bot.state === 'paused'
                                  ? `Flow “${bot.flowName}” — paused, your team is handling this chat`
                                  : bot.state === 'finished'
                                    ? `Flow “${bot.flowName}” — finished`
                                    : `Flow “${bot.flowName}” — running`
                          }
                          className={headerPill}
                        >
                          {botMutation.isPending ? <Spinner className="size-3.5" /> : <Bot className="size-3.5" />}
                          <span className="hidden xl:inline">
                            {bot.state === 'off' ? 'Bot off' : bot.state === 'waiting' ? 'Bot: waiting' : bot.state === 'paused' ? 'Bot paused' : bot.state === 'finished' ? 'Bot finished' : 'Bot on'}
                          </span>
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              bot.state === 'waiting' || bot.state === 'running' ? 'bg-emerald-500' : bot.state === 'paused' ? 'bg-amber-400' : 'bg-slate-400',
                            )}
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72">
                        <DropdownMenuLabel className="font-normal">
                          <span className="block text-sm font-medium text-foreground">{bot.state === 'off' ? 'Bot hasn’t run here' : `Flow: ${bot.flowName}`}</span>
                          <span className="block text-xs text-muted-foreground">
                            {bot.state === 'waiting' && `Waiting for an answer to “${bot.question ?? ''}” — whatever they type next is taken as the answer.`}
                            {bot.state === 'running' && 'Running.'}
                            {bot.state === 'finished' && 'Finished. It starts again when they say hi or send a keyword.'}
                            {bot.state === 'paused' && 'Paused — your team is handling this chat. It comes back on “hi” once nobody from the team has replied for a day.'}
                            {bot.state === 'off' && 'No flow has started on this chat yet.'}
                          </span>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => botMutation.mutate('restart')}>
                          <RotateCcw className="size-4" /> Restart bot from the first step
                        </DropdownMenuItem>
                        {(bot.state === 'waiting' || bot.state === 'running' || bot.state === 'finished') && (
                          <DropdownMenuItem onSelect={() => botMutation.mutate('pause')}>
                            <Pause className="size-4" /> Pause bot — my team will reply
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {selectedLeadId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={stageMutation.isPending}
                          className={cn(
                            'inline-flex h-7 items-center gap-0.5 rounded-full px-2 text-[11px] font-medium shadow-sm transition-colors disabled:opacity-60 sm:h-8 sm:gap-1 sm:px-2.5 sm:text-xs',
                            selectedStatus ? LEAD_STATUS_STYLES[selectedStatus].solid : 'bg-white text-foreground',
                          )}
                          aria-label="Change lead stage"
                          title="Change lead stage"
                        >
                          {stageMutation.isPending ? <Spinner className="size-3" /> : null}
                          {selectedStatus ? LEAD_STATUS_STYLES[selectedStatus].label : 'Stage'}
                          <ChevronDown className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Move lead to</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {LEAD_STATUSES.map(({ value }) => (
                          <DropdownMenuItem key={value} disabled={value === selectedStatus} onSelect={() => stageMutation.mutate(value)}>
                            <span className={cn('size-2 rounded-full', LEAD_STATUS_STYLES[value].dot)} />
                            {LEAD_STATUS_STYLES[value].label}
                            {value === selectedStatus && <Check className="ml-auto size-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {selectedLeadId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={assignMutation.isPending}
                          aria-label="Assign chat"
                          title={selectedAssignee ? `Assigned to ${selectedAssignee.name} — change` : 'Assign to a teammate'}
                          className={cn(headerIconBtn, 'hidden w-auto gap-1.5 px-2 text-xs font-medium sm:inline-flex')}
                        >
                          {assignMutation.isPending ? (
                            <Spinner className="size-4" />
                          ) : selectedAssignee ? (
                            <span className="flex size-7 items-center justify-center rounded-full bg-[#dfe5e7] text-[10px] font-bold text-[#3b4a54]">
                              {initials(selectedAssignee.name)}
                            </span>
                          ) : (
                            <UserPlus className="size-5" />
                          )}
                          <span className="hidden max-w-[7rem] truncate lg:inline">
                            {selectedAssignee ? (selectedAssignee.id === me?.id ? 'You' : selectedAssignee.name.split(' ')[0]) : 'Assign'}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Assign this chat to</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {teammates.map((u) => (
                          <DropdownMenuItem key={u.id} disabled={u.id === selectedAssignee?.id} onSelect={() => assignMutation.mutate(u.id)}>
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{initials(u.name)}</span>
                            <span className="min-w-0 flex-1 truncate">
                              {u.name}
                              {u.id === me?.id && <span className="text-muted-foreground"> (you)</span>}
                            </span>
                            {u.id === selectedAssignee?.id && <Check className="size-3.5" />}
                          </DropdownMenuItem>
                        ))}
                        {selectedAssignee && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onSelect={() => assignMutation.mutate(null)}>
                              <X className="size-4" /> Unassign
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {wa && selected.contactPhone && (
                    <a
                      href={`tel:${selected.contactPhone}`}
                      onClick={() => logCallMutation.mutate()}
                      className={cn(headerIconBtn, 'hidden sm:inline-flex')}
                      aria-label="Call"
                      title={`Call ${selected.contactPhone}`}
                    >
                      <Phone className="size-5" />
                    </a>
                  )}
                  <button
                    type="button"
                    className={cn(headerIconBtn, 'hidden sm:inline-flex')}
                    onClick={() => setStarredOpen(true)}
                    aria-label="Starred messages"
                    title="Starred messages"
                  >
                    <Star className="size-5" />
                  </button>
                  <button
                    type="button"
                    className={cn(headerIconBtn, 'hidden sm:inline-flex')}
                    disabled={summarizeMutation.isPending || messages.length === 0}
                    onClick={() => summarizeMutation.mutate()}
                    aria-label="Summarize this chat"
                    title="Summarize this chat (AI)"
                  >
                    {summarizeMutation.isPending ? <Spinner className="size-4" /> : <FileText className="size-5" />}
                  </button>
                  {/* Phones: the rest of the actions in one menu, so the name stays readable. */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" className={cn(headerIconBtn, 'sm:hidden')} aria-label="More">
                        {summarizeMutation.isPending || assignMutation.isPending ? <Spinner className="size-4" /> : <MoreVertical className="size-5" />}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuItem onSelect={() => setContactInfoOpen(true)}>
                        <UserRound className="size-4" /> Contact info
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setStarredOpen(true)}>
                        <Star className="size-4" /> Starred messages
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setScheduledListOpen(true)}>
                        <CalendarClock className="size-4" /> Scheduled messages{scheduledList.length ? ` (${scheduledList.length})` : ''}
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={messages.length === 0} onSelect={() => summarizeMutation.mutate()}>
                        <FileText className="size-4" /> Summarize chat
                      </DropdownMenuItem>
                      {wa && selected.contactPhone && (
                        <DropdownMenuItem
                          onSelect={() => {
                            logCallMutation.mutate();
                            window.location.href = `tel:${selected.contactPhone}`;
                          }}
                        >
                          <Phone className="size-4" /> Call {selected.contactPhone}
                        </DropdownMenuItem>
                      )}
                      {selectedLeadId && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Assign this chat to</DropdownMenuLabel>
                          {teammates.map((u) => (
                            <DropdownMenuItem key={u.id} disabled={u.id === selectedAssignee?.id} onSelect={() => assignMutation.mutate(u.id)}>
                              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{initials(u.name)}</span>
                              <span className="min-w-0 flex-1 truncate">
                                {u.name}
                                {u.id === me?.id && <span className="text-muted-foreground"> (you)</span>}
                              </span>
                              {u.id === selectedAssignee?.id && <Check className="size-3.5" />}
                            </DropdownMenuItem>
                          ))}
                          {selectedAssignee && (
                            <DropdownMenuItem onSelect={() => assignMutation.mutate(null)}>
                              <X className="size-4" /> Unassign
                            </DropdownMenuItem>
                          )}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Pinned messages (team only) — tap to go to it; several cycle like WhatsApp */}
              {pinnedList.length > 0 &&
                !selecting &&
                (() => {
                  const at = Math.min(pinIndex, pinnedList.length - 1);
                  const p = pinnedList[at];
                  return (
                    <div className={cn('flex shrink-0 items-center gap-2.5 border-b bg-white px-3 py-1.5 sm:px-4', wa ? 'border-black/[0.06]' : 'border-[#efefef]')}>
                      {pinnedList.length > 1 && (
                        <span className="flex flex-col gap-[3px]" aria-hidden>
                          {pinnedList.map((x, i) => (
                            <span key={x.id} className={cn('h-2.5 w-[3px] rounded-full', i === at ? (wa ? 'bg-[#00a884]' : 'bg-[#3797f0]') : 'bg-black/15')} />
                          ))}
                        </span>
                      )}
                      <button type="button" onClick={() => jumpToPinned(p)} title="Go to this message" className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                        <Pin className="size-4 shrink-0 text-[#54656f]" />
                        <span className="min-w-0">
                          <span className={cn('block text-[12px] font-medium', wa ? 'text-[#008069]' : 'text-[#3797f0]')}>
                            Pinned{pinnedList.length > 1 ? ` · ${at + 1} of ${pinnedList.length}` : ''}
                          </span>
                          <span className="block truncate text-[13px] text-[#54656f]">{quotedText(p)}</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => pinMutation.mutate({ id: p.id, pinned: false })}
                        disabled={pinMutation.isPending}
                        title="Unpin"
                        aria-label="Unpin"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06]"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  );
                })()}

              {/* Messages */}
              <div
                ref={threadRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  // Our own jump to the bottom isn't the agent scrolling up.
                  if (autoScrollTop.current !== null && Math.abs(el.scrollTop - autoScrollTop.current) < 2) return;
                  autoScrollTop.current = null;
                  pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
                }}
                className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain', wa ? 'px-3 pb-3 pt-2 sm:px-[6%]' : 'bg-white px-3 pb-3 pt-2 sm:px-5')}
                style={wa ? WA_WALLPAPER_STYLE : undefined}
              >
                {threadQuery.isLoading ? (
                  <div className="space-y-3 pt-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className={cn('h-10 max-w-[60%]', wa ? 'rounded-lg' : 'rounded-[22px]', i % 2 === 0 ? '' : 'ml-auto')} />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <p className={cn('mx-auto mt-10 w-fit rounded-lg px-3 py-1.5 text-xs', wa ? 'bg-[#ffeecd] text-[#54656f]' : 'text-[#737373]')}>
                    No messages yet — say hello 👋
                  </p>
                ) : (
                  <div ref={threadContentRef} className="pb-1">
                    {messages.map((m, i) => {
                      const prev = messages[i - 1];
                      const next = messages[i + 1];
                      const newDay = !prev || dayKey(prev.createdAt) !== dayKey(m.createdAt);
                      const gapBefore = prev ? new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() : Infinity;
                      const gapAfter = next ? new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime() : Infinity;
                      const first = newDay || !prev || prev.direction !== m.direction || gapBefore > 10 * 60_000;
                      const last = !next || next.direction !== m.direction || dayKey(next.createdAt) !== dayKey(m.createdAt) || gapAfter > 10 * 60_000;
                      // Instagram shows a centred time whenever a while has passed.
                      const igTime = !wa && (newDay || gapBefore > 60 * 60_000);
                      return (
                        <div key={m.id}>
                          {wa && newDay && (
                            <div className="my-3 flex justify-center">
                              <span className="rounded-lg bg-white px-3 py-1.5 text-[12.5px] text-[#54656f] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">{dayLabel(m.createdAt)}</span>
                            </div>
                          )}
                          {igTime && (
                            <p className="my-4 text-center text-xs font-medium text-[#737373]">
                              {dayLabel(m.createdAt)} {clockTime(m.createdAt)}
                            </p>
                          )}
                          <SelectableRow
                            selecting={selecting && !isSending(m)}
                            checked={!!selectedMsgs?.includes(m.id)}
                            onToggle={() => toggleSelected(m.id)}
                            wa={wa}
                            first={first}
                          >
                            {wa ? (
                              <WaBubble
                                m={m}
                                first={first}
                                contactName={label}
                                highlighted={highlightId === m.id}
                                onJump={jumpToMessage}
                                menu={selecting ? undefined : messageMenu(m)}
                              />
                            ) : (
                              <IgBubble
                                m={m}
                                first={first}
                                last={last}
                                contact={selected}
                                showStatus={m.id === lastOutboundId}
                                menu={selecting ? undefined : messageMenu(m)}
                              />
                            )}
                          </SelectableRow>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Select mode: what to do with the picked messages */}
              {selecting &&
                (() => {
                  const picked = pickedMessages();
                  const n = picked.length;
                  const allStarred = n > 0 && picked.every((x) => x.starredAt);
                  const forwardable = n > 0 && n <= 20 && picked.every(canForward);
                  const action = 'flex size-10 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06] disabled:opacity-35 disabled:hover:bg-transparent';
                  return (
                    <div className={cn('flex shrink-0 items-center gap-1 px-2 py-2 sm:px-4', wa ? 'bg-[#f0f2f5]' : 'border-t border-[#efefef] bg-white')}>
                      <button type="button" onClick={() => setSelectedMsgs(null)} aria-label="Cancel selection" title="Cancel (Esc)" className={action}>
                        <X className="size-5" />
                      </button>
                      <span className="flex-1 pl-1 text-[15px] text-[#111b21]">{n === 0 ? 'Tap messages to select' : `${n} selected`}</span>
                      <button type="button" disabled={n === 0} onClick={() => void copySelected()} aria-label="Copy" title="Copy" className={action}>
                        <Copy className="size-5" />
                      </button>
                      <button
                        type="button"
                        disabled={n === 0 || bulkMutation.isPending}
                        onClick={() => bulkMutation.mutate({ action: allStarred ? 'unstar' : 'star', ids: picked.map((x) => x.id) })}
                        aria-label={allStarred ? 'Unstar' : 'Star'}
                        title={allStarred ? 'Unstar' : 'Star'}
                        className={action}
                      >
                        <Star className={cn('size-5', allStarred && 'fill-current')} />
                      </button>
                      <button
                        type="button"
                        disabled={!forwardable}
                        onClick={() => setForwardIds(picked.map((x) => x.id))}
                        aria-label="Forward"
                        title={n > 20 ? 'Forward up to 20 messages at a time' : n > 0 && !forwardable ? "Templates and failed messages can't be forwarded" : 'Forward'}
                        className={action}
                      >
                        <Forward className="size-5" />
                      </button>
                      <button
                        type="button"
                        disabled={n === 0}
                        onClick={() => setDeleteIds(picked.map((x) => x.id))}
                        aria-label="Delete"
                        title="Delete"
                        className={cn(action, 'text-[#ea0038]')}
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                  );
                })()}

              {/* Composer */}
              <div className={cn('relative shrink-0 px-2 pb-2 pt-2 sm:px-4', wa ? 'bg-[#f0f2f5]' : 'border-t border-[#efefef] bg-white', selecting && 'hidden')}>
                {stickersOpen && wa && (
                  <div className="absolute bottom-full left-2 z-30 mb-2 sm:left-4">
                    <StickerPicker
                      onClose={() => setStickersOpen(false)}
                      onPick={(url) => {
                        setStickersOpen(false);
                        sendMutation.mutate({ mediaUrl: url, body: '[Sticker]', replyToMessageId: replyingTo?.id });
                      }}
                    />
                  </div>
                )}
                {emojiFor && (
                  <div className="absolute bottom-full left-2 z-30 mb-2 sm:left-4">
                    <EmojiPicker
                      onClose={() => setEmojiFor(null)}
                      onPick={(emoji) => {
                        if (emojiFor.kind === 'insert') {
                          insertEmoji(emoji);
                          return; // stays open — several emojis in a row
                        }
                        const target = messages.find((x) => x.id === emojiFor.id);
                        reactMutation.mutate({ id: emojiFor.id, emoji, before: target?.agentReaction ?? null });
                        setEmojiFor(null);
                      }}
                    />
                    {emojiFor.kind === 'react' && <p className="mt-1 rounded-md bg-card px-2 py-1 text-center text-[11px] text-muted-foreground shadow-sm">Pick a reaction</p>}
                  </div>
                )}
                <ScheduledStrip items={scheduledList} wa={wa} onOpen={() => setScheduledListOpen(true)} />
                {wa && whatsappBillingIssue && <WhatsAppBillingBanner />}
                {igWindow !== 'open' && (
                  <div className={cn('mb-2 rounded-xl px-3 py-2 text-xs', igWindow === 'closed' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800')}>
                    {igWindow === 'closed'
                      ? 'Their last message was over 7 days ago — Instagram won’t deliver a reply until they message you again.'
                      : 'Over 24 hours since their last message — Instagram only accepts a personal reply from your team now (up to 7 days). Your message is sent as a team reply.'}
                  </div>
                )}
                {outsideWindow && (
                  <div className="mb-2 rounded-xl bg-[#fff8e1] px-3 py-2 text-xs text-[#6b5a1e] ring-1 ring-[#f6e3a3]">
                    Outside the 24-hour window — send an approved template to restart the conversation.
                    {approvedTemplates.length > 0 ? (
                      <select
                        className="mt-1.5 block w-full rounded-lg border border-[#f6e3a3] bg-white px-2 py-1.5 text-xs"
                        value={templateName ?? ''}
                        onChange={(e) => {
                          if (e.target.value) {
                            pickTemplate(e.target.value);
                          } else {
                            setTemplateName(null);
                            setDraft('');
                          }
                        }}
                      >
                        <option value="">Choose a template…</option>
                        {approvedTemplates.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="mt-1">No approved templates yet — add one in Settings → Channels.</p>
                    )}
                  </div>
                )}
                {(pendingMedia || uploadMutation.isPending) && (
                  <div className="mb-2 flex items-center gap-3 rounded-xl bg-white p-2 shadow-sm ring-1 ring-black/5">
                    {uploadMutation.isPending ? (
                      <div className="flex size-14 items-center justify-center rounded-lg bg-muted">
                        <Spinner className="size-4" />
                      </div>
                    ) : pendingMedia!.kind === 'image' ? (
                      <img src={pendingMedia!.url} alt="" className="size-14 rounded-lg object-cover" />
                    ) : pendingMedia!.kind === 'video' ? (
                      <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black">
                        <video src={`${pendingMedia!.url}#t=0.1`} muted preload="metadata" className="size-full object-cover opacity-80" />
                        <VideoIcon className="absolute size-5 text-white" />
                      </span>
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-[#ff5c5c] text-xs font-bold text-white">PDF</span>
                    )}
                    <p className="flex-1 truncate text-xs text-muted-foreground">
                      {uploadMutation.isPending ? 'Uploading…' : pendingMedia!.kind === 'image' ? 'Photo ready to send' : pendingMedia!.kind === 'video' ? `Video ready to send · ${pendingMedia!.name}` : pendingMedia!.name}
                    </p>
                    <button
                      type="button"
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted disabled:opacity-50"
                      disabled={uploadMutation.isPending}
                      onClick={() => setPendingMedia(null)}
                      aria-label="Remove attachment"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                {!composerBlocked && !outsideWindow && (
                  <QuickReplyBar
                    contactName={selected?.contactName}
                    onPick={(r) => pickQuickReply(r, false)}
                    onManage={() => setManageQuickReplies('list')}
                    onNew={() => setManageQuickReplies('new')}
                  />
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                <input ref={documentInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleDocumentSelected} />
                <input ref={videoInputRef} type="file" accept="video/mp4" className="hidden" onChange={handleVideoSelected} />

                {wa && replyingTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg bg-white p-1.5 shadow-sm">
                    <QuotedMessage quote={replyingTo} contactName={label} className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      aria-label="Cancel reply"
                      title="Cancel reply (Esc)"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06]"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
                {wa && recording ? (
                  <div className="flex items-center gap-1 sm:gap-2">
                    <VoiceRecorderBar wa onCancel={() => setRecording(false)} onSend={(file) => voiceMutation.mutate(file)} sending={voiceMutation.isPending} />
                  </div>
                ) : wa ? (
                  // WhatsApp Web: + attach, white rounded box, round green send.
                  <div className="flex items-end gap-1 sm:gap-2">
                    <button
                      type="button"
                      disabled={composerBlocked}
                      onClick={() => setEmojiFor((f) => (f?.kind === 'insert' ? null : { kind: 'insert' }))}
                      aria-label="Emoji"
                      title="Emoji"
                      className={cn(
                        'mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06] disabled:opacity-40',
                        emojiFor?.kind === 'insert' && 'bg-black/[0.06] text-[#00a884]',
                      )}
                    >
                      <Smile className="size-6" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          disabled={uploadMutation.isPending || composerBlocked}
                          aria-label="Attach"
                          title="Attach a photo or document"
                          className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06] disabled:opacity-40"
                        >
                          <Plus className="size-6" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="top" className="w-48">
                        <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#007bfc] text-white">
                            <ImageIcon className="size-3.5" />
                          </span>
                          Photo
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => videoInputRef.current?.click()}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#ff2e74] text-white">
                            <VideoIcon className="size-3.5" />
                          </span>
                          Video (MP4)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => documentInputRef.current?.click()}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#7f66ff] text-white">
                            <FileText className="size-3.5" />
                          </span>
                          Document (PDF)
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStickersOpen(true)}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#ffbc38] text-white">
                            <StickerIcon className="size-3.5" />
                          </span>
                          Sticker
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setShareDialog('location')}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#1fa855] text-white">
                            <MapPin className="size-3.5" />
                          </span>
                          Location
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setShareDialog('contact')}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#009de2] text-white">
                            <UserRound className="size-3.5" />
                          </span>
                          Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={openSchedule}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#02a698] text-white">
                            <CalendarClock className="size-3.5" />
                          </span>
                          Schedule message
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="relative min-w-0 flex-1">
                      {qrOpen && !composerBlocked && (
                        <QuickReplySuggestions
                          matches={qrMatches}
                          activeIndex={Math.min(qrIndex, Math.max(0, qrMatches.length - 1))}
                          onPick={(r) => pickQuickReply(r, true)}
                          onManage={() => setManageQuickReplies('list')}
                        />
                      )}
                      <Textarea
                        ref={composerRef}
                        value={draft}
                        onKeyDown={onComposerKeyDown}
                        onChange={(e) => {
                          setDraft(e.target.value);
                          setQrIndex(0);
                        }}
                        placeholder={outsideWindow ? 'Template message…' : pendingMedia ? 'Add a caption' : 'Type a message'}
                        rows={1}
                        className="min-h-[42px] resize-none rounded-lg border-0 bg-white px-3 py-[10px] text-[15px] leading-[21px] text-[#111b21] shadow-none placeholder:text-[#667781] focus-visible:ring-0 focus-visible:ring-offset-0"
                        disabled={composerBlocked}
                      />
                    </div>
                    {(!!draft.trim() || !!pendingMedia || !!templateName) && (
                      <button
                        type="button"
                        onClick={openSchedule}
                        aria-label="Schedule message"
                        title="Schedule — send it later"
                        className="mb-0.5 hidden size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06] sm:flex"
                      >
                        <CalendarClock className="size-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={suggestMutation.isPending || composerBlocked}
                      onClick={() => suggestMutation.mutate()}
                      aria-label="Suggest a reply"
                      title="Suggest a reply with AI — you can edit before sending"
                      className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full text-[#54656f] transition-colors hover:bg-black/[0.06] disabled:opacity-40"
                    >
                      {suggestMutation.isPending ? <Spinner className="size-4" /> : <Sparkles className="size-5" />}
                    </button>
                    {!draft.trim() && !pendingMedia && !templateName && !sendMutation.isPending && canRecordVoice() ? (
                      // Nothing typed: the send button is a mic, like WhatsApp.
                      <button
                        type="button"
                        disabled={composerBlocked || uploadMutation.isPending}
                        onClick={() => setRecording(true)}
                        aria-label="Record a voice note"
                        title="Record a voice note"
                        className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm transition-all hover:bg-[#008f72] active:scale-95 disabled:bg-[#00a884]/40"
                      >
                        <Mic className="size-5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!canSend}
                        onClick={sendNow}
                        aria-label="Send message"
                        title="Send (Enter)"
                        className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm transition-all hover:bg-[#008f72] active:scale-95 disabled:bg-[#00a884]/40"
                      >
                        {sendMutation.isPending ? <Spinner className="size-4" /> : <Send className="size-[18px] translate-x-px" />}
                      </button>
                    )}
                  </div>
                ) : (
                  // Instagram: one rounded pill — text, photo button, blue "Send".
                  <div className="relative flex items-end gap-1 rounded-[22px] border border-[#dbdbdb] bg-white py-1 pl-4 pr-1.5 focus-within:border-[#a8a8a8]">
                    {qrOpen && !composerBlocked && (
                      <QuickReplySuggestions
                        matches={qrMatches}
                        activeIndex={Math.min(qrIndex, Math.max(0, qrMatches.length - 1))}
                        onPick={(r) => pickQuickReply(r, true)}
                        onManage={() => setManageQuickReplies('list')}
                      />
                    )}
                    <button
                      type="button"
                      disabled={composerBlocked || pendingMedia?.kind === 'image'}
                      onClick={() => setEmojiFor((f) => (f?.kind === 'insert' ? null : { kind: 'insert' }))}
                      aria-label="Emoji"
                      title="Emoji"
                      className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-[#000] transition-colors hover:bg-black/[0.05] disabled:opacity-40"
                    >
                      <Smile className="size-5" />
                    </button>
                    <Textarea
                      ref={composerRef}
                      value={draft}
                      onKeyDown={onComposerKeyDown}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setQrIndex(0);
                      }}
                      placeholder={pendingMedia?.kind === 'image' ? "Instagram photos can't have a caption" : 'Message…'}
                      rows={1}
                      className="min-h-[36px] flex-1 resize-none border-0 bg-transparent px-0 py-2 text-[15px] leading-5 text-[#000] shadow-none placeholder:text-[#737373] focus-visible:ring-0 focus-visible:ring-offset-0"
                      disabled={composerBlocked || pendingMedia?.kind === 'image'}
                    />
                    <button
                      type="button"
                      disabled={suggestMutation.isPending || composerBlocked}
                      onClick={() => suggestMutation.mutate()}
                      aria-label="Suggest a reply"
                      title="Suggest a reply with AI — you can edit before sending"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#000] transition-colors hover:bg-black/[0.05] disabled:opacity-40"
                    >
                      {suggestMutation.isPending ? <Spinner className="size-4" /> : <Sparkles className="size-5" />}
                    </button>
                    {canSend && (
                      <button
                        type="button"
                        onClick={openSchedule}
                        aria-label="Schedule message"
                        title="Schedule — send it later"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#000] transition-colors hover:bg-black/[0.05]"
                      >
                        <CalendarClock className="size-5" />
                      </button>
                    )}
                    {canSend ? (
                      <button
                        type="button"
                        onClick={sendNow}
                        className="h-9 shrink-0 px-2.5 text-sm font-semibold text-[#0095f6] transition-colors hover:text-[#00376b]"
                      >
                        {sendMutation.isPending ? <Spinner className="size-4" /> : 'Send'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={uploadMutation.isPending || composerBlocked}
                        onClick={() => imageInputRef.current?.click()}
                        aria-label="Send a photo"
                        title="Send a photo"
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#000] transition-colors hover:bg-black/[0.05] disabled:opacity-40"
                      >
                        <ImageIcon className="size-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {contactInfoOpen && (
                <ContactInfoPanel
                  conversation={{ ...selected, lead: (fromThread ?? listed)?.lead ?? selected.lead }}
                  channel={channel}
                  onClose={() => setContactInfoOpen(false)}
                  onShowStarred={() => setStarredOpen(true)}
                  onJump={(id) => {
                    if (!document.getElementById(`msg-${id}`)) return false;
                    setContactInfoOpen(false);
                    setTimeout(() => jumpToMessage(id), 50);
                    return true;
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>

      <GroupsDialog open={groupsOpen} onOpenChange={setGroupsOpen} channel={channel} onOpenChat={openChat} />

      {selectedId && selected && (
        <>
          <ScheduleDialog
            open={scheduleOpen}
            onOpenChange={setScheduleOpen}
            conversationId={selectedId}
            channel={channel}
            lastInboundAt={selected.lastInboundAt}
            draft={{
              body: draft,
              mediaUrl: pendingMedia?.url,
              mediaLabel: pendingMedia ? (pendingMedia.kind === 'image' ? 'Photo' : `${pendingMedia.kind === 'video' ? 'Video' : 'Document'} · ${pendingMedia.name}`) : undefined,
              templateName,
            }}
            onScheduled={() => {
              setDraft('');
              setPendingMedia(null);
              setTemplateName(null);
              setReplyingTo(null);
            }}
          />
          <ScheduledListDialog open={scheduledListOpen} onOpenChange={setScheduledListOpen} conversationId={selectedId} items={scheduledList} />
        </>
      )}

      {selectedId && (
        <ForwardDialog
          open={!!forwardIds}
          onOpenChange={(o) => !o && setForwardIds(null)}
          channel={channel}
          fromConversationId={selectedId}
          messageIds={forwardIds ?? []}
          onDone={() => setSelectedMsgs(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleteIds}
        onOpenChange={(o) => !o && setDeleteIds(null)}
        title={deleteIds && deleteIds.length > 1 ? `Delete ${deleteIds.length} messages?` : 'Delete this message?'}
        description="It's removed from this chat in the CRM for your whole team. The customer still has it on their phone."
        confirmLabel="Delete"
        destructive
        loading={bulkMutation.isPending}
        onConfirm={() => deleteIds && bulkMutation.mutate({ action: 'delete', ids: deleteIds })}
      />
      <LocationDialog
        open={shareDialog === 'location'}
        onOpenChange={(o) => !o && setShareDialog(null)}
        onSend={(location) => sendMutation.mutate({ location, replyToMessageId: replyingTo?.id })}
      />
      <ContactDialog
        open={shareDialog === 'contact'}
        onOpenChange={(o) => !o && setShareDialog(null)}
        onSend={(contact) => sendMutation.mutate({ contact, replyToMessageId: replyingTo?.id })}
      />

      {/* Message info */}
      <Dialog open={!!infoFor} onOpenChange={(o) => !o && setInfoFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Message info</DialogTitle>
            <DialogDescription>{infoQuery.data?.direction === 'INBOUND' ? 'Sent by the customer.' : 'When this message reached the customer.'}</DialogDescription>
          </DialogHeader>
          {infoQuery.isLoading || !infoQuery.data ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <MessageInfoRows info={infoQuery.data} wa={wa} />
          )}
        </DialogContent>
      </Dialog>

      {/* Starred messages of this chat */}
      <Dialog open={starredOpen} onOpenChange={setStarredOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="size-5 fill-amber-400 text-amber-400" /> Starred messages
            </DialogTitle>
            <DialogDescription>Only your team sees stars — the customer doesn’t.</DialogDescription>
          </DialogHeader>
          {starredQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (starredQuery.data ?? []).length === 0 ? (
            <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
              No starred messages in this chat yet. Use a message’s ⌄ menu → Star.
            </p>
          ) : (
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {(starredQuery.data ?? []).map((s) => (
                <li key={s.id} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    title="Go to this message"
                    onClick={() => {
                      setStarredOpen(false);
                      if (document.getElementById(`msg-${s.id}`)) setTimeout(() => jumpToMessage(s.id), 150);
                      else toast.info('That message is older than the ones shown in this chat');
                    }}
                  >
                    <span className="block text-xs font-medium text-muted-foreground">
                      {s.direction === 'OUTBOUND' ? 'You' : label} · {fullTime(s.createdAt)}
                    </span>
                    <span className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-foreground">{quotedText(s)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => starMutation.mutate({ id: s.id, starred: false })}
                    className="shrink-0 rounded-full p-1.5 text-amber-500 hover:bg-muted"
                    aria-label="Unstar"
                    title="Unstar"
                  >
                    <Star className="size-4 fill-current" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={summary !== null} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conversation summary</DialogTitle>
            <DialogDescription>Generated by AI — for a quick handoff, not shown to the traveller.</DialogDescription>
          </DialogHeader>
          <p className="whitespace-pre-line text-sm text-foreground">{summary}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
