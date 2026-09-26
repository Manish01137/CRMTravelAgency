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
  Package as PackageIcon,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Booking, SightseeingActivity, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ActivityCombobox } from '@/components/ActivityCombobox';
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
  const activitiesQuery = useQuery({ queryKey: ['sightseeing'], queryFn: () => api.get<SightseeingActivity[]>('/sightseeing') });
  const library = (activitiesQuery.data ?? []).filter((a) => a.isActive);
  const packagesQuery = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });
  const packages = (packagesQuery.data ?? []).filter((p) => p.isActive);

  const form = useForm<ComposerValues>({ defaultValues: toValues({ itineraryItems: [] } as unknown as Booking) });
  const { register, control, handleSubmit, reset, watch, setValue, getValues } = form;

  // A sightseeing pick that would overwrite an already-written description —
  // held here until confirmed, so existing manual content is never silently
  // lost. Null = no pending confirmation. Same pattern as the Package
  // Builder's Itinerary step.
  const [pendingReplace, setPendingReplace] = useState<{ i: number; activity: SightseeingActivity } | null>(null);

  const addActivity = (i: number, a: SightseeingActivity) => {
    if (!a.notes) return;
    const existingDescription = getValues(`days.${i}.description`)?.trim();
    if (!existingDescription) {
      setValue(`days.${i}.description`, a.notes, { shouldDirty: true });
    } else {
      setPendingReplace({ i, activity: a });
    }
  };
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'days' });

  // Selecting a package pulls its saved itinerary in as a starting point —
  // day titles/descriptions map straight across (PackageItineraryDay has no
  // subtitle/city/country equivalent, so those stay blank for the user to
  // fill in). Confirmed first if it would blow away days already designed
  // here, same "don't silently lose manual work" rule as addActivity below.
  const [pendingPackage, setPendingPackage] = useState<TravelPackage | null>(null);

  const applyPackageItinerary = (pkg: TravelPackage) => {
    const mapped = pkg.itinerary
      .slice()
      .sort((a, b) => a.day - b.day)
      .map((d) => ({ title: d.title ?? '', subtitle: '', city: '', country: '', description: d.description ?? '' }));
    replace(mapped);
    if (!getValues('destination').trim()) setValue('destination', pkg.destination, { shouldDirty: true });
    setOpenDay(0);
    toast.success(`Filled ${mapped.length} day${mapped.length === 1 ? '' : 's'} from "${pkg.name}"`);
  };

  const pickPackage = (pkg: TravelPackage) => {
    // A package with nothing saved in its own Itinerary step would otherwise
    // silently replace the days here with a single blank row — visually
    // indistinguishable from the picker doing nothing at all.
    if (pkg.itinerary.length === 0) {
      toast.error(`"${pkg.name}" doesn't have a day-by-day itinerary saved yet — add one in the Package Builder first.`);
      return;
    }
    const hasContent = getValues('days').some((d) => d.title.trim() || d.description.trim());
    if (hasContent) setPendingPackage(pkg);
    else applyPackageItinerary(pkg);
  };

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
              <Field
                label="Fill from package"
                htmlFor="fillFromPackage"
                hint="Pulls that package's day-by-day plan in as a starting point."
              >
                <div className="relative">
                  <PackageIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <select
                    id="fillFromPackage"
                    value=""
                    disabled={packagesQuery.isLoading || packages.length === 0}
                    onChange={(e) => {
                      const pkg = packages.find((p) => p.id === e.target.value);
                      if (pkg) pickPackage(pkg);
                    }}
                    className="flex h-11 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm shadow-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15"
                  >
                    <option value="">
                      {packagesQuery.isLoading ? 'Loading packages…' : packages.length === 0 ? 'No active packages yet' : 'Choose a package…'}
                    </option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.destination}
                      </option>
                    ))}
                  </select>
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
                      <Field label="Notes / description" hint="Pick from your Sightseeing library to fill this in, or write it freely.">
                        <ActivityCombobox activities={library} onPick={(a) => addActivity(i, a)} />
                        <Textarea rows={4} className="mt-2" {...register(`days.${i}.description`)} placeholder="After breakfast, proceed to…" />
                      </Field>
                      {pendingReplace?.i === i && (
                        <div className="flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                          <span className="min-w-0 flex-1">Replace description with "{pendingReplace.activity.name}"'s notes?</span>
                          <button
                            type="button"
                            className="font-semibold underline"
                            onClick={() => {
                              setValue(`days.${i}.description`, pendingReplace.activity.notes ?? '', { shouldDirty: true });
                              setPendingReplace(null);
                            }}
                          >
                            Replace
                          </button>
                          <button type="button" className="text-amber-700" onClick={() => setPendingReplace(null)}>
                            Cancel
                          </button>
                        </div>
                      )}
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

      <ConfirmDialog
        open={!!pendingPackage}
        onOpenChange={(open) => !open && setPendingPackage(null)}
        title={`Fill from "${pendingPackage?.name}"?`}
        description="This replaces every day below with that package's itinerary — anything you've already written here will be lost."
        confirmLabel="Replace days"
        destructive
        onConfirm={() => {
          if (pendingPackage) applyPackageItinerary(pendingPackage);
          setPendingPackage(null);
        }}
      />
    </form>
  );
}
