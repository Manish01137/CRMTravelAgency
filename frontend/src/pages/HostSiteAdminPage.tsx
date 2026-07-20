import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Globe2, MapPin, Package as PackageIcon, Plus, Star, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { HostReview, Organization, TravelPackage } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageUpload } from '@/components/ui/image-upload';
import { formatCurrency } from '@/lib/format';
import { copyToClipboard } from '@/lib/share';

interface FormValues {
  aboutText: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
}

export function HostSiteAdminPage() {
  const { organization, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(organization?.bannerImageUrl ?? null);
  const [copied, setCopied] = useState(false);

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      aboutText: organization?.aboutText ?? '',
      contactPhone: organization?.contactPhone ?? '',
      contactEmail: organization?.contactEmail ?? '',
      address: organization?.address ?? '',
    },
  });

  const siteUrl = organization ? `${window.location.origin}/${organization.slug}` : '';

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.patch<Organization>('/organization', {
        bannerImageUrl: banner,
        aboutText: v.aboutText.trim() || null,
        contactPhone: v.contactPhone.trim() || null,
        contactEmail: v.contactEmail.trim() || null,
        address: v.address.trim() || null,
      }),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      await refresh?.();
      toast.success('Website updated');
    },
    onError: () => toast.error('Could not save your website'),
  });

  const copy = async () => {
    if (await copyToClipboard(siteUrl)) {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <PageHeader title="Host Page" description="Your public mini-website — hero banner, bio, all your packages, reviews and contact.">
        <Button asChild>
          <a href={siteUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> Open website
          </a>
        </Button>
      </PageHeader>

      <Card className="mb-6 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your website link</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={siteUrl} className="flex-1 font-medium" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="text-emerald-600" /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button asChild>
              <a href={siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Open
              </a>
            </Button>
          </div>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Globe2 className="size-3.5" /> Every package your org has appears automatically. Logo, colours, bio and Instagram come from Organization settings.
        </p>
      </Card>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">Banner &amp; about</h2>
          <Field label="Banner image" htmlFor="banner" hint="The big hero image at the top of your website.">
            <ImageUpload value={banner} onChange={setBanner} />
          </Field>
          <Field label="About us" htmlFor="aboutText" className="mt-4">
            <Textarea id="aboutText" rows={5} placeholder="Tell visitors who you are, what you do and why travellers trust you…" {...register('aboutText')} />
          </Field>
        </Card>

        <PackagesPreview />

        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" htmlFor="contactPhone">
              <Input id="contactPhone" placeholder="+91 …" {...register('contactPhone')} />
            </Field>
            <Field label="Email" htmlFor="contactEmail">
              <Input id="contactEmail" type="email" placeholder="hello@agency.com" {...register('contactEmail')} />
            </Field>
          </div>
          <Field label="Address" htmlFor="address" className="mt-4">
            <Input id="address" placeholder="Office address" {...register('address')} />
          </Field>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="size-4" />} Save website
          </Button>
        </div>
      </form>

      <ReviewsManager />
    </div>
  );
}

/* ------------------------------ Packages preview -------------------------- */
/** Read-only preview of the packages that appear on the live Host Page. Host
 *  Page always shows ALL of the org's packages — this is a shortcut/preview, not
 *  a visibility toggle. Refetches on mount so it reflects new packages on revisit. */
function PackagesPreview() {
  const navigate = useNavigate();
  const packagesQuery = useQuery({
    queryKey: ['packages'],
    queryFn: () => api.get<TravelPackage[]>('/packages'),
    refetchOnMount: 'always',
  });
  const packages = packagesQuery.data ?? [];

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">Packages</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">All of your packages appear on your website automatically.</p>
        </div>
        {packages.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/packages/new')}>
            <Plus /> Add Package
          </Button>
        )}
      </div>

      {packagesQuery.isLoading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <PackageIcon className="size-6" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">You don't have any packages yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Add one to show it on your website.</p>
          <Button type="button" className="mt-4" onClick={() => navigate('/packages/new')}>
            <Plus /> Add Package
          </Button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-2.5">
              {p.bannerImageUrl ? (
                <img src={p.bannerImageUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <MapPin className="size-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  from {formatCurrency(p.priceAmount, p.priceCurrency)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* -------------------------------- Reviews --------------------------------- */
function ReviewsManager() {
  const queryClient = useQueryClient();
  const reviewsQuery = useQuery({ queryKey: ['host-reviews'], queryFn: () => api.get<HostReview[]>('/host-reviews') });
  const reviews = reviewsQuery.data ?? [];
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { register, handleSubmit, reset } = useForm<{ reviewerName: string; quote: string; rating: string }>({
    defaultValues: { reviewerName: '', quote: '', rating: '5' },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['host-reviews'] });
  const create = useMutation({
    mutationFn: (v: { reviewerName: string; quote: string; rating: string }) =>
      api.post<HostReview>('/host-reviews', {
        reviewerName: v.reviewerName.trim(),
        quote: v.quote.trim(),
        rating: v.rating ? Number(v.rating) : undefined,
        photoUrl: photoUrl || undefined,
      }),
    onSuccess: () => {
      invalidate();
      reset();
      setPhotoUrl(null);
      toast.success('Review added');
    },
    onError: () => toast.error('Could not add the review'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/host-reviews/${id}`),
    onSuccess: invalidate,
  });

  return (
    <Card className="mt-6 p-5">
      <h2 className="mb-4 font-display text-base font-semibold text-foreground">Reviews</h2>
      <form onSubmit={handleSubmit((v) => create.mutate(v))} className="mb-5 grid gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="max-w-[8rem]">
          <ImageUpload tile value={photoUrl} onChange={setPhotoUrl} />
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem]">
            <Input placeholder="Reviewer name" {...register('reviewerName', { required: true })} />
            <Input type="number" min={1} max={5} placeholder="Rating" {...register('rating')} />
          </div>
          <Textarea rows={2} placeholder="Their quote…" {...register('quote', { required: true })} />
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={create.isPending}>
              <Plus /> Add review
            </Button>
          </div>
        </div>
      </form>

      <div className="divide-y divide-border">
        {reviews.map((r) => (
          <div key={r.id} className="flex items-start gap-3 py-3">
            {r.photoUrl ? (
              <img src={r.photoUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                {r.reviewerName.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground">{r.reviewerName}</p>
                {r.rating != null && (
                  <span className="flex items-center gap-0.5 text-amber-400">
                    {Array.from({ length: r.rating }).map((_, i) => (
                      <Star key={i} className="size-3 fill-current" />
                    ))}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">“{r.quote}”</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete review"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove.mutate(r.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {reviews.length === 0 && <p className="py-3 text-sm text-muted-foreground">No reviews yet.</p>}
      </div>
    </Card>
  );
}

