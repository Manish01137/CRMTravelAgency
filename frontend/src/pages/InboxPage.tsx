import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  Inbox as InboxIcon,
  Instagram,
  MessageCircle,
  MailOpen,
  Paperclip,
  Phone,
  Search,
  Send,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ChannelMessage, Conversation, ConversationChannel, ConversationFilter, MessageTemplate } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { initials, formatSmartTime } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

// WhatsApp's own green — used only for the WhatsApp thread (header, bubbles,
// send button, wallpaper), so switching to the Instagram tab doesn't end up
// wearing WhatsApp's skin. Instagram keeps this app's existing neutral look.
const WA_HEADER = '#075E54';
const WA_SEND = '#00A884';
const WA_OUTBOUND_BUBBLE = '#D9FDD3';
const WA_COMPOSER_BG = '#F0F2F5';

/** A subtle tiled doodle, evoking (not copying) WhatsApp's chat wallpaper. */
const WA_WALLPAPER_STYLE: React.CSSProperties = {
  backgroundColor: '#E5DDD5',
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cg fill='none' stroke='%23000000' stroke-opacity='0.06' stroke-width='1.5'%3E%3Ccircle cx='20' cy='24' r='3'/%3E%3Cpath d='M88 92q10-18 20 0q-10 18-20 0'/%3E%3Cpath d='M34 78q8-14 16 0q-8 14-16 0'/%3E%3Ccircle cx='96' cy='28' r='2.5'/%3E%3Cpath d='M60 10v14M53 17h14'/%3E%3C/g%3E%3C/svg%3E\")",
  backgroundSize: '120px 120px',
};

/** No separate "media kind" column — a document is just a mediaUrl ending in
 *  .pdf, same convention the backend uses (see inbox.service.ts). */
const isPdfUrl = (url: string) => /\.pdf(?:[?#]|$)/i.test(url);

/** Recovers the human filename embedded in a document upload's storage key
 *  (see backend storage.ts) — works for both a just-sent and a re-fetched
 *  historical message, since it's derived purely from mediaUrl. */
function documentNameFromUrl(url: string): string {
  const last = url.split('/').pop() ?? 'document.pdf';
  const withoutQuery = last.split(/[?#]/)[0];
  return decodeURIComponent(withoutQuery.replace(/^\d+-[0-9a-f]+-/, '')) || 'document.pdf';
}

function statusIcon(status: ChannelMessage['status'], whatsapp: boolean) {
  const dim = whatsapp ? 'text-black/40' : 'text-white/70';
  const read = whatsapp ? 'text-sky-600' : 'text-sky-300';
  const failed = whatsapp ? 'text-red-600' : 'text-red-300';
  switch (status) {
    case 'QUEUED':
      return <Clock className={cn('size-3.5', dim)} />;
    case 'SENT':
      return <Check className={cn('size-3.5', dim)} />;
    case 'DELIVERED':
      return <CheckCheck className={cn('size-3.5', dim)} />;
    case 'READ':
      return <CheckCheck className={cn('size-3.5', read)} />;
    case 'FAILED':
      return <AlertCircle className={cn('size-3.5', failed)} />;
  }
}

function ConversationRow({
  c,
  active,
  onClick,
  onToggleFavorite,
}: {
  c: Conversation;
  active: boolean;
  onClick: () => void;
  onToggleFavorite: () => void;
}) {
  const label = c.contactName || c.contactPhone || c.externalContactId;
  return (
    <div className={cn('group relative border-b border-border', active && 'bg-primary/5')}>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 pr-9 text-left transition-colors hover:bg-muted/60">
        <Avatar>
          {c.contactAvatarUrl && <AvatarImage src={c.contactAvatarUrl} alt="" />}
          <AvatarFallback>{initials(label)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{label}</p>
            {c.lastMessageAt && <span className="shrink-0 text-[11px] text-muted-foreground">{formatSmartTime(c.lastMessageAt)}</span>}
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs text-muted-foreground">{c.lastMessagePreview || 'No messages yet'}</p>
            {c.unreadCount > 0 && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {c.unreadCount > 9 ? '9+' : c.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        aria-label={c.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        title={c.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        className={cn(
          'absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 transition-opacity',
          c.isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        <Star className={cn('size-4', c.isFavorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
      </button>
    </div>
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<ConversationChannel>('WHATSAPP');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; kind: 'image' | 'document'; name: string } | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', channel, filter, search],
    queryFn: () =>
      api.get<Conversation[]>(
        `/inbox/conversations?channel=${channel}&filter=${filter}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    refetchInterval: 8000,
  });

  const conversations = conversationsQuery.data ?? [];
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

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

  const sendMutation = useMutation({
    mutationFn: () =>
      api.post<ChannelMessage>(`/inbox/conversations/${selectedId}/messages`, {
        body: draft.trim() || undefined,
        mediaUrl: pendingMedia?.url || undefined,
        templateName: templateName || undefined,
      }),
    onSuccess: () => {
      setDraft('');
      setTemplateName(null);
      setPendingMedia(null);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Send failed'),
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

  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const handleImageSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // let picking the same file twice in a row still fire onChange
    if (file) uploadMutation.mutate({ file, kind: 'image' });
  };
  const handleDocumentSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadMutation.mutate({ file, kind: 'document' });
  };

  const pickTemplate = (name: string) => {
    const tpl = approvedTemplates.find((t) => t.name === name);
    setTemplateName(name);
    setDraft(tpl?.bodyText ?? '');
  };

  return (
    <div>
      <PageHeader title="Inbox" description="WhatsApp and Instagram conversations — auto-created from incoming messages." />

      {/* Channel switcher */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => setChannel('WHATSAPP')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
            channel === 'WHATSAPP' ? 'bg-emerald-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <MessageCircle className="size-4" /> WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setChannel('INSTAGRAM')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
            channel === 'INSTAGRAM' ? 'bg-pink-600 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Instagram className="size-4" /> Instagram
        </button>
      </div>

      <div className="grid h-[calc(100dvh-230px)] min-h-[520px] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card shadow-card sm:grid-cols-[300px_1fr]">
        {/* Conversation list */}
        <div className="flex min-h-0 flex-col border-b border-border sm:border-b-0 sm:border-r">
          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search conversations…"
                className="pl-9"
                aria-label="Search conversations"
              />
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'unread', label: 'Unread' },
                  { key: 'favorites', label: 'Favorites' },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={filter === 'favorites' ? <Star /> : filter === 'unread' ? <MailOpen /> : <InboxIcon />}
                title={filter === 'favorites' ? 'No favorites yet' : filter === 'unread' ? 'No unread conversations' : 'No conversations yet'}
                description={
                  filter === 'favorites'
                    ? 'Star a conversation to pin it here.'
                    : filter === 'unread'
                      ? "You're all caught up."
                      : `Incoming ${channel === 'WHATSAPP' ? 'WhatsApp messages' : 'Instagram DMs'} will show up here automatically.`
                }
                className="border-none"
              />
            ) : (
              conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  c={c}
                  active={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                  onToggleFavorite={() => favoriteMutation.mutate({ id: c.id, isFavorite: !c.isFavorite })}
                />
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="flex min-h-0 flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<InboxIcon />} title="Select a conversation" description="Pick a conversation from the list to view messages." className="border-none" />
            </div>
          ) : (
            <>
              <div
                className={cn('flex items-center justify-between gap-2 px-4 py-2.5', channel === 'WHATSAPP' ? 'text-white' : 'border-b border-border')}
                style={channel === 'WHATSAPP' ? { backgroundColor: WA_HEADER } : undefined}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className={channel === 'WHATSAPP' ? 'border border-white/25' : undefined}>
                    {selected.contactAvatarUrl && <AvatarImage src={selected.contactAvatarUrl} alt="" />}
                    <AvatarFallback className={channel === 'WHATSAPP' ? 'bg-white/15 text-white' : undefined}>
                      {initials(selected.contactName || selected.contactPhone || selected.externalContactId)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className={cn('truncate font-semibold', channel !== 'WHATSAPP' && 'text-foreground')}>
                      {selected.contactName || selected.contactPhone || selected.externalContactId}
                    </p>
                    {selected.contactPhone && selected.contactName && (
                      <p className={cn('truncate text-xs', channel === 'WHATSAPP' ? 'text-white/70' : 'text-muted-foreground')}>{selected.contactPhone}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {channel === 'WHATSAPP' && selected.contactPhone && (
                    <a
                      href={`tel:${selected.contactPhone}`}
                      onClick={() => logCallMutation.mutate()}
                      className="inline-flex size-9 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
                      aria-label="Call"
                      title={`Call ${selected.contactPhone}`}
                    >
                      <Phone className="size-4" />
                    </a>
                  )}
                  <Button
                    variant={channel === 'WHATSAPP' ? 'ghost' : 'outline'}
                    size="sm"
                    className={channel === 'WHATSAPP' ? 'text-white hover:bg-white/10 hover:text-white' : undefined}
                    disabled={summarizeMutation.isPending || (threadQuery.data?.messages.length ?? 0) === 0}
                    onClick={() => summarizeMutation.mutate()}
                  >
                    {summarizeMutation.isPending ? <Spinner className="size-4" /> : <FileText className="size-4" />} Summarize
                  </Button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5" style={channel === 'WHATSAPP' ? WA_WALLPAPER_STYLE : undefined}>
                {threadQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className={cn('h-12 max-w-[70%] rounded-2xl', i % 2 === 0 ? '' : 'ml-auto')} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(threadQuery.data?.messages ?? []).map((m) => {
                      const wa = channel === 'WHATSAPP';
                      const outboundTint = wa ? 'text-black/50' : 'text-white/70';
                      return (
                        <div key={m.id} className={cn('flex', m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                              m.direction === 'OUTBOUND' ? 'rounded-br-sm' : 'rounded-bl-sm',
                              m.direction === 'OUTBOUND'
                                ? wa
                                  ? 'text-[#111B21]'
                                  : 'bg-primary text-primary-foreground'
                                : wa
                                  ? 'bg-white text-[#111B21]'
                                  : 'bg-muted text-foreground',
                            )}
                            style={m.direction === 'OUTBOUND' && wa ? { backgroundColor: WA_OUTBOUND_BUBBLE } : undefined}
                          >
                            {m.templateName && (
                              <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', m.direction === 'OUTBOUND' ? outboundTint : 'text-muted-foreground')}>
                                Template: {m.templateName}
                              </p>
                            )}
                            {m.mediaUrl && isPdfUrl(m.mediaUrl) ? (
                              <a
                                href={m.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={cn(
                                  '-mx-1 -mt-1 mb-1 flex items-center gap-2.5 rounded-lg p-2.5',
                                  m.direction === 'OUTBOUND' ? 'bg-black/5' : 'bg-muted/60',
                                )}
                              >
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-red-500/15 text-red-600">
                                  <FileText className="size-5" />
                                </span>
                                <span className="min-w-0 truncate text-xs font-medium">{documentNameFromUrl(m.mediaUrl)}</span>
                              </a>
                            ) : (
                              m.mediaUrl && (
                                <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="-mx-1 -mt-1 mb-1 block">
                                  <img src={m.mediaUrl} alt="" className="max-h-64 w-full rounded-lg object-cover" />
                                </a>
                              )
                            )}
                            {m.body && <p className="whitespace-pre-line">{m.body}</p>}
                            <div className={cn('mt-1 flex items-center gap-1.5 text-[10px]', m.direction === 'OUTBOUND' ? cn('justify-end', outboundTint) : 'text-muted-foreground')}>
                              {formatSmartTime(m.createdAt)}
                              {m.direction === 'OUTBOUND' && statusIcon(m.status, wa)}
                            </div>
                            {m.status === 'FAILED' && m.errorMessage && (
                              <p className={cn('mt-1 text-[11px]', wa ? 'text-red-600' : 'text-red-200')}>{m.errorMessage}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-border p-3" style={channel === 'WHATSAPP' ? { backgroundColor: WA_COMPOSER_BG } : undefined}>
                {outsideWindow && (
                  <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    Outside the 24-hour window — send an approved template to restart the conversation.
                    {approvedTemplates.length > 0 ? (
                      <select
                        className="mt-1.5 block w-full rounded-md border border-amber-200 bg-white px-2 py-1.5 text-xs"
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
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                    {uploadMutation.isPending ? (
                      <div className="flex size-14 items-center justify-center rounded-md bg-muted">
                        <Spinner className="size-4" />
                      </div>
                    ) : pendingMedia!.kind === 'image' ? (
                      <img src={pendingMedia!.url} alt="" className="size-14 rounded-md object-cover" />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600">
                        <FileText className="size-6" />
                      </span>
                    )}
                    <p className="flex-1 truncate text-xs text-muted-foreground">
                      {uploadMutation.isPending ? 'Uploading…' : pendingMedia!.kind === 'image' ? 'Photo ready to send' : pendingMedia!.name}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      disabled={uploadMutation.isPending}
                      onClick={() => setPendingMedia(null)}
                      aria-label="Remove attachment"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelected} />
                  <input ref={documentInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleDocumentSelected} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        disabled={uploadMutation.isPending || (outsideWindow && !templateName)}
                        aria-label="Attach"
                        title="Attach a photo or document"
                      >
                        <Paperclip className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top">
                      <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
                        <ImageIcon className="text-blue-500" /> Photo
                      </DropdownMenuItem>
                      {channel === 'WHATSAPP' && (
                        <DropdownMenuItem onSelect={() => documentInputRef.current?.click()}>
                          <FileText className="text-red-500" /> Document (PDF)
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={
                      outsideWindow
                        ? 'Template message…'
                        : pendingMedia?.kind === 'image'
                          ? channel === 'INSTAGRAM'
                            ? "Instagram photos can't have a caption"
                            : 'Add a caption…'
                          : pendingMedia?.kind === 'document'
                            ? 'Add a caption…'
                            : 'Type a message…'
                    }
                    rows={2}
                    className="resize-none"
                    disabled={(outsideWindow && !templateName) || (pendingMedia?.kind === 'image' && channel === 'INSTAGRAM')}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={suggestMutation.isPending || (outsideWindow && !templateName)}
                    onClick={() => suggestMutation.mutate()}
                    aria-label="Suggest a reply"
                    title="Suggest a reply — you can edit before sending"
                  >
                    {suggestMutation.isPending ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                  </Button>
                  <Button
                    size="icon"
                    className={channel === 'WHATSAPP' ? 'text-white hover:opacity-90' : undefined}
                    style={channel === 'WHATSAPP' ? { backgroundColor: WA_SEND } : undefined}
                    disabled={(!draft.trim() && !pendingMedia) || sendMutation.isPending || (outsideWindow && !templateName)}
                    onClick={() => sendMutation.mutate()}
                    aria-label="Send message"
                  >
                    {sendMutation.isPending ? <Spinner className="size-4" /> : <Send className="size-4" />}
                  </Button>
                </div>
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
