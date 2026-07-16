import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Hotel as HotelIcon, Mail, MapPin, Pencil, Phone, Plus, Search, Star, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Hotel } from '@/types';
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';

interface FormValues {
  name: string;
  city: string;
  address: string;
  starRating: string;
  phone: string;
  email: string;
  pricePerNight: string;
  currency: string;
  notes: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex text-amber-400" aria-label={`${rating} star hotel`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn('size-3.5', i < rating ? 'fill-current' : 'text-muted-foreground/25')} strokeWidth={i < rating ? 0 : 1.5} />
      ))}
    </span>
  );
}

function HotelForm({ hotel, onDone }: { hotel: Hotel | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [images, setImages] = useState<string[]>(hotel?.images ?? []);
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: hotel?.name ?? '',
      city: hotel?.city ?? '',
      address: hotel?.address ?? '',
      starRating: String(hotel?.starRating ?? 3),
      phone: hotel?.phone ?? '',
      email: hotel?.email ?? '',
      pricePerNight: hotel?.pricePerNight != null ? String(hotel.pricePerNight) : '',
      currency: hotel?.currency ?? 'INR',
      notes: hotel?.notes ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      hotel ? api.patch<Hotel>(`/hotels/${hotel.id}`, payload) : api.post<Hotel>('/hotels', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast.success(hotel ? 'Hotel updated' : 'Hotel added');
      onDone();
    },
    onError: () => toast.error('Could not save this hotel'),
  });

  const onSubmit = (v: FormValues) =>
    mutation.mutate({
      name: v.name.trim(),
      city: v.city.trim(),
      address: v.address.trim() || null,
      starRating: Math.min(5, Math.max(1, Number(v.starRating) || 3)),
      phone: v.phone.trim() || null,
      email: v.email.trim() || null,
      pricePerNight: v.pricePerNight ? Number(v.pricePerNight) : null,
      currency: (v.currency || 'INR').toUpperCase(),
      notes: v.notes.trim() || null,
      images,
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Hotel name" htmlFor="hotelName" error={errors.name?.message} required>
          <Input id="hotelName" placeholder="The Grand Bali Resort" {...register('name', { required: 'Name is required' })} />
        </Field>
        <Field label="City" htmlFor="hotelCity" error={errors.city?.message} required>
          <Input id="hotelCity" placeholder="Ubud" {...register('city', { required: 'City is required' })} />
        </Field>
      </div>
      <Field label="Address" htmlFor="hotelAddress">
        <Input id="hotelAddress" placeholder="Street, area…" {...register('address')} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Stars (1–5)" htmlFor="hotelStars">
          <Input id="hotelStars" type="number" min={1} max={5} {...register('starRating')} />
        </Field>
        <Field label="Price / night" htmlFor="hotelPrice">
          <Input id="hotelPrice" type="number" min={0} {...register('pricePerNight')} />
        </Field>
        <Field label="Currency" htmlFor="hotelCurrency">
          <Input id="hotelCurrency" maxLength={3} className="uppercase" {...register('currency')} />
        </Field>
        <Field label="Phone" htmlFor="hotelPhone">
          <Input id="hotelPhone" {...register('phone')} />
        </Field>
      </div>
      <Field label="Email" htmlFor="hotelEmail" error={errors.email?.message}>
        <Input id="hotelEmail" type="email" placeholder="reservations@hotel.com" {...register('email')} />
      </Field>
      <Field label="Notes" htmlFor="hotelNotes">
        <Textarea id="hotelNotes" rows={2} placeholder="Contract rates, contact person…" {...register('notes')} />
      </Field>
      <Field label="Photos" htmlFor="hotelPhotos" hint="Room, lobby, facade… shown in packages and itineraries (up to 8).">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((url, i) => (
            <div key={`${url}-${i}`} className="relative">
              <ImageUpload
                tile
                value={url}
                onChange={(next) =>
                  setImages((cur) =>
                    next ? cur.map((u, j) => (j === i ? next : u)) : cur.filter((_, j) => j !== i),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove photo"
                className="absolute right-1 top-1 bg-white/90 shadow-sm"
                onClick={() => setImages((cur) => cur.filter((_, j) => j !== i))}
              >
                <Trash2 className="text-destructive" />
              </Button>
            </div>
          ))}
          {images.length < 8 && (
            <ImageUpload tile value={null} onChange={(url) => url && setImages((cur) => [...cur, url])} />
          )}
        </div>
      </Field>
      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {hotel ? 'Save changes' : 'Add hotel'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function HotelsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Hotel | null>(null);
  const [deleting, setDeleting] = useState<Hotel | null>(null);

  const queryString = useMemo(() => (search ? `?search=${encodeURIComponent(search)}` : ''), [search]);
  const hotelsQuery = useQuery({
    queryKey: ['hotels', queryString],
    queryFn: () => api.get<Hotel[]>(`/hotels${queryString}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hotels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      toast.success('Hotel deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete this hotel'),
  });

  const toggleMutation = useMutation({
    mutationFn: (hotel: Hotel) => api.patch<Hotel>(`/hotels/${hotel.id}`, { isActive: !hotel.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotels'] }),
  });

  const hotels = hotelsQuery.data ?? [];

  return (
    <div>
      <PageHeader title="Hotels" description="Your partner-hotel directory with contacts and contract rates.">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus /> Add hotel
        </Button>
      </PageHeader>

      <div className="mb-5">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search hotel or city…"
            className="pl-9"
            aria-label="Search hotels"
          />
        </div>
      </div>

      {hotelsQuery.isLoading ? (
        <Card className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <Skeleton className="size-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </Card>
      ) : hotels.length === 0 ? (
        <EmptyState
          icon={<HotelIcon />}
          title={search ? 'No hotels match' : 'No hotels yet'}
          description={search ? 'Try a different search.' : 'Build your partner directory so quotes and itineraries come together faster.'}
          action={
            !search ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus /> Add hotel
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-primary/[0.04] text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Hotel</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Price / night</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {hotels.map((hotel) => (
                    <tr key={hotel.id} className="transition-colors hover:bg-muted/50">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {hotel.images?.[0] ? (
                            <img src={hotel.images[0]} alt="" className="size-9 shrink-0 rounded-xl object-cover" />
                          ) : (
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <HotelIcon className="size-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{hotel.name}</p>
                            {hotel.address && <p className="truncate text-xs text-muted-foreground">{hotel.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-muted-foreground">{hotel.city}</td>
                      <td className="px-4 py-3.5">
                        <Stars rating={hotel.starRating} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          {hotel.phone && (
                            <p className="flex items-center gap-1">
                              <Phone className="size-3" /> {hotel.phone}
                            </p>
                          )}
                          {hotel.email && (
                            <p className="flex items-center gap-1">
                              <Mail className="size-3" /> {hotel.email}
                            </p>
                          )}
                          {!hotel.phone && !hotel.email && '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-foreground">
                        {hotel.pricePerNight != null ? formatCurrency(hotel.pricePerNight, hotel.currency) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggleMutation.mutate(hotel)}
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-75',
                            hotel.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
                          )}
                        >
                          {hotel.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" aria-label="Edit hotel" onClick={() => { setEditing(hotel); setFormOpen(true); }}>
                            <Pencil />
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Delete hotel" onClick={() => setDeleting(hotel)}>
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {hotels.map((hotel) => (
              <Card key={hotel.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{hotel.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="size-3" /> {hotel.city}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit hotel" onClick={() => { setEditing(hotel); setFormOpen(true); }}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete hotel" onClick={() => setDeleting(hotel)}>
                      <Trash2 className="text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Stars rating={hotel.starRating} />
                  <span className="text-sm font-medium text-foreground">
                    {hotel.pricePerNight != null ? `${formatCurrency(hotel.pricePerNight, hotel.currency)}/night` : ''}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit hotel' : 'Add hotel'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this hotel’s details.' : 'Add a partner hotel to your directory.'}
            </DialogDescription>
          </DialogHeader>
          {formOpen && <HotelForm key={editing?.id ?? 'new'} hotel={editing} onDone={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete hotel?"
        description={
          deleting ? (
            <>
              <span className="font-medium text-foreground">{deleting.name}</span> will be removed from your
              directory.
            </>
          ) : undefined
        }
        confirmLabel="Delete hotel"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
