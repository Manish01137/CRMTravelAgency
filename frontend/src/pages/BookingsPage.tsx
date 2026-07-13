import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  SearchX,
  Trash2,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Booking, BookingStats, BookingStatus, Paginated, TravelPackage, User } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CountUp } from '@/components/ui/count-up';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BookingFormDialog } from '@/components/bookings/BookingFormDialog';
import { BOOKING_STATUSES, BOOKING_STATUS_STYLES, bookingRef } from '@/lib/crmMeta';
import { formatCurrency, formatTravelDate, initials } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const PAGE_SIZE = 10;
const ALL = 'ALL';

function StatusDropdown({
  booking,
  onChange,
  disabled,
}: {
  booking: Booking;
  onChange: (status: BookingStatus) => void;
  disabled?: boolean;
}) {
  const st = BOOKING_STATUS_STYLES[booking.status];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60',
            st.solid,
          )}
          aria-label={`Change status for ${booking.customerName}`}
        >
          {st.label}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        {BOOKING_STATUSES.map((s) => (
          <DropdownMenuItem key={s.value} onSelect={() => s.value !== booking.status && onChange(s.value)}>
            <span className={cn('size-2 rounded-full', BOOKING_STATUS_STYLES[s.value].dot)} />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BookingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [status, setStatus] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [deleting, setDeleting] = useState<Booking | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status !== ALL) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [search, status, page]);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', queryString],
    queryFn: () => api.get<Paginated<Booking>>(`/bookings?${queryString}`),
    placeholderData: keepPreviousData,
  });
  const statsQuery = useQuery({
    queryKey: ['booking-stats'],
    queryFn: () => api.get<BookingStats>('/bookings/stats'),
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });
  const packagesQuery = useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get<TravelPackage[]>('/packages'),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['booking-stats'] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch<Booking>(`/bookings/${id}`, data),
    onSuccess: () => {
      invalidate();
      toast.success('Booking updated');
    },
    onError: () => toast.error('Could not update this booking'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/bookings/${id}`),
    onSuccess: () => {
      invalidate();
      toast.success('Booking deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete this booking'),
  });

  const data = bookingsQuery.data;
  const bookings = data?.items ?? [];
  const stats = statsQuery.data;
  const hasFilters = Boolean(search) || status !== ALL;

  const chips = (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
      <button
        type="button"
        onClick={() => setStatus(ALL)}
        className={cn(
          'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
          status === ALL
            ? 'bg-foreground text-background'
            : 'border border-border bg-card text-muted-foreground hover:bg-muted',
        )}
      >
        All bookings
      </button>
      {BOOKING_STATUSES.map((s) => {
        const active = status === s.value;
        const st = BOOKING_STATUS_STYLES[s.value];
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => setStatus(active ? ALL : s.value)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors',
              active ? st.solid : 'border border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            <span className={cn('size-1.5 rounded-full', active ? 'bg-white' : st.dot)} />
            {s.label}
            {stats?.byStatus?.[s.value] != null && (
              <span className={cn('text-[10px]', active ? 'text-white/80' : 'text-muted-foreground')}>
                {stats.byStatus[s.value]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <div>
      <PageHeader title="Bookings" description="Every confirmed trip, from deposit to departure.">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus /> New booking
        </Button>
      </PageHeader>

      {/* Stat tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: 'Total bookings', value: stats?.total ?? 0, Icon: CalendarCheck2, tile: 'bg-gradient-to-br from-primary to-violet-500' },
          { label: 'Departing this month', value: stats?.departingThisMonth ?? 0, Icon: CalendarDays, tile: 'bg-gradient-to-br from-sky-500 to-blue-600' },
          { label: 'Pipeline value', value: stats?.totalValue ?? 0, Icon: Wallet, tile: 'bg-gradient-to-br from-emerald-500 to-teal-600', money: true },
          { label: 'Collected', value: stats?.totalCollected ?? 0, Icon: UsersRound, tile: 'bg-gradient-to-br from-amber-400 to-orange-500', money: true },
        ].map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="truncate text-sm text-muted-foreground">{s.label}</p>
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white [&_svg]:size-4', s.tile)}>
                <s.Icon />
              </span>
            </div>
            {statsQuery.isLoading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-1 truncate font-display text-2xl font-bold text-foreground">
                {s.money ? formatCurrency(s.value, 'INR') : <CountUp to={s.value} duration={800} />}
              </p>
            )}
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="mb-3">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search customer, destination, phone…"
            className="pl-9"
            aria-label="Search bookings"
          />
        </div>
      </div>

      {chips}

      {bookingsQuery.isLoading ? (
        <Card className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="hidden h-7 w-24 rounded-md sm:block" />
            </div>
          ))}
        </Card>
      ) : bookings.length === 0 ? (
        hasFilters ? (
          <EmptyState
            icon={<SearchX />}
            title="No bookings match"
            description="Try adjusting your search or status filter."
            action={<Button variant="outline" onClick={() => { setSearchInput(''); setStatus(ALL); }}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={<CalendarCheck2 />}
            title="No bookings yet"
            description="Convert a won lead into a booking, or create one from scratch."
            action={
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus /> New booking
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-primary/[0.04] text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Booking</th>
                    <th className="px-4 py-3 font-medium">Trip</th>
                    <th className="px-4 py-3 font-medium">Dates</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Agent</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {bookings.map((bk) => {
                    const paidPct = bk.totalAmount > 0 ? Math.min(100, Math.round((bk.amountPaid / bk.totalAmount) * 100)) : 0;
                    return (
                      <tr
                        key={bk.id}
                        onClick={() => navigate(`/bookings/${bk.id}`)}
                        className="cursor-pointer align-top transition-colors hover:bg-muted/50"
                      >
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-foreground">{bk.customerName}</p>
                          <p className="text-[11px] text-muted-foreground">{bookingRef(bk.bookingNumber)}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-foreground">{bk.destination}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {bk.package?.name ?? 'Custom trip'}
                            {bk.travelerCount ? ` · ${bk.travelerCount} pax` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground">
                          {bk.startDate ? formatTravelDate(bk.startDate) : '—'}
                          {bk.endDate ? ` → ${formatTravelDate(bk.endDate)}` : ''}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-foreground">{formatCurrency(bk.totalAmount, bk.currency)}</p>
                          <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">{paidPct}% paid</p>
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <StatusDropdown
                            booking={bk}
                            disabled={updateMutation.isPending}
                            onChange={(s) => updateMutation.mutate({ id: bk.id, data: { status: s } })}
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          {bk.assignedTo ? (
                            <span className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-[10px]">{initials(bk.assignedTo.name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{bk.assignedTo.name}</span>
                            </span>
                          ) : (
                            <span className="text-sm italic text-muted-foreground">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" className="h-8 bg-foreground px-3 text-xs text-background hover:bg-foreground/85">
                                Actions <ChevronDown className="size-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => navigate(`/bookings/${bk.id}`)}>
                                <CalendarCheck2 /> Open
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => { setEditing(bk); setFormOpen(true); }}>
                                <Pencil /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem destructive onSelect={() => setDeleting(bk)}>
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {bookings.map((bk) => (
              <Card key={bk.id} className="p-4">
                <Link to={`/bookings/${bk.id}`} className="block">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{bk.customerName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {bookingRef(bk.bookingNumber)} · {bk.destination}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', BOOKING_STATUS_STYLES[bk.status].pill)}>
                      <span className={cn('size-1.5 rounded-full', BOOKING_STATUS_STYLES[bk.status].dot)} />
                      {BOOKING_STATUS_STYLES[bk.status].label}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {bk.startDate ? formatTravelDate(bk.startDate) : 'Dates TBD'}
                    </span>
                    <span className="font-medium text-foreground">{formatCurrency(bk.totalAmount, bk.currency)}</span>
                  </div>
                </Link>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} · {data.total} bookings
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={data.page <= 1}>
                  <ChevronLeft /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={data.page >= data.totalPages}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <BookingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        booking={editing}
        users={usersQuery.data ?? []}
        packages={packagesQuery.data ?? []}
        onSaved={(saved) => !editing && navigate(`/bookings/${saved.id}`)}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete booking?"
        description={
          deleting ? (
            <>
              <span className="font-medium text-foreground">{bookingRef(deleting.bookingNumber)}</span> for{' '}
              <span className="font-medium text-foreground">{deleting.customerName}</span> will be permanently
              removed, along with its itinerary. Invoices and bills stay but lose the link.
            </>
          ) : undefined
        }
        confirmLabel="Delete booking"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
