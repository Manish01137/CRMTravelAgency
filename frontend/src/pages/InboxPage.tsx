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
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type {
  ChannelMessage,
  Conversation,
  ConversationChannel,
  ConversationFilter,
  ConversationStage,
  ConversationStageCounts,
  LeadStatus,
  MessageTemplate,
  User,
  ChatBotState,
  ChannelStatus,
  QuickReply,
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

/** No separate "media kind" column — a document is just a mediaUrl ending in
 *  .pdf, same convention the backend uses (see inbox.service.ts). */
const isPdfUrl = (url: string) => /\.pdf(?:[?#]|$)/i.test(url);
const isVideoUrl = (url: string) => /\.(mp4|mov|webm|3gp)(?:[?#]|$)/i.test(url);

/** Recovers the human filename embedded in a document upload's storage key
 *  (see backend storage.ts) — works for both a just-sent and a re-fetched
 *  historical message, since it's derived purely from mediaUrl. */
function documentNameFromUrl(url: string): string {
  const last = url.split('/').pop() ?? 'document.pdf';
  const withoutQuery = last.split(/[?#]/)[0];
  return decodeURIComponent(withoutQuery.replace(/^\d+-[0-9a-f]+-/, '')) || 'document.pdf';
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

/** A photo / video / PDF inside a bubble. */
function MessageMedia({ m, rounded }: { m: ChannelMessage; rounded: string }) {
  if (!m.mediaUrl) return null;
  if (isPdfUrl(m.mediaUrl)) {
    return (
      <a href={m.mediaUrl} target="_blank" rel="noreferrer" className={cn('mb-1 flex min-w-[200px] items-center gap-2.5 bg-black/[0.06] p-2.5 transition-colors hover:bg-black/[0.1]', rounded)}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#ff5c5c] text-[10px] font-bold text-white">PDF</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{documentNameFromUrl(m.mediaUrl)}</span>
      </a>
    );
  }
  if (isVideoUrl(m.mediaUrl)) {
    return <video src={m.mediaUrl} controls preload="metadata" className={cn('mb-1 block max-h-72 w-full bg-black', rounded)} />;
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

/** One WhatsApp message: green (sent) or white (received), tail on the first of a run, time + ticks inside. */
function WaBubble({ m, first }: { m: ChannelMessage; first: boolean }) {
  const out = m.direction === 'OUTBOUND';
  const meta = (
    <span className="float-right ml-2.5 mt-[3px] flex translate-y-[5px] items-center gap-[3px] text-[11px] leading-none text-[#667781]">
      {clockTime(m.createdAt)}
      {out && <WaTicks status={m.status} />}
    </span>
  );
  return (
    <div className={cn('flex flex-col', out ? 'items-end' : 'items-start', first ? 'mt-3' : 'mt-[2px]')}>
      <div
        className={cn(
          'relative max-w-[85%] rounded-[7.5px] px-[9px] pb-2 pt-1.5 text-[14.2px] leading-[19px] text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] sm:max-w-[65%]',
          out ? 'bg-[#d9fdd3]' : 'bg-white',
          first && (out ? 'rounded-tr-none' : 'rounded-tl-none'),
          m.mediaUrl && !isPdfUrl(m.mediaUrl) && 'p-[3px] pb-1.5',
        )}
      >
        {first && <BubbleTail outbound={out} />}
        {m.templateName && <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#008069]">Template · {m.templateName}</p>}
        <MessageMedia m={m} rounded="rounded-[6px]" />
        <div className={cn('after:block after:clear-both after:content-[""]', m.mediaUrl && !isPdfUrl(m.mediaUrl) && 'px-1.5')}>
          {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
          {meta}
        </div>
      </div>
      <FailedNote m={m} className={out ? 'text-right' : undefined} />
    </div>
  );
}

/**
 * One Instagram message: blue (sent) or grey (received) rounded bubbles that
 * join up in a run, their small photo beside the last of a run.
 */
function IgBubble({ m, first, last, contact, showStatus }: { m: ChannelMessage; first: boolean; last: boolean; contact: Conversation; showStatus: boolean }) {
  const out = m.direction === 'OUTBOUND';
  const mediaOnly = !!m.mediaUrl && !m.body && !isPdfUrl(m.mediaUrl);
  const corners = out
    ? cn('rounded-[22px]', !first && 'rounded-tr-[6px]', !last && 'rounded-br-[6px]')
    : cn('rounded-[22px]', !first && 'rounded-tl-[6px]', !last && 'rounded-bl-[6px]');
  return (
    <div className={cn('flex flex-col', out ? 'items-end' : 'items-start', first ? 'mt-3' : 'mt-[2px]')}>
      <div className={cn('flex max-w-full items-end gap-2', out && 'flex-row-reverse')}>
        {!out && (last ? <ContactAvatar c={contact} className="size-7" fallbackClassName="bg-[#efefef] text-[10px] text-[#262626]" /> : <span className="w-7 shrink-0" />)}
        <div
          title={clockTime(m.createdAt)}
          className={cn(
            'max-w-[78vw] text-[15px] leading-5 sm:max-w-[60%]',
            m.mediaUrl && isPdfUrl(m.mediaUrl) && 'min-w-[244px]',
            mediaOnly ? 'overflow-hidden' : 'px-3 py-2',
            mediaOnly ? corners : cn(corners, out ? 'bg-[#3797f0] text-white' : 'bg-[#efefef] text-[#000]'),
            m.status === 'QUEUED' && 'opacity-70',
          )}
        >
          {m.templateName && <p className="mb-0.5 text-[11px] font-semibold opacity-80">Template · {m.templateName}</p>}
          <MessageMedia m={m} rounded={mediaOnly ? corners : 'rounded-[14px]'} />
          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
        </div>
        {out && m.status === 'FAILED' && <AlertCircle className="mb-2 size-4 shrink-0 text-[#ed4956]" />}
      </div>
      <FailedNote m={m} className={cn('text-[#ed4956]', out ? 'text-right' : 'ml-9')} />
      {showStatus && m.status !== 'FAILED' && (
        <p className="mr-1 mt-1 text-[11px] text-[#737373]">{m.status === 'READ' ? 'Seen' : m.status === 'QUEUED' ? 'Sending…' : 'Sent'}</p>
      )}
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
  const [pendingMedia, setPendingMedia] = useState<{ url: string; kind: 'image' | 'document'; name: string } | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', channel, filter, stage, search],
    queryFn: () =>
      api.get<Conversation[]>(
        `/inbox/conversations?channel=${channel}&filter=${filter}${stage ? `&stage=${stage}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    refetchInterval: 8000,
  });

  const stageCountsQuery = useQuery({
    queryKey: ['conversations', 'stage-counts', channel],
    queryFn: () => api.get<ConversationStageCounts>(`/inbox/conversations/stage-counts?channel=${channel}`),
    refetchInterval: 15000,
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

  const threadQuery = useQuery({
    queryKey: ['messages', selectedId],
    queryFn: () => api.get<{ conversation: Conversation; messages: ChannelMessage[] }>(`/inbox/conversations/${selectedId}/messages`),
    enabled: !!selectedId,
    refetchInterval: 5000,
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
    refetchInterval: 8000,
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

  type SendVars = { body?: string; mediaUrl?: string; templateName?: string };
  type Thread = { conversation: Conversation; messages: ChannelMessage[] };
  const sendMutation = useMutation({
    mutationFn: (vars: SendVars) => api.post<ChannelMessage>(`/inbox/conversations/${selectedId}/messages`, vars),
    // The bubble shows straight away (clock icon) while it goes out; the server's
    // copy replaces it — SENT, or FAILED with the reason, which stays in the chat.
    onMutate: async (vars) => {
      const key = ['messages', selectedId];
      await queryClient.cancelQueries({ queryKey: key });
      const draftBefore = draft;
      queryClient.setQueryData<Thread>(key, (old) =>
        old
          ? {
              ...old,
              messages: [
                ...old.messages,
                {
                  id: `sending-${Date.now()}`,
                  conversationId: selectedId!,
                  direction: 'OUTBOUND',
                  externalMessageId: null,
                  body: vars.body ?? (vars.templateName ? `Template: ${vars.templateName}` : null),
                  mediaUrl: vars.mediaUrl ?? null,
                  templateName: vars.templateName ?? null,
                  status: 'QUEUED',
                  errorMessage: null,
                  sentById: me?.id ?? null,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : old,
      );
      setDraft('');
      setTemplateName(null);
      setPendingMedia(null);
      return { draftBefore };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    },
    onError: (err, _vars, context) => {
      toast.error(err instanceof ApiError ? err.message : 'Send failed');
      // Text back in the box, so it can be fixed and sent again.
      if (context?.draftBefore) setDraft((d) => d || context.draftBefore);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
      // No payment method on Meta → the banner shows right away.
      if (err instanceof ApiError && err.code === 'WHATSAPP_PAYMENT_REQUIRED') queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: 'image' | 'document' }) =>
      api.upload(kind === 'document' ? '/uploads/document' : '/uploads', file),
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
    });
  };
  // Enter sends, Shift+Enter is a new line (like WhatsApp Web) — on a computer; phones keep Enter for new lines.
  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleComposerKeyDown(e);
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
              {stageCounts && <span className={cn('text-xs', wa ? 'text-[#667781]' : 'text-[#737373]')}>{stageCounts.total} chats</span>}
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
            'min-h-0 flex-col',
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
                          {wa ? (
                            <WaBubble m={m} first={first} />
                          ) : (
                            <IgBubble m={m} first={first} last={last} contact={selected} showStatus={m.id === lastOutboundId} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Composer */}
              <div className={cn('shrink-0 px-2 pb-2 pt-2 sm:px-4', wa ? 'bg-[#f0f2f5]' : 'border-t border-[#efefef] bg-white')}>
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
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-[#ff5c5c] text-xs font-bold text-white">PDF</span>
                    )}
                    <p className="flex-1 truncate text-xs text-muted-foreground">
                      {uploadMutation.isPending ? 'Uploading…' : pendingMedia!.kind === 'image' ? 'Photo ready to send' : pendingMedia!.name}
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

                {wa ? (
                  // WhatsApp Web: + attach, white rounded box, round green send.
                  <div className="flex items-end gap-1 sm:gap-2">
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
                        <DropdownMenuItem onSelect={() => documentInputRef.current?.click()}>
                          <span className="flex size-7 items-center justify-center rounded-full bg-[#7f66ff] text-white">
                            <FileText className="size-3.5" />
                          </span>
                          Document (PDF)
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
            </>
          )}
        </div>
      </div>

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
