import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Minus,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Booking } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { bookingRef } from '@/lib/crmMeta';
import { toDateInputValue } from '@/lib/format';

interface DayV {
  title: string;
  subtitle: string;
  city: string;
  country: string;
  description: string;
}
interface ComposerValues {
  destination: string;
  startDate: string;
  travelerCount: string;
  currency: string;
  totalAmount: string;
  amountPaid: string;
  days: DayV[];
}

function toValues(b: Booking): ComposerValues {
  const items = [...(b.itineraryItems ?? [])].sort((a, c) => a.dayNumber - c.dayNumber);
  return {
    destination: b.destination ?? '',
    startDate: toDateInputValue(b.startDate),
    travelerCount: b.travelerCount != null ? String(b.travelerCount) : '',
    currency: b.currency ?? 'INR',
    totalAmount: String(b.totalAmount ?? 0),
    amountPaid: String(b.amountPaid ?? 0),
    days: items.length
      ? items.map((d) => ({
          title: d.title ?? '',
          subtitle: (d as { subtitle?: string }).subtitle ?? '',
          city: (d as { city?: string }).city ?? '',
          country: (d as { country?: string }).country ?? '',
          description: d.description ?? '',
        }))
      : [{ title: '', subtitle: '', city: '', country: '', description: '' }],
  };
}

export function ItineraryComposerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [openDay, setOpenDay] = useState(0);

  const bookingQuery = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api.get<Booking>(`/bookings/${id}`),
    enabled: !!id,
  });

  const form = useForm<ComposerValues>({ defaultValues: toValues({ itineraryItems: [] } as unknown as Booking) });
  const { register, control, handleSubmit, reset, watch } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'days' });

  const [hydrated, setHydrated] = useState(false);
  const booking = bookingQuery.data;
  if (booking && !hydrated) {
    reset(toValues(booking));
    setHydrated(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (v: ComposerValues) => {
      await api.patch(`/bookings/${id}`, {
        destination: v.destination.trim() || 'To be decided',
        startDate: v.startDate || null,
        travelerCount: v.travelerCount ? Number(v.travelerCount) : null,
        currency: (v.currency || 'INR').toUpperCase(),
        totalAmount: Number(v.totalAmount) || 0,
        amountPaid: Number(v.amountPaid) || 0,
      });
      await api.put(`/bookings/${id}/itinerary`, {
        items: v.days.map((d, i) => ({
          dayNumber: i + 1,
          title: d.title.trim() || `Day ${i + 1}`,
          subtitle: d.subtitle.trim() || undefined,
          city: d.city.trim() || undefined,
          country: d.country.trim() || undefined,
          description: d.description.trim() || undefined,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Itinerary saved');
      navigate(`/bookings/${id}`);
    },
    onError: () => toast.error('Could not save the itinerary'),
  });

  if (bookingQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Booking not found.
        <div className="mt-3">
          <Button variant="outline" onClick={() => navigate('/bookings')}>
            Back to bookings
          </Button>
        </div>
      </div>
    );
  }

  const days = watch('days');
  const filled = days.filter((d) => d.title.trim()).length;

  const setLength = (n: number) => {
    const target = Math.max(1, Math.min(60, n));
    const cur = fields.length;
    if (target > cur) for (let i = cur; i < target; i += 1) append({ title: '', subtitle: '', city: '', country: '', description: '' });
    else if (target < cur) for (let i = cur; i > target; i -= 1) remove(i - 1);
  };

  return (
    <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))}>
      {/* Header */}
      <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-violet-600 p-5 text-white shadow-pop">
        <div className="animate-blob pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
              <Wand2 className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-lg font-bold">Itinerary Composer</h1>
              <p className="text-xs text-white/70">
                {booking.customerName} · {bookingRef(booking.bookingNumber)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Days {fields.length} · Filled {filled}/{fields.length}
            </span>
            <Button
              type="button"
              variant="outline"
              className="border-white/30 bg-transparent text-white hover:bg-white/10"
              onClick={() => window.open(`/bookings/${id}/itinerary/print`, '_blank')}
            >
              <FileText /> <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button type="button" variant="outline" size="icon" className="border-white/30 bg-transparent text-white hover:bg-white/10" aria-label="Close" onClick={() => navigate(`/bookings/${id}`)}>
              <X />
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Left rail */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Trip basics
            </h2>
            <div className="space-y-3">
              <Field label="Start city / destination">
                <Input {...register('destination')} placeholder="Srinagar - Gulmarg…" />
              </Field>
              <Field label="Journey date">
                <Input type="date" {...register('startDate')} />
              </Field>
              <Field label="Length (days)">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label="Fewer days" onClick={() => setLength(fields.length - 1)}>
                    <Minus />
                  </Button>
                  <span className="flex h-11 flex-1 items-center justify-center rounded-md border border-input bg-surface font-display text-lg font-bold text-foreground">
                    {fields.length}D
                  </span>
                  <Button type="button" variant="outline" size="icon" aria-label="More days" onClick={() => setLength(fields.length + 1)}>
                    <Plus />
                  </Button>
                </div>
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer</h2>
            <div className="space-y-3">
              <Field label="Customer name">
                <Input value={booking.customerName} disabled readOnly />
              </Field>
              <Field label="Travellers">
                <Input type="number" min={1} {...register('travelerCount')} placeholder="2" />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Pricing & meta</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Currency">
                  <Input maxLength={3} className="uppercase" {...register('currency')} />
                </Field>
                <Field label="Total cost">
                  <Input type="number" min={0} {...register('totalAmount')} />
                </Field>
              </div>
              <Field label="Advance / paid">
                <Input type="number" min={0} {...register('amountPaid')} />
              </Field>
            </div>
          </div>
        </div>

        {/* Right: design each day */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-foreground">Design each day</h2>
            <Button type="button" variant="outline" size="sm" onClick={() => { append({ title: '', subtitle: '', city: '', country: '', description: '' }); setOpenDay(fields.length); }}>
              <Plus /> Add day
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((f, i) => {
              const isOpen = openDay === i;
              const dayVals = days[i];
              return (
                <div key={f.id} className={cn('overflow-hidden rounded-2xl border bg-card shadow-card transition-colors', isOpen ? 'border-primary/40' : 'border-border')}>
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? -1 : i)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-violet-500 font-display text-sm font-bold text-white">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{dayVals?.title || `Day ${i + 1}`}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[dayVals?.subtitle, dayVals?.city].filter(Boolean).join(' · ') || 'Tap to design this day'}
                      </p>
                    </div>
                    <span
                      role="button"
                      tabIndex={-1}
                      aria-label={`Remove day ${i + 1}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(i);
                      }}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </span>
                    {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                  </button>

                  {isOpen && (
                    <div className="space-y-3 border-t border-border p-4">
                      <Field label="Day title">
                        <Input {...register(`days.${i}.title`)} placeholder="e.g. Srinagar local" />
                      </Field>
                      <Field label="What's happening?">
                        <Input {...register(`days.${i}.subtitle`)} placeholder="As per customer / SRINAGAR - GULMARG…" />
                      </Field>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="City">
                          <Input {...register(`days.${i}.city`)} placeholder="Srinagar" />
                        </Field>
                        <Field label="Country">
                          <Input {...register(`days.${i}.country`)} placeholder="India" />
                        </Field>
                      </div>
                      <Field label="Notes / description">
                        <Textarea rows={4} {...register(`days.${i}.description`)} placeholder="After breakfast, proceed to…" />
                      </Field>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          {filled} of {fields.length} days designed
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(`/bookings/${id}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner /> : <Wand2 />}
            Save itinerary
          </Button>
        </div>
      </div>
    </form>
  );
}
