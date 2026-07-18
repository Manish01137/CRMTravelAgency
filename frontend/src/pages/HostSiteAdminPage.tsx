import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Globe2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Organization } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
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

  const siteUrl = organization ? `${window.location.origin}/site/${organization.slug}` : '';

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
    const ok = await copyToClipboard(siteUrl);
    if (ok) {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div>
      <PageHeader title="Host Page" description="Your public mini-website — banner, about, featured packages, departures and contact.">
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
          <Globe2 className="size-3.5" /> Featured packages & upcoming departures fill in automatically from what you publish. Branding, logo and links live under Organization settings.
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
    </div>
  );
}
