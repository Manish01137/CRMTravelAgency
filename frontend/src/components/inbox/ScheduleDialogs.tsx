import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertCircle, CalendarClock, Clock, Pencil, Send, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ConversationChannel, ScheduledMessage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const HOUR = 60 * 60 * 1000;

/** "Today, 6:30 pm" / "Tomorrow, 9:00 am" / "Fri 14 Nov, 9:00 am". */
export function whenLabel(iso: string | Date): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / (24 * HOUR));
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

/** <input type="datetime-local"> value for a Date (local time). */
const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const at = (daysAhead: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/** When a normal (non-template) message can still reach this customer. */
function windowCloses(channel: ConversationChannel, lastInboundAt: string | null): Date | null {
  if (!lastInboundAt) return new Date(0);
  return new Date(new Date(lastInboundAt).getTime() + (channel === 'WHATSAPP' ? 24 : 7 * 24) * HOUR);
}

export type ScheduleDraft = { body: string; mediaUrl?: string; mediaLabel?: string; templateName?: string | null };

/** Pick a time (quick choices or any date & time) and schedule what's in the message box. */
export function ScheduleDialog({
  open,
  onOpenChange,
  conversationId,
  channel,
  lastInboundAt,
  draft,
  onScheduled,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string;
  channel: ConversationChannel;
  lastInboundAt: string | null;
  draft: ScheduleDraft;
  onScheduled: () => void;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState(draft.body);
  const [when, setWhen] = useState('');
  useEffect(() => {
    if (!open) return;
    setBody(draft.body);
    setWhen(toLocalInput(new Date(Date.now() + HOUR)));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choices = useMemo(() => {
    const now = Date.now();
    const list = [
      { label: 'In 1 hour', date: new Date(now + HOUR) },
      { label: 'This evening, 7 pm', date: at(0, 19) },
      { label: 'Tomorrow, 9 am', date: at(1, 9) },
      { label: 'Tomorrow, 6 pm', date: at(1, 18) },
    ];
    return list.filter((c) => c.date.getTime() > now + 5 * 60_000);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendAt = when ? new Date(when) : null;
  const closes = windowCloses(channel, lastInboundAt);
  const tooLate = !!sendAt && !draft.templateName && !!closes && sendAt > closes;
  const inPast = !!sendAt && sendAt.getTime() < Date.now() + 60_000;
  const empty = !body.trim() && !draft.mediaUrl && !draft.templateName;

  const schedule = useMutation({
    mutationFn: () =>
      api.post<ScheduledMessage>(`/inbox/conversations/${conversationId}/scheduled`, {
        sendAt: sendAt!.toISOString(),
        message: { body: body.trim() || undefined, mediaUrl: draft.mediaUrl, templateName: draft.templateName || undefined },
      }),
    onSuccess: (s) => {
      toast.success(`Scheduled for ${whenLabel(s.sendAt)}`);
      queryClient.invalidateQueries({ queryKey: ['scheduled', conversationId] });
      onOpenChange(false);
      onScheduled();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Could not schedule'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[#00a884]" /> Schedule message
          </DialogTitle>
          <DialogDescription>It’s sent automatically at the time you pick — from your number, as you.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {draft.templateName && <p className="text-xs font-semibold uppercase tracking-wide text-[#008069]">Template · {draft.templateName}</p>}
          {draft.mediaLabel && <p className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">Attached: {draft.mediaLabel}</p>}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={draft.mediaUrl ? 'Caption (optional)' : 'Type the message'}
            rows={3}
            readOnly={!!draft.templateName}
            className="resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {choices.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setWhen(toLocalInput(c.date))}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  when === toLocalInput(c.date) ? 'border-[#00a884] bg-[#00a884]/10 text-[#008069]' : 'border-border text-foreground hover:bg-muted',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-muted-foreground">
            Date & time
            <Input type="datetime-local" value={when} min={toLocalInput(new Date())} onChange={(e) => setWhen(e.target.value)} className="mt-1" />
          </label>
          {sendAt && !inPast && <p className="text-sm text-foreground">Sends {whenLabel(sendAt)}</p>}
          {inPast && <p className="text-xs text-destructive">Pick a time at least a minute from now.</p>}
          {tooLate && (
            <p className="flex gap-1.5 rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
              <AlertCircle className="mt-px size-3.5 shrink-0" />
              {channel === 'WHATSAPP'
                ? `WhatsApp only delivers normal messages within 24 hours of the customer’s last message — this chat’s window closes ${closes && closes.getTime() > Date.now() ? whenLabel(closes) : 'now'}. Pick an earlier time, or schedule an approved template.`
                : `Instagram only accepts replies up to 7 days after the customer’s last message — that ends ${closes && closes.getTime() > Date.now() ? whenLabel(closes) : 'now'}.`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!sendAt || inPast || tooLate || empty || schedule.isPending} onClick={() => schedule.mutate()}>
            {schedule.isPending ? <Spinner className="size-4" /> : <CalendarClock className="size-4" />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The bar above the message box: "2 scheduled · next Tomorrow, 9:00 am". */
export function ScheduledStrip({ items, onOpen, wa }: { items: ScheduledMessage[]; onOpen: () => void; wa: boolean }) {
  const failed = items.filter((s) => s.status === 'FAILED');
  const waiting = items.filter((s) => s.status !== 'FAILED');
  if (items.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[12.5px] shadow-sm transition-colors',
        failed.length ? 'bg-red-50 text-red-800 hover:bg-red-100' : wa ? 'bg-white text-[#54656f] hover:bg-[#f5f6f6]' : 'bg-[#efefef] text-[#262626] hover:bg-[#e5e5e5]',
      )}
    >
      {failed.length ? <AlertCircle className="size-4 shrink-0" /> : <Clock className="size-4 shrink-0 text-[#00a884]" />}
      <span className="min-w-0 flex-1 truncate">
        {failed.length
          ? `${failed.length} scheduled message${failed.length === 1 ? '' : 's'} couldn’t be sent`
          : `${waiting.length} scheduled · next ${whenLabel(waiting[0].sendAt)} — ${waiting[0].preview}`}
      </span>
      <span className="shrink-0 font-semibold">View</span>
    </button>
  );
}

/** Every waiting / failed scheduled message of this chat: send now, change time or text, cancel. */
export function ScheduledListDialog({
  open,
  onOpenChange,
  conversationId,
  items,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conversationId: string;
  items: ScheduledMessage[];
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; when: string; originalWhen: string; body: string | null } | null>(null);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['scheduled', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };
  const fail = (fallback: string) => (err: unknown) => {
    toast.error(err instanceof ApiError ? err.message : fallback);
    refresh();
  };
  const sendNow = useMutation({
    mutationFn: (id: string) => api.post(`/inbox/conversations/${conversationId}/scheduled/${id}/send`, {}),
    onSuccess: () => {
      toast.success('Sent');
      refresh();
    },
    onError: fail('Could not send'),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.delete(`/inbox/conversations/${conversationId}/scheduled/${id}`),
    onSuccess: () => {
      toast.success('Removed');
      refresh();
    },
    onError: fail('Could not cancel'),
  });
  const save = useMutation({
    mutationFn: (e: NonNullable<typeof editing>) =>
      api.patch(`/inbox/conversations/${conversationId}/scheduled/${e.id}`, {
        ...(e.when !== e.originalWhen && { sendAt: new Date(e.when).toISOString() }),
        ...(e.body !== null && { body: e.body }),
      }),
    onSuccess: () => {
      toast.success('Updated');
      setEditing(null);
      refresh();
    },
    onError: fail('Could not update'),
  });
  const busy = sendNow.isPending || cancel.isPending || save.isPending;

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
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="size-5 text-[#00a884]" /> Scheduled messages
          </DialogTitle>
          <DialogDescription>Sent automatically at their time. Only your team sees this list.</DialogDescription>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">Nothing scheduled in this chat.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {items.map((s) => {
              const isEditing = editing?.id === s.id;
              const textOnly = !s.payload.templateName && !s.payload.location && !s.payload.contact;
              return (
                <li key={s.id} className={cn('rounded-lg border p-3', s.status === 'FAILED' ? 'border-red-200 bg-red-50/60' : 'border-border')}>
                  <div className="flex items-center gap-2 text-xs">
                    {s.status === 'FAILED' ? (
                      <span className="font-semibold text-red-700">Not sent · was {whenLabel(s.sendAt)}</span>
                    ) : s.status === 'SENDING' ? (
                      <span className="font-semibold text-[#008069]">Sending…</span>
                    ) : (
                      <span className="font-semibold text-[#008069]">{whenLabel(s.sendAt)}</span>
                    )}
                    <span className="ml-auto truncate text-muted-foreground">by {s.createdBy?.name ?? 'a former teammate'}</span>
                  </div>
                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      {editing.body !== null && (
                        <Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} rows={3} className="resize-none" />
                      )}
                      <Input type="datetime-local" value={editing.when} min={toLocalInput(new Date())} onChange={(e) => setEditing({ ...editing, when: e.target.value })} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" disabled={busy || !editing.when || (editing.body !== null && !editing.body.trim())} onClick={() => save.mutate(editing)}>
                          {save.isPending && <Spinner className="size-4" />} Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-foreground">{s.preview}</p>
                      {s.errorMessage && s.status === 'FAILED' && <p className="mt-1 text-xs text-red-700">{s.errorMessage}</p>}
                      {s.status !== 'SENDING' && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => sendNow.mutate(s.id)}>
                            {sendNow.isPending && sendNow.variables === s.id ? <Spinner className="size-3.5" /> : <Send className="size-3.5" />}
                            {s.status === 'FAILED' ? 'Try again now' : 'Send now'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            disabled={busy}
                            onClick={() => {
                              // Still ahead → keep its time; already past (failed) → suggest an hour from now.
                              const ahead = new Date(s.sendAt).getTime() > Date.now() + 2 * 60_000;
                              const original = toLocalInput(new Date(s.sendAt));
                              setEditing({
                                id: s.id,
                                when: ahead ? original : toLocalInput(new Date(Date.now() + HOUR)),
                                originalWhen: ahead ? original : '',
                                body: textOnly && s.status === 'PENDING' ? (s.payload.body ?? '') : null,
                              });
                            }}
                          >
                            <Pencil className="size-3.5" /> {s.status === 'FAILED' ? 'New time' : 'Edit'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" disabled={busy} onClick={() => cancel.mutate(s.id)}>
                            {s.status === 'FAILED' ? <X className="size-3.5" /> : <Trash2 className="size-3.5" />}
                            {s.status === 'FAILED' ? 'Dismiss' : 'Cancel'}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
