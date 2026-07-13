import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { MapPin, Moon, Package as PackageIcon, Pencil, Plus, Search, Sun, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

const CARD_TINTS = ['bg-[#E9E4FB]', 'bg-[#D9F2F8]', 'bg-[#FADEE5]', 'bg-[#D9F2E2]', 'bg-[#FCEFD3]', 'bg-[#DCEBFB]'];

interface FormValues {
  name: string;
  destination: string;
  nights: string;
  days: string;
  priceAmount: string;
  priceCurrency: string;
  description: string;
  inclusions: string;
  exclusions: string;
}

function PackageForm({ pkg, onDone }: { pkg: TravelPackage | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: pkg?.name ?? '',
      destination: pkg?.destination ?? '',
      nights: String(pkg?.nights ?? 4),
      days: String(pkg?.days ?? 5),
      priceAmount: pkg?.priceAmount != null ? String(pkg.priceAmount) : '',
      priceCurrency: pkg?.priceCurrency ?? 'INR',
      description: pkg?.description ?? '',
      inclusions: pkg?.inclusions ?? '',
      exclusions: pkg?.exclusions ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      pkg ? api.patch<TravelPackage>(`/packages/${pkg.id}`, payload) : api.post<TravelPackage>('/packages', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success(pkg ? 'Package updated' : 'Package created');
      onDone();
    },
    onError: () => toast.error('Could not save this package'),
  });

  const onSubmit = (v: FormValues) =>
    mutation.mutate({
      name: v.name.trim(),
      destination: v.destination.trim(),
      nights: Number(v.nights) || 0,
      days: Number(v.days) || 1,
      priceAmount: Number(v.priceAmount) || 0,
      priceCurrency: (v.priceCurrency || 'INR').toUpperCase(),
      description: v.description.trim() || null,
      inclusions: v.inclusions.trim() || null,
      exclusions: v.exclusions.trim() || null,
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Package name" htmlFor="pkgName" error={errors.name?.message} required>
        <Input id="pkgName" placeholder="Bali Honeymoon Special" {...register('name', { required: 'Name is required' })} />
      </Field>
      <Field label="Destination" htmlFor="pkgDest" error={errors.destination?.message} required>
        <Input id="pkgDest" placeholder="Bali, Indonesia" {...register('destination', { required: 'Destination is required' })} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Nights" htmlFor="pkgNights">
          <Input id="pkgNights" type="number" min={0} {...register('nights')} />
        </Field>
        <Field label="Days" htmlFor="pkgDays">
          <Input id="pkgDays" type="number" min={1} {...register('days')} />
        </Field>
        <Field label="Price" htmlFor="pkgPrice" error={errors.priceAmount?.message}>
          <Input id="pkgPrice" type="number" min={0} {...register('priceAmount', { required: true })} />
        </Field>
        <Field label="Currency" htmlFor="pkgCurrency">
          <Input id="pkgCurrency" maxLength={3} className="uppercase" {...register('priceCurrency')} />
        </Field>
      </div>
      <Field label="Description" htmlFor="pkgDesc">
        <Textarea id="pkgDesc" rows={2} placeholder="What makes this trip special…" {...register('description')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Inclusions" htmlFor="pkgInc" hint="One per line">
          <Textarea id="pkgInc" rows={3} placeholder={'Flights\nHotel 4★\nBreakfast'} {...register('inclusions')} />
        </Field>
        <Field label="Exclusions" htmlFor="pkgExc" hint="One per line">
          <Textarea id="pkgExc" rows={3} placeholder={'Visa fees\nLunch & dinner'} {...register('exclusions')} />
        </Field>
      </div>
      <DialogFooter className="pt-2">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Spinner />}
          {pkg ? 'Save changes' : 'Create package'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function PackagesPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPackage | null>(null);
  const [deleting, setDeleting] = useState<TravelPackage | null>(null);

  const queryString = useMemo(() => (search ? `?search=${encodeURIComponent(search)}` : ''), [search]);
  const packagesQuery = useQuery({
    queryKey: ['packages', queryString],
    queryFn: () => api.get<TravelPackage[]>(`/packages${queryString}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/packages/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] });
      toast.success('Package deleted');
      setDeleting(null);
    },
    onError: () => toast.error('Could not delete this package'),
  });

  const toggleMutation = useMutation({
    mutationFn: (pkg: TravelPackage) => api.patch<TravelPackage>(`/packages/${pkg.id}`, { isActive: !pkg.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packages'] }),
  });

  const packages = packagesQuery.data ?? [];

  return (
    <div>
      <PageHeader title="Packages" description="Reusable trip templates your team can sell in one click.">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus /> New package
        </Button>
      </PageHeader>

      <div className="mb-5">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name or destination…"
            className="pl-9"
            aria-label="Search packages"
          />
        </div>
      </div>

      {packagesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={search ? 'No packages match' : 'No packages yet'}
          description={search ? 'Try a different search.' : 'Create your first trip template — price it once, sell it many times.'}
          action={
            !search ? (
              <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus /> New package
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, i) => (
            <div
              key={pkg.id}
              className={cn(
                'flex flex-col rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-1',
                CARD_TINTS[i % CARD_TINTS.length],
                !pkg.isActive && 'opacity-60',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-bold text-foreground">{pkg.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-foreground/60">
                    <MapPin className="size-3.5" /> {pkg.destination}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon-sm" aria-label="Edit package" onClick={() => { setEditing(pkg); setFormOpen(true); }}>
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Delete package" onClick={() => setDeleting(pkg)}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3 text-xs font-medium text-foreground/70">
                <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
                  <Moon className="size-3" /> {pkg.nights}N
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
                  <Sun className="size-3" /> {pkg.days}D
                </span>
                <button
                  type="button"
                  onClick={() => toggleMutation.mutate(pkg)}
                  className={cn(
                    'ml-auto rounded-full px-2.5 py-1 font-semibold transition-opacity hover:opacity-75',
                    pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
                  )}
                >
                  {pkg.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>

              {pkg.description && <p className="mt-3 line-clamp-2 text-sm text-foreground/70">{pkg.description}</p>}

              <div className="mt-4 flex flex-1 items-end justify-between">
                <p className="font-display text-2xl font-bold text-foreground">
                  {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
                  <span className="text-xs font-medium text-foreground/50"> / person</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit package' : 'New package'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Update this trip template.' : 'Create a reusable trip template.'}
            </DialogDescription>
          </DialogHeader>
          {formOpen && <PackageForm key={editing?.id ?? 'new'} pkg={editing} onDone={() => setFormOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete package?"
        description={
          deleting ? (
            <>
              <span className="font-medium text-foreground">{deleting.name}</span> will be removed. Existing
              bookings that used it are not affected.
            </>
          ) : undefined
        }
        confirmLabel="Delete package"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
