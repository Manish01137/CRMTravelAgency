import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Inbox as InboxIcon,
  Instagram,
  MessageCircle,
  Search,
  Send,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ChannelMessage, Conversation, ConversationChannel, MessageTemplate } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { initials, formatSmartTime } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

function statusIcon(status: ChannelMessage['status']) {
  switch (status) {
    case 'QUEUED':
      return <Clock className="size-3.5 text-white/70" />;
    case 'SENT':
      return <Check className="size-3.5 text-white/70" />;
    case 'DELIVERED':
      return <CheckCheck className="size-3.5 text-white/70" />;
    case 'READ':
      return <CheckCheck className="size-3.5 text-sky-300" />;
    case 'FAILED':
      return <AlertCircle className="size-3.5 text-red-300" />;
  }
}

function ConversationRow({ c, active, onClick }: { c: Conversation; active: boolean; onClick: () => void }) {
  const label = c.contactName || c.contactPhone || c.externalContactId;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/60',
        active && 'bg-primary/5',
      )}
    >
      <Avatar>
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
  );
}

export function InboxPage() {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<ConversationChannel>('WHATSAPP');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [templateName, setTemplateName] = useState<string | null>(null);

  const conversationsQuery = useQuery({
    queryKey: ['conversations', channel, search],
    queryFn: () =>
      api.get<Conversation[]>(
        `/inbox/conversations?channel=${channel}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
    refetchInterval: 8000,
  });

  const conversations = conversationsQuery.data ?? [];
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Switching channels drops the selection — the two channels are entirely separate threads.
  useEffect(() => {
    setSelectedId(null);
    setDraft('');
    setTemplateName(null);
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
        body: draft.trim(),
        templateName: templateName || undefined,
      }),
    onSuccess: () => {
      setDraft('');
      setTemplateName(null);
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations', channel] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Send failed'),
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
        <div className="flex flex-col border-b border-border sm:border-b-0 sm:border-r">
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
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsQuery.isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <EmptyState
                icon={<InboxIcon />}
                title="No conversations yet"
                description={`Incoming ${channel === 'WHATSAPP' ? 'WhatsApp messages' : 'Instagram DMs'} will show up here automatically.`}
                className="border-none"
              />
            ) : (
              conversations.map((c) => (
                <ConversationRow key={c.id} c={c} active={c.id === selectedId} onClick={() => setSelectedId(c.id)} />
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
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
                <div>
                  <p className="font-semibold text-foreground">{selected.contactName || selected.contactPhone || selected.externalContactId}</p>
                  {selected.contactPhone && selected.contactName && <p className="text-xs text-muted-foreground">{selected.contactPhone}</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={summarizeMutation.isPending || (threadQuery.data?.messages.length ?? 0) === 0}
                  onClick={() => summarizeMutation.mutate()}
                >
                  {summarizeMutation.isPending ? <Spinner className="size-4" /> : <FileText className="size-4" />} Summarize
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {threadQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className={cn('h-12 max-w-[70%] rounded-2xl', i % 2 === 0 ? '' : 'ml-auto')} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(threadQuery.data?.messages ?? []).map((m) => (
                      <div key={m.id} className={cn('flex', m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start')}>
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                            m.direction === 'OUTBOUND'
                              ? 'rounded-br-sm bg-primary text-primary-foreground'
                              : 'rounded-bl-sm bg-muted text-foreground',
                          )}
                        >
                          {m.templateName && (
                            <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', m.direction === 'OUTBOUND' ? 'text-white/70' : 'text-muted-foreground')}>
                              Template: {m.templateName}
                            </p>
                          )}
                          <p className="whitespace-pre-line">{m.body}</p>
                          <div className={cn('mt-1 flex items-center gap-1.5 text-[10px]', m.direction === 'OUTBOUND' ? 'justify-end text-white/70' : 'text-muted-foreground')}>
                            {formatSmartTime(m.createdAt)}
                            {m.direction === 'OUTBOUND' && statusIcon(m.status)}
                          </div>
                          {m.status === 'FAILED' && m.errorMessage && (
                            <p className="mt-1 text-[11px] text-red-200">{m.errorMessage}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border p-3">
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
                <div className="flex items-end gap-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={outsideWindow ? 'Template message…' : 'Type a message…'}
                    rows={2}
                    className="resize-none"
                    disabled={outsideWindow && !templateName}
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
                    disabled={!draft.trim() || sendMutation.isPending || (outsideWindow && !templateName)}
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
