import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Link2, MapPin, Moon, Package as PackageIcon, Pencil, Plus, Search, Send, Sun, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage } from '@/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatCurrency } from '@/lib/format';
import { useDebounce } from '@/lib/useDebounce';
import { brochureUrl, copyToClipboard, packageWhatsAppUrl } from '@/lib/share';

const CARD_TINTS = ['bg-[#E9E4FB]', 'bg-[#D9F2F8]', 'bg-[#FADEE5]', 'bg-[#D9F2E2]', 'bg-[#FCEFD3]', 'bg-[#DCEBFB]'];

export function PackagesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput.trim(), 350);
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
        <Button onClick={() => navigate('/packages/new')}>
          <Plus /> New package
        </Button>
      </PageHeader>

      <div className="mb-5">
        <div className="relative sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search name, destination or code…"
            className="pl-9"
            aria-label="Search packages"
          />
        </div>
      </div>

      {packagesQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={search ? 'No packages match' : 'No packages yet'}
          description={search ? 'Try a different search.' : 'Build your first trip template — price it once, sell it many times.'}
          action={
            !search ? (
              <Button onClick={() => navigate('/packages/new')}>
                <Plus /> New package
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, i) => {
            const discounted = pkg.originalPrice != null && pkg.originalPrice > pkg.priceAmount;
            return (
              <div
                key={pkg.id}
                className={cn(
                  'flex cursor-pointer flex-col overflow-hidden rounded-2xl transition-transform duration-200 hover:-translate-y-1',
                  CARD_TINTS[i % CARD_TINTS.length],
                  !pkg.isActive && 'opacity-70',
                )}
                onClick={() => navigate(`/packages/${pkg.id}/edit`)}
              >
                {pkg.bannerImageUrl && (
                  <img src={pkg.bannerImageUrl} alt="" className="h-28 w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-lg font-bold text-foreground">{pkg.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-foreground/60">
                        <MapPin className="size-3.5" /> {pkg.destination}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" aria-label="Edit package" onClick={() => navigate(`/packages/${pkg.id}/edit`)}>
                        <Pencil />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Delete package" onClick={() => setDeleting(pkg)}>
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {pkg.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pkg.categories.slice(0, 3).map((c) => (
                        <span key={c} className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-foreground/70">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-3 text-xs font-medium text-foreground/70">
                    <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
                      <Moon className="size-3" /> {pkg.nights}N
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1">
                      <Sun className="size-3" /> {pkg.days}D
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMutation.mutate(pkg);
                      }}
                      className={cn(
                        'ml-auto rounded-full px-2.5 py-1 font-semibold transition-opacity hover:opacity-75',
                        pkg.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
                      )}
                    >
                      {pkg.isActive ? 'Published' : 'Draft'}
                    </button>
                  </div>

                  <div className="mt-4 flex flex-1 items-end">
                    <p className="font-display text-2xl font-bold text-foreground">
                      {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
                      {discounted && (
                        <span className="ml-2 align-middle text-sm font-medium text-foreground/40 line-through">
                          {formatCurrency(pkg.originalPrice!, pkg.priceCurrency)}
                        </span>
                      )}
                      <span className="text-xs font-medium text-foreground/50"> / person</span>
                    </p>
                  </div>

                  {/* Share row: brochure PDF, copy public link, WhatsApp */}
                  <div className="mt-4 flex gap-2 border-t border-white/50 pt-3" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-white/60 bg-white/60"
                      onClick={() => window.open(`/p/${pkg.id}`, '_blank')}
                    >
                      <FileText /> Brochure
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      aria-label="Copy share link"
                      className="border-white/60 bg-white/60"
                      onClick={async () => {
                        const ok = await copyToClipboard(brochureUrl(pkg.id));
                        ok ? toast.success('Share link copied') : toast.error('Copy failed — link: ' + brochureUrl(pkg.id));
                      }}
                    >
                      <Link2 />
                    </Button>
                    <Button
                      size="icon-sm"
                      aria-label="Send on WhatsApp"
                      className="bg-emerald-500 text-white hover:bg-emerald-600"
                      onClick={() => window.open(packageWhatsAppUrl(pkg, pkg.contactNumber), '_blank')}
                    >
                      <Send />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
