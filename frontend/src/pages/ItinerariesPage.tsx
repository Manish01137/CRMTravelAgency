import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Printer,
  Route as RouteIcon,
  Search,
  UsersRound,
  Wand2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Booking, Paginated, TravelPackage, User } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BookingFormDialog } from '@/components/bookings/BookingFormDialog';
import { BOOKING_STATUS_STYLES, bookingRef } from '@/lib/crmMeta';
import { formatTravelDate } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

const PAGE_SIZE = 12;

export function ItinerariesPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    return params.toString();
  }, [search, page]);

  const bookingsQuery = useQuery({
    queryKey: ['bookings', queryString],
    queryFn: () => api.get<Paginated<Booking>>(`/bookings?${queryString}`),
    placeholderData: keepPreviousData,
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });
  const packagesQuery = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });

  const data = bookingsQuery.data;
  const items = data?.items ?? [];

  return (
    <div>
      <PageHeader title="Itineraries" description="Every trip's day-by-day plan — design, edit and share as PDF.">
        <Button onClick={() => setFormOpen(true)}>
          <Wand2 /> New itinerary
        </Button>
      </PageHeader>

      <div className="mb-5">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search customer or destination…"
            className="pl-9"
            aria-label="Search itineraries"
          />
        </div>
      </div>

      {bookingsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<RouteIcon />}
          title={search ? 'No itineraries match' : 'No itineraries yet'}
          description={
            search
              ? 'Try a different search.'
              : 'Start a new itinerary, or open a booking and design its day-by-day plan.'
          }
          action={
            !search ? (
              <Button onClick={() => setFormOpen(true)}>
                <Wand2 /> New itinerary
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((bk) => {
              const st = BOOKING_STATUS_STYLES[bk.status];
              const days = bk.itineraryDays ?? 0;
              return (
                <Card
                  key={bk.id}
                  className="flex cursor-pointer flex-col p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
                  onClick={() => navigate(`/bookings/${bk.id}/itinerary`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-bold text-foreground">{bk.customerName}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {bk.destination}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.pill)}>
                      <span className={cn('size-1.5 rounded-full', st.dot)} />
                      {st.label}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2.5 py-1',
                        days > 0 ? 'bg-primary/10 text-primary' : 'bg-muted',
                      )}
                    >
                      <RouteIcon className="size-3" /> {days > 0 ? `${days}-day plan` : 'Not started'}
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{bookingRef(bk.bookingNumber)}</span>
                    {bk.travelerCount != null && (
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                        <UsersRound className="size-3" /> {bk.travelerCount}
                      </span>
                    )}
                  </div>

                  {bk.startDate && (
                    <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" />
                      {formatTravelDate(bk.startDate)}
                      {bk.endDate ? ` → ${formatTravelDate(bk.endDate)}` : ''}
                    </p>
                  )}

                  <div className="mt-4 flex flex-1 items-end gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/bookings/${bk.id}/itinerary`)}>
                      <Wand2 /> {days > 0 ? 'Edit' : 'Design'}
                    </Button>
                    {days > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label="Download PDF"
                        onClick={() => window.open(`/bookings/${bk.id}/itinerary/print`, '_blank')}
                      >
                        <Printer />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          {data && data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages} · {data.total} itineraries
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
        booking={null}
        users={usersQuery.data ?? []}
        packages={packagesQuery.data ?? []}
        onSaved={(saved) => navigate(`/bookings/${saved.id}/itinerary`)}
      />
    </div>
  );
}
