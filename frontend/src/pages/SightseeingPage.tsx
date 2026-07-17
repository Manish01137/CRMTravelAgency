import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Clock, MapPin, MapPinned, Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SightseeingActivity } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
import { useDebounce } from '@/lib/useDebounce';
import { shortId } from '@/lib/format';

interface FormValues {
  name: string;
  city: string;
  country: string;
  timings: string;
  points: string;
  notes: string;
}

function ActivityForm({ activity, onDone }: { activity: SightseeingActivity | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(activity?.imageUrl ?? null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: activity?.name ?? '',
      city: activity?.city ?? '',
      country: activity?.country ?? 'India',
      timings: activity?.timings ?? '',
      points: String(activity?.points ?? 3),
      notes: activity?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      activity
        ? api.patch<SightseeingActivity>(`/sightseeing/${activity.id}`, payload)
        : api.post<SightseeingActivity>('/sightseeing', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sightseeing'] });
      toast.success(activity ? 'Activity updated' : 'Activity added');
      onDone();
    },
    onError: () => toast.error('Could not save this activity'),
  });

  const onSubmit = (v: FormValues) =>
    mutation.mutate({
      name: v.name.trim(),
      city: v.city.trim(),
      country: v.country.trim() || 'India',
      timings: v.timings.trim() || null,
      points: Math.min(100, Math.max(0, Number(v.points) || 0)),
      imageUrl: imageUrl || null,
      notes: v.notes.trim() || null,
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {/* Photo first — per the requested flow. */}
      <Field label="Photo" htmlFor="actPhoto" hint="Upload a preview image first, then fill in the details.">
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </Field>
      <Field label="Activity name" htmlFor="actName" error={errors.name?.message} required>
        <Input id="actName" placeholder="e.g. Chitkul Exploration – Khab – Nako" {...register('name', { required: 'Name is required' })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" htmlFor="actCity" error={errors.city?.message} required>
          <Input id="actCity" placeholder="Sangla" {...register('city', { required: 'City is required' })} />
        </Field>
        <Field label="Country" htmlFor="actCountry">
          <Input id="actCountry" placeholder="India" {...register('country')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Timings" htmlFor="actTimings">
          <Input id="actTimings" placeholder="09:00 AM to 06:00 PM" {...register('timings')} />
        </Field>
        <Field label="Points" htmlFor="actPoints" hint="Interest/effort score (0–100).">
          <Input id="actPoints" type="number" min={0} max={100} {...register('points')} />
        </Field>
      </div>
      <Field label="Notes" htmlFor="actNotes">
        <Textarea id="actNotes" rows={2} placeholder="What travellers do here, tips…" {...register('notes')} />
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner className="size-4" />}
          {activity ? 'Save changes' : 'Add activity'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function SightseeingPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 300);
  const [city, setCity] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SightseeingActivity | null>(null);
  const [deleting, setDeleting] = useState<SightseeingActivity | null>(null);

  const query = useQuery({
    queryKey: ['sightseeing', search],
    queryFn: () => api.get<SightseeingActivity[]>(search ? `/sightseeing?search=${encodeURIComponent(search)}` : '/sightseeing'),
  });

  const all = useMemo(() => query.data ?? [], [query.data]);
  const cities = useMemo(() => [...new Set(all.map((a) => a.city))].sort(), [all]);
  const countries = useMemo(() => [...new Set(all.map((a) => a.country))].sort(), [all]);

  const items = useMemo(
    () => all.filter((a) => (!city || a.city === city) && (!country || a.country === country)),
    [all, city, country],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sightseeing/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sightseeing'] });
      toast.success('Activity deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete this activity'),
  });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (a: SightseeingActivity) => {
    setEditing(a);
    setFormOpen(true);
  };

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );

  return (
    <div>
      <PageHeader title="Sightseeing" description="Your reusable activity library — used across packages and itineraries.">
        <Button onClick={openNew}>
          <Plus /> New activity
        </Button>
      </PageHeader>

      <div className="mb-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search activities…"
            className="pl-9"
            aria-label="Search activities"
          />
        </div>
      </div>

      {(cities.length > 0 || countries.length > 0) && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!city} onClick={() => setCity('')}>
              All Cities
            </Chip>
            {cities.map((c) => (
              <Chip key={c} active={city === c} onClick={() => setCity(city === c ? '' : c)}>
                {c}
              </Chip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={!country} onClick={() => setCountry('')}>
              All Countries
            </Chip>
            {countries.map((c) => (
              <Chip key={c} active={country === c} onClick={() => setCountry(country === c ? '' : c)}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {query.isLoading ? (
        <Card className="divide-y divide-border p-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-56" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MapPinned />}
          title={search || city || country ? 'No activities match' : 'No activities yet'}
          description={
            search || city || country
              ? 'Try a different search or filter.'
              : 'Add sightseeing spots and experiences to reuse when building packages and itineraries.'
          }
          action={
            !search && !city && !country ? (
              <Button onClick={openNew}>
                <Plus /> New activity
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-primary/[0.04] text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Preview</th>
                  <th className="px-4 py-3 font-semibold">Activity</th>
                  <th className="px-4 py-3 font-semibold">City</th>
                  <th className="px-4 py-3 font-semibold">Country</th>
                  <th className="px-4 py-3 font-semibold">Timings</th>
                  <th className="px-4 py-3 font-semibold">Points</th>
                  <th className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((a, i) => (
                  <tr key={a.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3">
                      {a.imageUrl ? (
                        <img src={a.imageUrl} alt="" className="size-11 rounded-lg object-cover" />
                      ) : (
                        <span className="flex size-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <MapPin className="size-4" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{a.name}</p>
                      <p className="text-[11px] text-muted-foreground">#{shortId(a.id)}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.city}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.country}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.timings ? (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" /> {a.timings}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" /> {a.points}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Edit activity" onClick={() => openEdit(a)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete activity"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleting(a)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Total: {items.length}</p>
        </Card>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit activity' : 'New activity'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this sightseeing spot.' : 'Add a sightseeing spot or experience to your library.'}
            </DialogDescription>
          </DialogHeader>
          <ActivityForm key={editing?.id ?? 'new'} activity={editing} onDone={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this activity?"
        description={`"${deleting?.name}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
