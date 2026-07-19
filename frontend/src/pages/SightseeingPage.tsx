import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { MapPin, MapPinned, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
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

interface FormValues {
  name: string;
  notes: string; // description
}

function ActivityForm({ activity, onDone }: { activity: SightseeingActivity | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [imageUrl, setImageUrl] = useState<string | null>(activity?.imageUrl ?? null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { name: activity?.name ?? '', notes: activity?.notes ?? '' },
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
    mutation.mutate({ name: v.name.trim(), notes: v.notes.trim() || null, imageUrl: imageUrl || null });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Cover image" htmlFor="actPhoto" hint="Optional — shown when this activity is added to a package day.">
        <ImageUpload value={imageUrl} onChange={setImageUrl} />
      </Field>
      <Field label="Activity name" htmlFor="actName" error={errors.name?.message} required>
        <Input id="actName" placeholder="e.g. Gulmarg Excursion" {...register('name', { required: 'Name is required' })} />
      </Field>
      <Field label="Description" htmlFor="actNotes" hint="This text auto-fills the day when you pick this activity in a package.">
        <Textarea
          id="actNotes"
          rows={4}
          placeholder="What travellers do here — pickup, sightseeing spots, activities…"
          {...register('notes')}
        />
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
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SightseeingActivity | null>(null);
  const [deleting, setDeleting] = useState<SightseeingActivity | null>(null);

  const query = useQuery({
    queryKey: ['sightseeing', search],
    queryFn: () => api.get<SightseeingActivity[]>(search ? `/sightseeing?search=${encodeURIComponent(search)}` : '/sightseeing'),
  });

  const items = useMemo(() => query.data ?? [], [query.data]);

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

  return (
    <div>
      <PageHeader title="Sightseeing" description="Reusable activities you drop into package days — write once, reuse everywhere.">
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

      {query.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<MapPinned />}
          title={search ? 'No activities match' : 'No activities yet'}
          description={
            search
              ? 'Try a different search.'
              : 'Add activities (with a photo and description) to reuse when building package day plans.'
          }
          action={
            !search ? (
              <Button onClick={openNew}>
                <Plus /> New activity
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <Card key={a.id} className="flex flex-col overflow-hidden p-0">
              <div className="h-32 w-full bg-muted">
                {a.imageUrl ? (
                  <img src={a.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <MapPin className="size-6" />
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-bold text-foreground">{a.name}</h3>
                {a.notes && <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted-foreground">{a.notes}</p>}
                <div className="mt-3 flex justify-end gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Edit activity" onClick={() => openEdit(a)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete activity"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleting(a)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit activity' : 'New activity'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this activity.' : 'Add a reusable activity for your package day plans.'}
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
