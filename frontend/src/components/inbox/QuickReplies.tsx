import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Settings2, Trash2, Zap } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { QuickReply } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Inbox quick replies, like WhatsApp Business: saved messages dropped into a
 * chat by typing "/" + the shortcut, or picked from the ⚡ menu. "{name}"
 * becomes the customer's first name.
 */

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
  const starts = replies.filter((r) => r.shortcut.startsWith(query));
  const contains = replies.filter((r) => !r.shortcut.startsWith(query) && (r.shortcut.includes(query) || r.message.toLowerCase().includes(query)));
  return [...starts, ...contains];
}

/** The suggestion list shown above the message box while typing "/…". */
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
    <div className="absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-lg border border-border bg-card shadow-pop">
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
                className={cn('flex w-full items-start gap-3 px-3 py-2 text-left', i === activeIndex ? 'bg-primary/10' : 'hover:bg-muted/60')}
              >
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground">/{r.shortcut}</span>
                <span className="line-clamp-2 min-w-0 text-xs text-muted-foreground">{r.message}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border px-3 py-1 text-[10px] text-muted-foreground">↑ ↓ to choose · Enter or Tab to insert · Esc to close</p>
    </div>
  );
}

/** ⚡ next to the message box: every quick reply, plus "Manage". */
export function QuickRepliesButton({
  disabled,
  onPick,
  onManage,
}: {
  disabled?: boolean;
  onPick: (reply: QuickReply) => void;
  onManage: () => void;
}) {
  const { data: replies = [] } = useQuickReplies();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={disabled} aria-label="Quick replies" title='Quick replies — or type "/" in the message box'>
          <Zap className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="max-h-80 w-72 overflow-y-auto">
        {replies.map((r) => (
          <DropdownMenuItem key={r.id} onSelect={() => onPick(r)} className="flex-col items-start gap-0.5">
            <span className="font-mono text-xs font-semibold">/{r.shortcut}</span>
            <span className="line-clamp-2 text-xs text-muted-foreground">{r.message}</span>
          </DropdownMenuItem>
        ))}
        {replies.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem onSelect={onManage}>
          <Settings2 className="size-4" /> {replies.length ? 'Manage quick replies' : 'Create your first quick reply'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Add, edit and delete the team's quick replies. */
export function ManageQuickRepliesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: replies = [], isLoading } = useQuickReplies();
  const [editing, setEditing] = useState<QuickReply | 'new' | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');

  const startEdit = (r: QuickReply | 'new') => {
    setEditing(r);
    setShortcut(r === 'new' ? '' : r.shortcut);
    setMessage(r === 'new' ? '' : r.message);
  };
  const done = () => {
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ['quick-replies'] });
  };
  const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

  const save = useMutation({
    mutationFn: () =>
      editing && editing !== 'new'
        ? api.patch<QuickReply>(`/quick-replies/${editing.id}`, { shortcut, message })
        : api.post<QuickReply>('/quick-replies', { shortcut, message }),
    onSuccess: () => {
      toast.success('Quick reply saved');
      done();
    },
    onError: (err) => toast.error(errorText(err, 'Could not save the quick reply')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/quick-replies/${id}`),
    onSuccess: () => {
      toast.success('Quick reply deleted');
      done();
    },
    onError: (err) => toast.error(errorText(err, 'Could not delete the quick reply')),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setEditing(null);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick replies</DialogTitle>
          <DialogDescription>
            Saved messages for the whole team. In a chat, type <b>/</b> and the shortcut (e.g. <b>/price</b>) to insert one. Write <b>{'{name}'}</b> to
            use the customer’s first name.
          </DialogDescription>
        </DialogHeader>

        {editing ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="qr-shortcut" className="text-sm font-medium">
                Shortcut
              </label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm text-muted-foreground">/</span>
                <Input id="qr-shortcut" value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="price" maxLength={31} autoFocus />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="qr-message" className="text-sm font-medium">
                Message
              </label>
              <Textarea
                id="qr-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={4096}
                placeholder={'Hi {name}! Our Manali package starts at ₹18,999 per person for 5 days…'}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!shortcut.trim() || !message.trim() || save.isPending}>
                {save.isPending && <Spinner className="size-4" />} Save
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : replies.length === 0 ? (
              <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">No quick replies yet.</p>
            ) : (
              <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {replies.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm font-semibold">/{r.shortcut}</p>
                      <p className="line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{r.message}</p>
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => startEdit(r)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button onClick={() => startEdit('new')}>
              <Plus className="size-4" /> Add quick reply
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
