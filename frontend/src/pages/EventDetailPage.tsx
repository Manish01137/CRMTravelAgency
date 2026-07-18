import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CalendarRange, Link2, MapPin, Phone, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventDetail, EventStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BOOKING_STATUS_STYLES, bookingRef } from '@/lib/crmMeta';
import { formatCurrency, formatTravelDate } from '@/lib/format';
import { brochureUrl, copyToClipboard } from '@/lib/share';

const STATUS_LABEL: Record<EventStatus, string> = {
  DRAFT: 'Draft',
  LIVE: 'Live',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const STATUSES = Object.keys(STATUS_LABEL) as EventStatus[];

function Stat({ label, value, icon, tint }: { label: string; value: string; icon: React.ReactNode; tint: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn('flex size-8 items-center justify-center rounded-lg [&_svg]:size-4', tint)}>{icon}</span>
      </div>
      <p className="mt-2 font-display text-xl font-bold text-foreground">{value}</p>
    </Card>
  );
}

export function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['event', id],
    queryFn: () => api.get<EventDetail>(`/events/${id}`),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: EventStatus) => api.patch(`/events/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-stats'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Could not update status'),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/events')}>
          <ArrowLeft /> Back to events
        </Button>
      </div>
    );
  }

  const { event: e, seatsBooked, seatsRemaining, revenue, pending, bookings } = query.data;
  const currency = e.priceCurrency;
  const fill = Math.min(100, e.capacity > 0 ? Math.round((seatsBooked / e.capacity) * 100) : 0);

  return (
    <div>
      <button onClick={() => navigate('/events')} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Events
      </button>

      {/* Header */}
      <Card className="overflow-hidden p-0">
        <div className="relative h-36 w-full bg-muted sm:h-44">
          {e.coverImage ? (
            <img src={e.coverImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <MapPin className="size-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-end justify-between gap-3 p-4 text-white">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold drop-shadow">{e.name || e.packageName}</h1>
              <p className="flex items-center gap-1 text-sm text-white/85">
                <MapPin className="size-3.5" /> {e.packageName} · {e.destination}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={e.status} onValueChange={(v) => statusMutation.mutate(v as EventStatus)}>
                <SelectTrigger className="h-9 w-36 border-white/30 bg-white/15 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {STATUS_LABEL[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
          <span className="flex items-center gap-2 text-foreground">
            <CalendarRange className="size-4 text-muted-foreground" />
            {formatTravelDate(e.departureDate)}
            {e.returnDate ? ` → ${formatTravelDate(e.returnDate)}` : ''}
          </span>
          {e.pickupCity && (
            <span className="flex items-center gap-2 text-foreground">
              <MapPin className="size-4 text-muted-foreground" /> Pickup: {e.pickupCity}
            </span>
          )}
          {e.bookingCloseDate && (
            <span className="text-muted-foreground">Booking closes {formatTravelDate(e.bookingCloseDate)}</span>
          )}
          <span className="font-display text-base font-bold text-foreground">
            {formatCurrency(e.pricePerPerson, currency)} <span className="text-xs font-medium text-muted-foreground">/ person</span>
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`/p/${e.packageId}`, '_blank')}>
              <MapPin /> Package page
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const ok = await copyToClipboard(brochureUrl(e.packageId));
                ok ? toast.success('Link copied') : toast.error('Copy failed');
              }}
            >
              <Link2 /> Copy link
            </Button>
          </div>
        </div>
      </Card>

      {/* Seat progress */}
      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-foreground">Seats filled</span>
          <span className="font-semibold text-foreground">
            {seatsBooked}/{e.capacity} · {seatsRemaining} left
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', fill >= 100 ? 'bg-destructive' : 'bg-emerald-500')} style={{ width: `${fill}%` }} />
        </div>
      </Card>

      {/* Money */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Seats booked" value={String(seatsBooked)} icon={<Users />} tint="bg-primary/10 text-primary" />
        <Stat label="Seats remaining" value={String(seatsRemaining)} icon={<Users />} tint="bg-amber-100 text-amber-600" />
        <Stat label="Revenue collected" value={formatCurrency(revenue, currency)} icon={<Wallet />} tint="bg-emerald-100 text-emerald-600" />
        <Stat label="Pending payments" value={formatCurrency(pending, currency)} icon={<Wallet />} tint="bg-red-100 text-red-600" />
      </div>

      {/* Passenger / booking list */}
      <h2 className="mb-3 mt-6 font-display text-base font-semibold text-foreground">Passengers ({bookings.length})</h2>
      {bookings.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No passengers yet"
          description="Bookings assigned to this departure show up here. Create a booking, choose this package and pick this departure."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border bg-primary/[0.04] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Booking</th>
                  <th className="px-4 py-3 font-semibold">Passenger</th>
                  <th className="px-4 py-3 font-semibold">Seats</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  <th className="px-4 py-3 font-semibold">Pending</th>
                  <th className="px-4 py-3 font-semibold">Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.map((b) => {
                  const bst = BOOKING_STATUS_STYLES[b.status];
                  const due = Math.max(0, b.totalAmount - b.amountPaid);
                  return (
                    <tr
                      key={b.id}
                      className="cursor-pointer transition-colors hover:bg-muted/40"
                      onClick={() => navigate(`/bookings/${b.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-primary">{bookingRef(b.bookingNumber)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{b.customerName}</p>
                        {b.customerPhone && (
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="size-3" /> {b.customerPhone}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.travelerCount ?? 1}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', bst.pill)}>
                          <span className={cn('size-1.5 rounded-full', bst.dot)} />
                          {bst.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground">{formatCurrency(b.amountPaid, b.currency)}</td>
                      <td className={cn('px-4 py-3', due > 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                        {formatCurrency(due, b.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.assignedTo?.name ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
