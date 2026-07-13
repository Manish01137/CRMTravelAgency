import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { BellRing, CalendarDays, ChevronLeft, ChevronRight, Plane, PlaneLanding, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CalendarFeed } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { bookingRef } from '@/lib/crmMeta';

interface DayEntry {
  key: string;
  kind: 'departure' | 'return' | 'event' | 'task';
  label: string;
  sub?: string;
  color: string;
  link?: string;
  eventId?: string;
}

function EventForm({ defaultDate, onDone }: { defaultDate: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<{ title: string; date: string; notes: string }>({
    defaultValues: { title: '', date: defaultDate, notes: '' },
  });
  const mutation = useMutation({
    mutationFn: (v: { title: string; date: string; notes: string }) =>
      api.post('/calendar/events', { title: v.title.trim(), date: v.date, notes: v.notes.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Event added');
      onDone();
    },
    onError: () => toast.error('Could not add event'),
  });
  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
      <Field label="Title" htmlFor="evTitle" error={errors.title?.message} required>
        <Input id="evTitle" placeholder="Goa group departure briefing" {...register('title', { required: 'Title is required' })} />
      </Field>
      <Field label="Date" htmlFor="evDate" error={errors.date?.message} required>
        <Input id="evDate" type="date" {...register('date', { required: 'Pick a date' })} />
      </Field>
      <Field label="Notes" htmlFor="evNotes">
        <Input id="evNotes" placeholder="Optional details…" {...register('notes')} />
      </Field>
      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          Add event
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date>(new Date());
  const [formOpen, setFormOpen] = useState(false);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });

  const feedQuery = useQuery({
    queryKey: ['calendar', format(gridStart, 'yyyy-MM-dd'), format(gridEnd, 'yyyy-MM-dd')],
    queryFn: () =>
      api.get<CalendarFeed>(`/calendar?from=${format(gridStart, 'yyyy-MM-dd')}&to=${format(gridEnd, 'yyyy-MM-dd')}`),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/calendar/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      toast.success('Event removed');
    },
  });

  const entriesByDay = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const push = (date: string, entry: DayEntry) => {
      const key = format(parseISO(date), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(entry);
    };
    const feed = feedQuery.data;
    if (feed) {
      for (const d of feed.departures) {
        push(d.startDate, {
          key: `dep-${d.id}`, kind: 'departure', label: `✈ ${d.customerName}`,
          sub: `${bookingRef(d.bookingNumber)} · ${d.destination}`, color: 'bg-primary/10 text-primary', link: `/bookings/${d.id}`,
        });
      }
      for (const r of feed.returns) {
        push(r.endDate, {
          key: `ret-${r.id}`, kind: 'return', label: `🛬 ${r.customerName}`,
          sub: `${bookingRef(r.bookingNumber)} · back from ${r.destination}`, color: 'bg-teal-50 text-teal-700', link: `/bookings/${r.id}`,
        });
      }
      for (const e of feed.events) {
        push(e.date, {
          key: `ev-${e.id}`, kind: 'event', label: e.title, sub: e.notes ?? undefined,
          color: 'bg-violet-50 text-violet-700', eventId: e.id,
        });
      }
      for (const t of feed.tasks) {
        push(t.dueAt, {
          key: `task-${t.id}`, kind: 'task', label: t.title,
          sub: t.status === 'DONE' ? 'Done' : format(parseISO(t.dueAt), 'hh:mm a'),
          color: t.status === 'DONE' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-700', link: '/tasks',
        });
      }
    }
    return map;
  }, [feedQuery.data]);

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);
  const selectedEntries = entriesByDay.get(format(selected, 'yyyy-MM-dd')) ?? [];

  return (
    <div>
      <PageHeader title="Calendar" description="Departures, returns, events and due tasks at a glance.">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Add event
        </Button>
      </PageHeader>

      {/* Month switcher */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">{format(month, 'MMMM yyyy')}</h2>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setMonth(startOfMonth(new Date())); setSelected(new Date()); }}>
            Today
          </Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      {feedQuery.isLoading ? (
        <Skeleton className="h-[420px] w-full rounded-lg" />
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-primary/[0.04] text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const entries = entriesByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              const selectedDay = isSameDay(day, selected);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(day)}
                  className={cn(
                    'min-h-[64px] border-b border-r border-border p-1.5 text-left align-top transition-colors sm:min-h-[96px] sm:p-2',
                    !inMonth && 'bg-surface/60 text-muted-foreground',
                    selectedDay && 'bg-primary/5 ring-2 ring-inset ring-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      isToday(day) ? 'bg-primary text-white' : 'text-foreground',
                      !inMonth && 'text-muted-foreground/60',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {/* Desktop: chips. Mobile: dots. */}
                  <div className="mt-1 hidden space-y-1 sm:block">
                    {entries.slice(0, 3).map((e) => (
                      <span key={e.key} className={cn('block truncate rounded px-1.5 py-0.5 text-[10px] font-medium', e.color)}>
                        {e.label}
                      </span>
                    ))}
                    {entries.length > 3 && (
                      <span className="block px-1.5 text-[10px] text-muted-foreground">+{entries.length - 3} more</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {entries.slice(0, 4).map((e) => (
                      <span
                        key={e.key}
                        className={cn(
                          'size-1.5 rounded-full',
                          e.kind === 'departure' && 'bg-primary',
                          e.kind === 'return' && 'bg-teal-500',
                          e.kind === 'event' && 'bg-violet-400',
                          e.kind === 'task' && 'bg-amber-400',
                        )}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Plane className="size-3.5 text-primary" /> Departure</span>
        <span className="flex items-center gap-1.5"><PlaneLanding className="size-3.5 text-teal-600" /> Return</span>
        <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5 text-violet-500" /> Event</span>
        <span className="flex items-center gap-1.5"><BellRing className="size-3.5 text-amber-500" /> Task due</span>
      </div>

      {/* Selected day details */}
      <div className="mt-6">
        <h3 className="mb-2 font-display text-base font-bold text-foreground">
          {format(selected, 'EEEE, d MMMM')}
        </h3>
        {selectedEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>
        ) : (
          <Card className="divide-y divide-border">
            {selectedEntries.map((e) => (
              <div key={e.key} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  {e.link ? (
                    <Link to={e.link} className="truncate font-medium text-foreground hover:underline">
                      {e.label}
                    </Link>
                  ) : (
                    <p className="truncate font-medium text-foreground">{e.label}</p>
                  )}
                  {e.sub && <p className="truncate text-xs text-muted-foreground">{e.sub}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize', e.color)}>
                    {e.kind}
                  </span>
                  {e.eventId && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete event"
                      onClick={() => deleteEventMutation.mutate(e.eventId!)}
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add event</DialogTitle>
            <DialogDescription>Add a manual entry to your agency's calendar.</DialogDescription>
          </DialogHeader>
          {formOpen && <EventForm defaultDate={format(selected, 'yyyy-MM-dd')} onDone={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
