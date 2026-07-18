import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { CalendarRange, Link2, MapPin, Plus, Search, Settings2, Ticket, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { EventItem, EventStats, EventStatus, TravelPackage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ImageUpload } from '@/components/ui/image-upload';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatTravelDate } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';
import { brochureUrl, copyToClipboard } from '@/lib/share';

const STATUS_META: Record<EventStatus, { label: string; pill: string; dot: string }> = {
  DRAFT: { label: 'Draft', pill: 'bg-slate-100 text-slate-600 ring-slate-200', dot: 'bg-slate-400' },
  LIVE: { label: 'Live', pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' },
  COMPLETED: { label: 'Completed', pill: 'bg-sky-50 text-sky-700 ring-sky-200', dot: 'bg-sky-500' },
  CANCELLED: { label: 'Cancelled', pill: 'bg-red-50 text-red-700 ring-red-200', dot: 'bg-red-500' },
};
const STATUSES = Object.keys(STATUS_META) as EventStatus[];

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-foreground sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

interface FormValues {
  packageId: string;
  name: string;
  departureDate: string;
  returnDate: string;
  bookingCloseDate: string;
  capacity: string;
  pricePerPerson: string;
  pickupCity: string;
  status: EventStatus;
}

/** Fast create: pick a package → name/duration/cover/price auto-fill, then dates & seats. */
function EventForm({ packages, onDone }: { packages: TravelPackage[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [coverOverride, setCoverOverride] = useState<string | null>(null);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      packageId: '',
      name: '',
      departureDate: '',
      returnDate: '',
      bookingCloseDate: '',
      capacity: '20',
      pricePerPerson: '',
      pickupCity: '',
      status: 'LIVE',
    },
  });

  const packageId = useWatch({ control, name: 'packageId' });
  const pkg = packages.find((p) => p.id === packageId);

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.post('/events', {
        packageId: v.packageId,
        name: v.name.trim() || undefined,
        departureDate: v.departureDate,
        returnDate: v.returnDate || undefined,
        bookingCloseDate: v.bookingCloseDate || undefined,
        capacity: Number(v.capacity) || 20,
        pricePerPerson: v.pricePerPerson ? Number(v.pricePerPerson) : undefined,
        pickupCity: v.pickupCity.trim() || undefined,
        status: v.status,
        coverImageOverride: coverOverride || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event-stats'] });
      toast.success('Event created');
      onDone();
    },
    onError: () => toast.error('Could not create this event'),
  });

  return (
    <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
      <Field label="Package" htmlFor="evtPackage" error={errors.packageId?.message} required>
        <Controller
          control={control}
          name="packageId"
          rules={{ required: 'Select a package' }}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={(v) => {
                field.onChange(v);
                const p = packages.find((x) => x.id === v);
                if (p) {
                  setValue('pricePerPerson', String(p.priceAmount));
                  setCoverOverride(null);
                }
              }}
            >
              <SelectTrigger id="evtPackage">
                <SelectValue placeholder="Select a package…" />
              </SelectTrigger>
              <SelectContent>
                {packages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.days}D/{p.nights}N
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      {/* Auto-fetched package summary + optional cover change */}
      {pkg && (
        <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
          <div className="size-16 shrink-0">
            <ImageUpload tile value={coverOverride ?? pkg.bannerImageUrl ?? null} onChange={setCoverOverride} />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold text-foreground">{pkg.name}</p>
            <p className="text-xs text-muted-foreground">
              {pkg.destination} · {pkg.days}D/{pkg.nights}N
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Tap the image to use a different cover for this departure.</p>
          </div>
        </div>
      )}

      <Field label="Event name" htmlFor="evtName" hint="Optional — e.g. 'Independence Day Special'.">
        <Input id="evtName" placeholder="Leave blank to use the package name" {...register('name')} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Departure date" htmlFor="evtDep" error={errors.departureDate?.message} required>
          <Input id="evtDep" type="date" {...register('departureDate', { required: 'Departure date is required' })} />
        </Field>
        <Field label="Return date" htmlFor="evtRet">
          <Input id="evtRet" type="date" {...register('returnDate')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Booking closes" htmlFor="evtClose" hint="Optional.">
          <Input id="evtClose" type="date" {...register('bookingCloseDate')} />
        </Field>
        <Field label="Total seats" htmlFor="evtSeats" required>
          <Input id="evtSeats" type="number" min={1} {...register('capacity')} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price / person" htmlFor="evtPrice" hint="Auto-filled from the package; edit if needed.">
          <Input id="evtPrice" type="number" min={0} {...register('pricePerPerson')} />
        </Field>
        <Field label="Pickup city" htmlFor="evtPickup">
          <Input id="evtPickup" placeholder="e.g. Delhi" {...register('pickupCity')} />
        </Field>
      </div>

      <Field label="Status" htmlFor="evtStatus">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="evtStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </Field>

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner className="size-4" />} Create event
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EventsPage() {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim().toLowerCase(), 300);
  const [statusFilter, setStatusFilter] = useState<'ALL' | EventStatus>('ALL');
  const [formOpen, setFormOpen] = useState(false);

  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: () => api.get<EventItem[]>('/events') });
  const statsQuery = useQuery({ queryKey: ['event-stats'], queryFn: () => api.get<EventStats>('/events/stats') });
  const packagesQuery = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });

  const all = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);
  const events = useMemo(
    () =>
      all.filter(
        (e) =>
          (statusFilter === 'ALL' || e.status === statusFilter) &&
          (!search || e.packageName.toLowerCase().includes(search) || e.destination.toLowerCase().includes(search)),
      ),
    [all, statusFilter, search],
  );

  const s = statsQuery.data;
  const currency = all[0]?.priceCurrency ?? 'INR';

  return (
    <div>
      <PageHeader title="Events" description="Schedule package departures and track seats — one package, unlimited departures.">
        <Button onClick={() => setFormOpen(true)}>
          <Plus /> Create event
        </Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live" value={statsQuery.isLoading ? '—' : `${s?.liveEvents ?? 0} live`} hint={`${s?.totalEvents ?? 0} events total`} />
        <StatCard label="Today's revenue" value={statsQuery.isLoading ? '—' : formatCurrency(s?.todaysRevenue ?? 0, currency)} hint={`${s?.todaysBookings ?? 0} booked today`} />
        <StatCard label="Total departures" value={statsQuery.isLoading ? '—' : String(s?.totalEvents ?? 0)} />
        <StatCard label="Pending settlement" value={statsQuery.isLoading ? '—' : formatCurrency(s?.pendingSettlement ?? 0, currency)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search events…" className="pl-9" aria-label="Search events" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['ALL', ...STATUSES] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === st ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {st === 'ALL' ? 'All' : STATUS_META[st].label}
            </button>
          ))}
        </div>
      </div>

      {eventsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Ticket />}
          title={search || statusFilter !== 'ALL' ? 'No events match' : 'No events yet'}
          description={
            search || statusFilter !== 'ALL'
              ? 'Try a different search or status.'
              : 'Create an event: pick a package, set the departure date and seats. One package can have unlimited departures.'
          }
          action={
            !search && statusFilter === 'ALL' ? (
              <Button onClick={() => setFormOpen(true)}>
                <Plus /> Create event
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const st = STATUS_META[e.status];
            const soldOut = e.booked >= e.capacity;
            return (
              <Card key={e.id} className="flex flex-col overflow-hidden p-0">
                <div className="relative h-36 w-full bg-muted">
                  {e.coverImage ? (
                    <img src={e.coverImage} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <MapPin className="size-6" />
                    </div>
                  )}
                  <span className={cn('absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.pill)}>
                    <span className={cn('size-1.5 rounded-full', st.dot)} />
                    {st.label}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-base font-bold text-foreground">{e.name || e.packageName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {e.packageName} · {e.destination}
                  </p>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="flex items-center gap-2 text-foreground">
                      <CalendarRange className="size-4 text-muted-foreground" />
                      {formatTravelDate(e.departureDate)}
                      {e.returnDate ? ` → ${formatTravelDate(e.returnDate)}` : ''}
                    </p>
                    <p className="flex items-center gap-2 text-foreground">
                      <Users className="size-4 text-muted-foreground" />
                      <span className={cn('font-semibold', soldOut && 'text-destructive')}>
                        {e.booked}/{e.capacity}
                      </span>{' '}
                      <span className="text-muted-foreground">seats</span>
                    </p>
                    <p className="font-display text-lg font-bold text-foreground">
                      {formatCurrency(e.pricePerPerson, e.priceCurrency)}
                      <span className="text-xs font-medium text-muted-foreground"> / person</span>
                    </p>
                  </div>

                  <div className="mt-4 flex flex-1 items-end gap-2">
                    <Button size="sm" className="flex-1" onClick={() => navigate(`/events/${e.id}`)}>
                      <Settings2 /> Manage
                    </Button>
                    <Button variant="outline" size="icon-sm" aria-label="View package page" onClick={() => window.open(`/p/${e.packageId}`, '_blank')}>
                      <MapPin />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy booking link"
                      onClick={async () => {
                        const ok = await copyToClipboard(brochureUrl(e.packageId));
                        ok ? toast.success('Link copied') : toast.error('Copy failed');
                      }}
                    >
                      <Link2 />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create event</DialogTitle>
            <DialogDescription>Pick a package and set the departure — takes about 30 seconds.</DialogDescription>
          </DialogHeader>
          {packagesQuery.data && packagesQuery.data.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              You have no packages yet. Create a package first, then schedule its departures here.
            </div>
          ) : (
            <EventForm packages={packagesQuery.data ?? []} onDone={() => setFormOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
