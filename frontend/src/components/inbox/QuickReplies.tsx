import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, Settings2, Sparkles, Trash2, UserRound, Zap } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { QuickReply } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Inbox quick replies, like WhatsApp Business: saved messages the team sends
 * often. Shown as one-tap buttons above the message box (no shortcut to
 * learn); typing "/" + the name also works. "{name}" becomes the customer's
 * first name.
 */

const NAME_TOKEN = '{name}';

/** Ready-made replies for a team that hasn't saved any yet. */
const STARTER_REPLIES: { title: string; message: string }[] = [
  { title: 'Greeting', message: 'Hi {name}! 👋 Thanks for reaching out. How can we help you plan your trip?' },
  {
    title: 'Ask trip details',
    message: 'Could you share your travel dates, number of travellers and the destination you have in mind? We’ll send you the best options 😊',
  },
  { title: 'Follow-up', message: 'Hi {name}, just checking in — did you get a chance to look at the package we shared? Happy to answer any questions.' },
  { title: 'Payment details', message: 'To confirm your booking, please pay the advance amount. We’ll share the payment details with you right away.' },
  { title: 'Thank you', message: 'Thank you, {name}! 🙏 Our team will get back to you shortly.' },
];

export function useQuickReplies() {
  return useQuery({ queryKey: ['quick-replies'], queryFn: () => api.get<QuickReply[]>('/quick-replies'), staleTime: 60_000 });
}

/** The message with "{name}" filled in (first name, or "there"). */
export function fillQuickReply(message: string, contactName: string | null | undefined): string {
  const first = contactName?.trim().split(/\s+/)[0];
  const name = first && !/^\+?\d[\d\s-]*$/.test(first) ? first : 'there';
  return message.replace(/\{\s*name\s*\}/gi, name);
}

/** The "/word" being typed at the end of the draft, if any (null when not typing a shortcut). */
export function slashQuery(draft: string): string | null {
  const m = draft.match(/(?:^|\s)\/([\p{L}\p{N}_-]*)$/u);
  return m ? m[1].toLowerCase() : null;
}

/** Replaces the "/word" at the end of the draft with the reply. */
export function insertQuickReply(draft: string, message: string): string {
  return draft.replace(/\/[\p{L}\p{N}_-]*$/u, message);
}

export function matchQuickReplies(replies: QuickReply[], query: string): QuickReply[] {
  if (!query) return replies;
  const q = query.replace(/-/g, ' ');
  const hit = (r: QuickReply) => r.shortcut.startsWith(query) || r.title.toLowerCase().startsWith(q);
  const starts = replies.filter(hit);
  const contains = replies.filter((r) => !hit(r) && (r.title.toLowerCase().includes(q) || r.message.toLowerCase().includes(q)));
  return [...starts, ...contains];
}

// --- One-tap buttons above the message box --------------------------------------

export function QuickReplyBar({
  disabled,
  contactName,
  onPick,
  onManage,
  onNew,
}: {
  disabled?: boolean;
  contactName: string | null | undefined;
  onPick: (reply: QuickReply) => void;
  onManage: () => void;
  onNew: () => void;
}) {
  const { data: replies, isLoading } = useQuickReplies();
  if (isLoading || !replies) return null;

  if (replies.length === 0) {
    return (
      <button
        type="button"
        onClick={onManage}
        className="mb-2 flex w-full items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/80 px-3 py-2 text-left text-xs text-amber-900 transition-colors hover:bg-amber-50"
      >
        <Zap className="size-4 shrink-0 text-amber-500" />
        <span>
          <b>Add quick replies</b> — save the answers you send often and send them with one tap.
        </span>
      </button>
    );
  }

  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground" title="Quick replies — tap one to put it in the message box">
        <Zap className="size-3.5 text-amber-500" />
        <span className="hidden lg:inline">Quick replies</span>
      </span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {replies.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(r)}
            title={fillQuickReply(r.message, contactName)}
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-sm transition-all',
              'hover:-translate-y-px hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:translate-y-0',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {r.title}
          </button>
        ))}
        <button
          type="button"
          onClick={onNew}
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="size-3.5" /> New
        </button>
      </div>
      <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground" onClick={onManage} aria-label="Manage quick replies" title="Manage quick replies">
        <Settings2 className="size-4" />
      </Button>
    </div>
  );
}

// --- "/" suggestions while typing ----------------------------------------------

export function QuickReplySuggestions({
  matches,
  activeIndex,
  onPick,
  onManage,
}: {
  matches: QuickReply[];
  activeIndex: number;
  onPick: (reply: QuickReply) => void;
  onManage: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-pop">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Zap className="size-3.5 text-amber-500" /> Quick replies
        </span>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={onManage} className="text-xs font-medium text-primary hover:underline">
          Manage
        </button>
      </div>
      {matches.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">No quick reply matches — press Manage to add one.</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto py-1" role="listbox">
          {matches.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                // Keep focus in the message box.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(r)}
                className={cn('flex w-full flex-col gap-0.5 px-3 py-2 text-left', i === activeIndex ? 'bg-primary/10' : 'hover:bg-muted/60')}
              >
                <span className="text-xs font-semibold text-foreground">{r.title}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{r.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border px-3 py-1 text-[10px] text-muted-foreground">↑ ↓ to choose · Enter to insert · Esc to close</p>
    </div>
  );
}

// --- Manage ---------------------------------------------------------------------

/** Add, edit and delete the team's quick replies. `startNew` opens straight on a new one. */
export function ManageQuickRepliesDialog({
  open,
  onOpenChange,
  startNew = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startNew?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: replies = [], isLoading } = useQuickReplies();
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // Opening from "+ New" goes straight to the form; otherwise to the list.
  useEffect(() => {
    if (!open) return;
    setConfirmDelete(null);
    if (startNew) startEdit('new');
    else setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function startEdit(r: QuickReply | 'new') {
    setEditing(r);
    setTitle(r === 'new' ? '' : r.title);
    setMessage(r === 'new' ? '' : r.message);
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
  const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

  const save = useMutation({
    mutationFn: () =>
      editing && editing !== 'new'
        ? api.patch<QuickReply>(`/quick-replies/${editing.id}`, { title, message })
        : api.post<QuickReply>('/quick-replies', { title, message }),
    onSuccess: () => {
      toast.success('Quick reply saved');
      setEditing(null);
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the quick reply')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/quick-replies/${id}`),
    onSuccess: () => {
      toast.success('Quick reply deleted');
      setConfirmDelete(null);
      refresh();
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the quick reply')),
  });
  const addStarters = useMutation({
    mutationFn: async () => {
      for (const r of STARTER_REPLIES) await api.post('/quick-replies', r).catch(() => undefined); // skip any name already taken
    },
    onSuccess: () => {
      toast.success('Starter quick replies added — edit them any time');
      refresh();
    },
  });

  /** Puts {name} where the cursor is. */
  const insertName = () => {
    const el = messageRef.current;
    const at = el?.selectionStart ?? message.length;
    const next = message.slice(0, at) + NAME_TOKEN + message.slice(el?.selectionEnd ?? at);
    setMessage(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + NAME_TOKEN.length, at + NAME_TOKEN.length);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setEditing(null);
          setConfirmDelete(null);
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-5 text-amber-500" /> Quick replies
          </DialogTitle>
          <DialogDescription>Save messages your team sends often. They show as buttons above the message box — one tap puts the message in, ready to send.</DialogDescription>
        </DialogHeader>

        {editing ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <button type="button" onClick={() => setEditing(null)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" /> All quick replies
            </button>
            <div className="space-y-1.5">
              <label htmlFor="qr-title" className="text-sm font-medium">
                Button name
              </label>
              <Input id="qr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Price list" maxLength={40} autoFocus />
              <p className="text-xs text-muted-foreground">Short — it’s what you’ll tap in the chat.</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="qr-message" className="text-sm font-medium">
                  Message
                </label>
                <button
                  type="button"
                  onClick={insertName}
                  className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/5"
                >
                  <UserRound className="size-3.5" /> Insert customer name
                </button>
              </div>
              <Textarea
                id="qr-message"
                ref={messageRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4096}
                placeholder="Hi {name}! Our Manali package starts at ₹18,999 per person for 5 days…"
              />
            </div>
            {message.trim() && (
              <div className="rounded-xl bg-[#efeae2] p-3">
                <p className="mb-1.5 text-[11px] font-medium text-black/50">Preview</p>
                <div className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tr-none bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21] shadow-sm">
                  {fillQuickReply(message, 'Rahul Sharma')}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || !message.trim() || save.isPending}>
                {save.isPending && <Spinner className="size-4" />} Save quick reply
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : replies.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                <Zap className="mx-auto size-8 text-amber-400" />
                <p className="mt-2 text-sm font-medium text-foreground">No quick replies yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Start with our ready-made ones and edit them, or write your own.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button variant="outline" onClick={() => addStarters.mutate()} disabled={addStarters.isPending}>
                    {addStarters.isPending ? <Spinner className="size-4" /> : <Sparkles className="size-4" />} Add starter replies
                  </Button>
                  <Button onClick={() => startEdit('new')}>
                    <Plus className="size-4" /> Write my own
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                  {replies.map((r) => (
                    <li key={r.id} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/30">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                        <Zap className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">{r.title}</p>
                        <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{r.message}</p>
                      </div>
                      {confirmDelete === r.id ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>
                            Delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                            Keep
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 gap-0.5">
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${r.title}`} onClick={() => startEdit(r)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${r.title}`}
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(r.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Tip: you can also type <b>/</b> in the message box to search them.
                  </p>
                  <Button onClick={() => startEdit('new')}>
                    <Plus className="size-4" /> Add quick reply
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
