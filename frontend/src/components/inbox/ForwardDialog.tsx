import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Forward, Search } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { initials } from '@/lib/format';
import type { Conversation, ConversationChannel } from '@/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const HOUR = 60 * 60 * 1000;
const MAX_TARGETS = 5;

type ForwardResult = { conversationId: string; sent: number; error?: string };

/** Pick up to 5 chats (same channel) to forward messages to. */
export function ForwardDialog({
  open,
  onOpenChange,
  channel,
  fromConversationId,
  messageIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: ConversationChannel;
  fromConversationId: string;
  messageIds: string[];
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const chats = useQuery({
    queryKey: ['conversations', channel, 'forward'],
    queryFn: () => api.get<Conversation[]>(`/inbox/conversations?channel=${channel}&filter=all`),
    enabled: open,
    staleTime: 30_000,
  });

  // WhatsApp only accepts a normal message within 24h of the customer's last one; Instagram a team reply up to 7 days.
  const windowMs = channel === 'WHATSAPP' ? 24 * HOUR : 7 * 24 * HOUR;
  const closed = (c: Conversation) => !c.lastInboundAt || Date.now() - new Date(c.lastInboundAt).getTime() > windowMs;
  const nameOf = (c: Conversation) => c.contactName || c.contactPhone || c.externalContactId;

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (chats.data ?? [])
      .filter((c) => c.id !== fromConversationId)
      .filter((c) => !q || nameOf(c).toLowerCase().includes(q) || (c.contactPhone ?? '').includes(q));
  }, [chats.data, search, fromConversationId]);

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setPicked([]);
      setSearch('');
    }
  };

  const forward = useMutation({
    mutationFn: () => api.post<ForwardResult[]>('/inbox/forward', { fromConversationId, messageIds, toConversationIds: picked }),
    onSuccess: (results) => {
      const ok = results.filter((r) => !r.error);
      const failed = results.filter((r) => r.error);
      const name = (id: string) => {
        const c = chats.data?.find((x) => x.id === id);
        return c ? nameOf(c) : 'a chat';
      };
      if (ok.length) toast.success(`Forwarded to ${ok.length === 1 ? name(ok[0].conversationId) : `${ok.length} chats`}`);
      for (const f of failed) toast.error(`${name(f.conversationId)}: ${f.error}`);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (ok.length) {
        close(false);
        onDone?.();
      }
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not forward'),
  });

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_TARGETS ? (toast.info(`Forward to up to ${MAX_TARGETS} chats at a time`), p) : [...p, id]));

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="size-5" /> Forward {messageIds.length === 1 ? 'message' : `${messageIds.length} messages`}
          </DialogTitle>
          <DialogDescription>Sent as new messages from your number. Choose up to {MAX_TARGETS} chats.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="h-9 w-full rounded-lg bg-muted pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <ul className="-mx-1 max-h-[45vh] min-h-[140px] overflow-y-auto px-1">
          {chats.isLoading ? (
            <li className="flex justify-center py-8">
              <Spinner />
            </li>
          ) : list.length === 0 ? (
            <li className="py-8 text-center text-sm text-muted-foreground">No chats found.</li>
          ) : (
            list.map((c) => {
              const isClosed = closed(c);
              const on = picked.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={isClosed}
                    onClick={() => toggle(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                      isClosed ? 'cursor-not-allowed opacity-50' : on ? 'bg-primary/10' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full border', on ? 'border-[#00a884] bg-[#00a884] text-white' : 'border-muted-foreground/40')}>
                      {on && <Check className="size-3.5" />}
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{initials(nameOf(c))}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{nameOf(c)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {isClosed ? (channel === 'WHATSAPP' ? 'Over 24 hours since their last message' : 'Over 7 days since their last message') : c.lastMessagePreview || c.contactPhone || ''}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button disabled={picked.length === 0 || forward.isPending} onClick={() => forward.mutate()}>
            {forward.isPending ? <Spinner className="size-4" /> : <Forward className="size-4" />}
            Forward{picked.length ? ` to ${picked.length}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
