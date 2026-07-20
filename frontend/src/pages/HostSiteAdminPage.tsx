import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, Globe2, Plus, Star, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import type { HostReview, Organization, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ImageUpload } from '@/components/ui/image-upload';
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
      <PageHeader title="Host Page" description="Your public mini-website — banner, about, packages, departures, gallery, team, reviews & contact.">
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
          <Globe2 className="size-3.5" /> Featured packages & departures fill in automatically from packages with “Show on Host Page” on. Logo, colours and Instagram come from Organization settings.
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

      <GalleryManager />
      <TeamManager />
      <ReviewsManager />
    </div>
  );
}

/* ------------------------------- Gallery ---------------------------------- */
function GalleryManager() {
  const { organization, refresh } = useAuth();
  const [images, setImages] = useState<string[]>(organization?.hostGallery ?? []);
  const [dirty, setDirty] = useState(false);

  const save = useMutation({
    mutationFn: (next: string[]) => api.patch<Organization>('/organization', { hostGallery: next }),
    onSuccess: async () => {
      await refresh?.();
      setDirty(false);
      toast.success('Gallery saved');
    },
    onError: () => toast.error('Could not save the gallery'),
  });

  const update = (next: string[]) => {
    setImages(next);
    setDirty(true);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  return (
    <Card className="mt-6 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">Gallery</h2>
        {dirty && (
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate(images)}>
            {save.isPending && <Spinner className="size-4" />} Save gallery
          </Button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((url, i) => (
          <div key={`${url}-${i}`} className="group relative">
            <img src={url} alt="" className="aspect-square w-full rounded-lg object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 rounded-b-lg bg-black/50 p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" aria-label="Move left" onClick={() => move(i, -1)} className="text-white disabled:opacity-30" disabled={i === 0}>
                <ChevronUp className="size-4 -rotate-90" />
              </button>
              <button type="button" aria-label="Move right" onClick={() => move(i, 1)} className="text-white disabled:opacity-30" disabled={i === images.length - 1}>
                <ChevronDown className="size-4 -rotate-90" />
              </button>
              <button type="button" aria-label="Remove" onClick={() => update(images.filter((_, k) => k !== i))} className="text-white hover:text-red-300">
                <X className="size-4" />
              </button>
            </div>
          </div>
        ))}
        {images.length < 40 && (
          <ImageUpload tile value={null} onChange={(url) => url && update([...images, url])} />
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Upload photos, hover a tile to reorder or remove. Shown in the Gallery section.</p>
    </Card>
  );
}

/* --------------------------------- Team ----------------------------------- */
function TeamManager() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });
  const users = (usersQuery.data ?? []).filter((u) => u.status === 'ACTIVE');
  const [editing, setEditing] = useState<User | null>(null);

  const toggle = useMutation({
    mutationFn: (u: User) => api.patch<User>(`/users/${u.id}`, { featureOnHostpage: !u.featureOnHostpage }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
    onError: () => toast.error('Could not update this member'),
  });

  return (
    <Card className="mt-6 p-5">
      <h2 className="mb-1 font-display text-base font-semibold text-foreground">Team</h2>
      <p className="mb-4 text-xs text-muted-foreground">Toggle a member on to feature them on the Host Page, then add their public photo, title and bio.</p>
      <div className="divide-y divide-border">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 py-3">
            {u.publicPhotoUrl ? (
              <img src={u.publicPhotoUrl} alt="" className="size-10 rounded-full object-cover" />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                {u.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">{u.name}</p>
              <p className="truncate text-xs text-muted-foreground">{u.publicTitle || u.email}</p>
            </div>
            {u.featureOnHostpage && (
              <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                Public profile
              </Button>
            )}
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              Feature
              <Switch checked={u.featureOnHostpage} onCheckedChange={() => toggle.mutate(u)} aria-label="Feature on Host Page" />
            </label>
          </div>
        ))}
        {users.length === 0 && <p className="py-3 text-sm text-muted-foreground">No active team members.</p>}
      </div>
      {editing && <TeamMemberDialog user={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function TeamMemberDialog({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [photoUrl, setPhotoUrl] = useState<string | null>(user.publicPhotoUrl ?? null);
  const { register, handleSubmit } = useForm<{ publicTitle: string; publicBio: string }>({
    defaultValues: { publicTitle: user.publicTitle ?? '', publicBio: user.publicBio ?? '' },
  });
  const save = useMutation({
    mutationFn: (v: { publicTitle: string; publicBio: string }) =>
      api.patch<User>(`/users/${user.id}`, {
        publicPhotoUrl: photoUrl,
        publicTitle: v.publicTitle.trim() || null,
        publicBio: v.publicBio.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Public profile saved');
      onClose();
    },
    onError: () => toast.error('Could not save'),
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 font-display text-base font-semibold text-foreground">Public profile — {user.name}</h3>
        <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-4">
          <Field label="Photo">
            <div className="max-w-[10rem]">
              <ImageUpload tile value={photoUrl} onChange={setPhotoUrl} />
            </div>
          </Field>
          <Field label="Title" htmlFor="tmTitle">
            <Input id="tmTitle" placeholder="Founder & Trip Leader" {...register('publicTitle')} />
          </Field>
          <Field label="Short bio" htmlFor="tmBio">
            <Textarea id="tmBio" rows={3} maxLength={500} {...register('publicBio')} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner className="size-4" />} Save
            </Button>
          </div>
        </form>
      </Card>
    </div>
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

