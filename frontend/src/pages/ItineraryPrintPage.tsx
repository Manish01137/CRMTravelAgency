import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, MapPin, Plane, Printer, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import type { Booking } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { bookingRef } from '@/lib/crmMeta';
import { formatTravelDate } from '@/lib/format';

/** Print-ready day-by-day itinerary for a booking. "Download PDF" = browser print. */
export function ItineraryPrintPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();

  const bookingQuery = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get<Booking>(`/bookings/${id}`),
    enabled: !!id,
  });

  const booking = bookingQuery.data;
  const brand = organization?.brandPrimaryColor ?? '#4F46E5';
  const brand2 = organization?.brandSecondaryColor ?? '#0D9488';

  if (bookingQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <p className="text-muted-foreground">Booking not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/bookings')}>
          <ArrowLeft /> Back
        </Button>
      </div>
    );
  }

  const days = [...(booking.itineraryItems ?? [])].sort((a, b) => a.dayNumber - b.dayNumber);

  return (
    <div className="min-h-dvh bg-surface py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Download PDF
        </Button>
      </div>

      <div className="mx-auto max-w-3xl overflow-hidden bg-white shadow-card print:max-w-none print:shadow-none sm:rounded-xl">
        {/* Header */}
        <div className="px-6 py-7 text-white sm:px-9" style={{ background: `linear-gradient(120deg, ${brand}, ${brand2})` }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {organization?.logoUrl ? (
                <img src={organization.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
                  <Plane className="size-5" />
                </span>
              )}
              <p className="font-display text-base font-bold">{organization?.name ?? 'Travel Agency'}</p>
            </div>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{bookingRef(booking.bookingNumber)}</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">{booking.destination} Itinerary</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span>Prepared for {booking.customerName}</span>
            {booking.startDate && (
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatTravelDate(booking.startDate)}
                {booking.endDate ? ` → ${formatTravelDate(booking.endDate)}` : ''}
              </span>
            )}
            {booking.travelerCount && (
              <span className="flex items-center gap-1">
                <UsersRound className="size-3.5" /> {booking.travelerCount} travellers
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-7 sm:px-9">
          {days.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">No itinerary designed yet.</p>
          ) : (
            <div className="space-y-6">
              {days.map((d) => (
                <div key={d.id} className="flex gap-4 break-inside-avoid">
                  <div className="flex flex-col items-center">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-white" style={{ backgroundColor: brand }}>
                      {String(d.dayNumber).padStart(2, '0')}
                    </span>
                    <span className="mt-1 w-px flex-1 bg-border" />
                  </div>
                  <div className="pb-2">
                    <p className="font-display text-lg font-bold text-foreground">{d.title}</p>
                    {(d.subtitle || d.city || d.country) && (
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm font-medium" style={{ color: brand }}>
                        {d.subtitle}
                        {(d.city || d.country) && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="size-3" /> {[d.city, d.country].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </p>
                    )}
                    {d.description && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Prepared by {organization?.name ?? 'Voyage CRM'} ✈ We wish you a wonderful trip!
          </p>
        </div>
      </div>
    </div>
  );
}
