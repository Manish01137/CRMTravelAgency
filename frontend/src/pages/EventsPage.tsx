import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarPlus,
  CalendarRange,
  FileText,
  Link2,
  MapPin,
  Plus,
  Search,
  Send,
  Ticket,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventItem, EventStats } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency, formatTravelDate } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';
import { brochureUrl, copyToClipboard, packageWhatsAppUrl } from '@/lib/share';

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

/** Inline "add departure" row shown under an event when expanded. */
function AddBatch({ packageId, onDone }: { packageId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [capacity, setCapacity] = useState('20');

  const mutation = useMutation({
    mutationFn: () => api.post('/events/batches', { packageId, departureDate: date, capacity: Number(capacity) || 20 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-stats'] });
      toast.success('Departure added');
      setDate('');
      onDone();
    },
    onError: () => toast.error('Could not add this departure'),
  });

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/50 p-3">
      <div className="flex-1">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Departure date</label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
      </div>
      <div className="w-24">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Seats</label>
        <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} className="h-9" />
      </div>
      <Button size="sm" disabled={!date || mutation.isPending} onClick={() => mutation.mutate()}>
        <Plus /> Add
      </Button>
    </div>
  );
}

export function EventsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim().toLowerCase(), 300);
  const [category, setCategory] = useState<string>('All');
  const [expanded, setExpanded] = useState<string | null>(null);

  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: () => api.get<EventItem[]>('/events') });
  const statsQuery = useQuery({ queryKey: ['event-stats'], queryFn: () => api.get<EventStats>('/events/stats') });

  const all = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const categories = useMemo(() => ['All', ...new Set(all.flatMap((e) => e.categories))], [all]);
  const events = useMemo(
    () =>
      all.filter(
        (e) =>
          (category === 'All' || e.categories.includes(category)) &&
          (!search || e.name.toLowerCase().includes(search) || e.destination.toLowerCase().includes(search)),
      ),
    [all, category, search],
  );

  const toggleLive = useMutation({
    mutationFn: (e: EventItem) => api.patch(`/packages/${e.id}`, { isActive: !e.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-stats'] });
    },
    onError: () => toast.error('Could not update this event'),
  });

  const deleteBatch = useMutation({
    mutationFn: (id: string) => api.delete(`/events/batches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-stats'] });
      toast.success('Departure removed');
    },
  });

  const s = statsQuery.data;
  const currency = all[0]?.priceCurrency ?? 'INR';

  return (
    <div>
      <PageHeader title="My Events" description="Your trips as sellable events — schedule departures and track seats booked.">
        <Button onClick={() => navigate('/packages/new')}>
          <Plus /> Create event
        </Button>
      </PageHeader>

      {/* Stat cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Live"
          value={statsQuery.isLoading ? '—' : `${s?.liveEvents ?? 0} events`}
          hint={`${s?.totalBatches ?? 0} departures`}
        />
        <StatCard
          label="Today's revenue"
          value={statsQuery.isLoading ? '—' : formatCurrency(s?.todaysRevenue ?? 0, currency)}
          hint={`${s?.todaysBookings ?? 0} booked today`}
        />
        <StatCard label="Total departures" value={statsQuery.isLoading ? '—' : String(s?.totalBatches ?? 0)} />
        <StatCard
          label="Pending settlement"
          value={statsQuery.isLoading ? '—' : formatCurrency(s?.pendingSettlement ?? 0, currency)}
          hint="Collected vs trip value"
        />
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search events…"
            className="pl-9"
            aria-label="Search events"
          />
        </div>
      </div>

      {/* Category chips */}
      {categories.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                category === c ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {eventsQuery.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Ticket />}
          title={search || category !== 'All' ? 'No events match' : 'No events yet'}
          description={
            search || category !== 'All'
              ? 'Try a different search or category.'
              : 'Create a package, then schedule its departure dates here to start taking bookings.'
          }
          action={
            !search && category === 'All' ? (
              <Button onClick={() => navigate('/packages/new')}>
                <Plus /> Create event
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {events.map((e) => {
            const isOpen = expanded === e.id;
            const nextBatches = e.batches.slice(0, isOpen ? undefined : 3);
            const totalBooked = e.batches.reduce((sum, b) => sum + b.booked, 0);
            return (
              <Card key={e.id} className="overflow-hidden p-0">
                <div className="flex flex-col gap-4 p-4 sm:flex-row">
                  {/* Thumbnail */}
                  <div className="h-32 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-32">
                    {e.bannerImageUrl ? (
                      <img src={e.bannerImageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <MapPin className="size-6" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold text-foreground">{e.name}</h3>
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="size-3.5" /> {e.destination} · {e.days}D/{e.nights}N
                        </p>
                        {e.categories.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {e.categories.map((c) => (
                              <span key={c} className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                <span className="size-1.5 rounded-full bg-primary" /> {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Live toggle */}
                        <button
                          type="button"
                          onClick={() => toggleLive.mutate(e)}
                          role="switch"
                          aria-checked={e.isActive}
                          className={cn(
                            'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                            e.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30',
                          )}
                          title={e.isActive ? 'Live — click to unpublish' : 'Draft — click to publish'}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform',
                              e.isActive ? 'left-0.5 translate-x-5' : 'left-0.5',
                            )}
                          />
                        </button>
                        <span className={cn('text-xs font-semibold', e.isActive ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {e.isActive ? 'Live' : 'Draft'}
                        </span>
                      </div>
                    </div>

                    {/* Batches */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {e.batches.length === 0 ? (
                        <span className="text-sm text-muted-foreground">No departures yet.</span>
                      ) : (
                        nextBatches.map((b) => {
                          const soldOut = b.booked >= b.capacity || b.status === 'SOLD_OUT';
                          return (
                            <span
                              key={b.id}
                              className={cn(
                                'group inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                                soldOut ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-muted/40',
                              )}
                            >
                              <CalendarRange className="size-3.5" />
                              {formatTravelDate(b.departureDate)}
                              <span className="text-muted-foreground">
                                {b.booked}/{b.capacity}
                              </span>
                              <button
                                type="button"
                                aria-label="Remove departure"
                                onClick={() => deleteBatch.mutate(b.id)}
                                className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </span>
                          );
                        })
                      )}
                      {!isOpen && e.batches.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setExpanded(e.id)}
                          className="rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-semibold text-background"
                        >
                          +{e.batches.length - 3} more
                        </button>
                      )}
                      <span className="ml-auto text-xs font-medium text-muted-foreground">{totalBooked} booked total</span>
                    </div>

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpanded(isOpen ? null : e.id)}
                      >
                        <CalendarPlus /> {isOpen ? 'Close' : 'Departures'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(`/p/${e.id}`, '_blank')}>
                        <FileText /> Brochure
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Copy share link"
                        onClick={async () => {
                          const ok = await copyToClipboard(brochureUrl(e.id));
                          ok ? toast.success('Share link copied') : toast.error('Copy failed');
                        }}
                      >
                        <Link2 />
                      </Button>
                      <Button
                        size="icon-sm"
                        aria-label="Send on WhatsApp"
                        className="bg-emerald-500 text-white hover:bg-emerald-600"
                        onClick={() => window.open(packageWhatsAppUrl(e), '_blank')}
                      >
                        <Send />
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="mt-3">
                        <AddBatch packageId={e.id} onDone={() => undefined} />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
