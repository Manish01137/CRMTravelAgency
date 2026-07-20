import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Film, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { LinktreeBackgroundType, LinktreeFont, LinktreeTheme, Organization } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { ImageUpload } from '@/components/ui/image-upload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { copyToClipboard } from '@/lib/share';

const FONTS: { value: LinktreeFont; label: string }[] = [
  { value: 'figtree', label: 'Figtree — clean & modern' },
  { value: 'playfair', label: 'Playfair Display — elegant serif' },
  { value: 'grotesk', label: 'Space Grotesk — techy' },
  { value: 'lora', label: 'Lora — classic serif' },
  { value: 'bebas', label: 'Bebas Neue — bold condensed' },
];

interface FormValues {
  agencyName: string;
  shortBio: string;
  instagramUrl: string;
  whatsappNumber: string;
  websiteUrl: string;
  buttonColor: string;
  fontChoice: LinktreeFont;
  backgroundType: LinktreeBackgroundType;
  backgroundColor: string;
  allowVideoOnMobile: boolean;
}

/** LinkTree module settings — entirely separate from Host Page settings. */
export function LinktreeSettingsPage() {
  const { organization, refresh } = useAuth();
  const theme: LinktreeTheme = organization?.linktreeTheme ?? {};

  const [logoUrl, setLogoUrl] = useState<string | null>(theme.logoUrl ?? null);
  const [bgImageUrl, setBgImageUrl] = useState<string | null>(theme.backgroundImageUrl ?? null);
  const [bgVideoUrl, setBgVideoUrl] = useState<string | null>(theme.backgroundVideoUrl ?? null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, control, watch } = useForm<FormValues>({
    defaultValues: {
      agencyName: theme.agencyName ?? '',
      shortBio: theme.shortBio ?? '',
      instagramUrl: theme.instagramUrl ?? '',
      whatsappNumber: theme.whatsappNumber ?? '',
      websiteUrl: theme.websiteUrl ?? '',
      buttonColor: theme.buttonColor ?? '#F5B92E',
      fontChoice: theme.fontChoice ?? 'figtree',
      backgroundType: theme.backgroundType ?? 'color',
      backgroundColor: theme.backgroundColor ?? '#1D4ED8',
      allowVideoOnMobile: theme.allowVideoOnMobile ?? false,
    },
  });

  const backgroundType = watch('backgroundType');
  const publicUrl = organization ? `${window.location.origin}/linktree/${organization.slug}` : '';

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      api.patch<Organization>('/organization', {
        linktreeTheme: {
          logoUrl,
          agencyName: v.agencyName.trim() || null,
          shortBio: v.shortBio.trim() || null,
          instagramUrl: v.instagramUrl.trim() || null,
          whatsappNumber: v.whatsappNumber.trim() || null,
          websiteUrl: v.websiteUrl.trim() || null,
          buttonColor: v.buttonColor || null,
          fontChoice: v.fontChoice,
          backgroundType: v.backgroundType,
          backgroundColor: v.backgroundColor || null,
          backgroundImageUrl: bgImageUrl,
          backgroundVideoUrl: bgVideoUrl,
          allowVideoOnMobile: v.allowVideoOnMobile,
        },
      }),
    onSuccess: async () => {
      await refresh?.();
      toast.success('LinkTree updated');
    },
    onError: () => toast.error('Could not save — check the fields (URLs must be full links)'),
  });

  const onVideoPick = async (file: File | undefined) => {
    if (!file) return;
    setVideoUploading(true);
    try {
      const { url } = await api.upload('/uploads/video', file);
      setBgVideoUrl(url);
      toast.success('Video uploaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Video upload failed');
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const copy = async () => {
    if (await copyToClipboard(publicUrl)) {
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const submitError = () => toast.error('Please review the form');

  return (
    <div>
      <PageHeader
        title="LinkTree"
        description="Your public travel package showcase. Packages appear via their Show-on-LinkTree switch; tabs come from Manage Categories."
      >
        <Button asChild>
          <a href={publicUrl} target="_blank" rel="noreferrer">
            <ExternalLink /> Open page
          </a>
        </Button>
      </PageHeader>

      {/* Public link */}
      <Card className="mb-6 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your LinkTree URL</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={publicUrl} className="flex-1 font-medium" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" onClick={copy}>
            {copied ? <Check className="text-emerald-600" /> : <Copy />} {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </Card>

      <form onSubmit={handleSubmit((v) => mutation.mutate(v), submitError)} className="space-y-6">
        {/* Profile */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">Profile</h2>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Field label="Logo">
              <ImageUpload tile value={logoUrl} onChange={setLogoUrl} />
            </Field>
            <div className="space-y-4">
              <Field label="Agency name" htmlFor="ltName" hint="Shown big under the logo. Defaults to your organization name.">
                <Input id="ltName" placeholder={organization?.name} {...register('agencyName')} />
              </Field>
              <Field label="Short bio" htmlFor="ltBio">
                <Textarea id="ltBio" rows={2} maxLength={300} placeholder="Treks | Tours | Trusted travel partner ✈" {...register('shortBio')} />
              </Field>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label="Instagram URL" htmlFor="ltInsta">
              <Input id="ltInsta" placeholder="https://instagram.com/…" {...register('instagramUrl')} />
            </Field>
            <Field label="WhatsApp number" htmlFor="ltWa" hint="With country code, e.g. 918130117871">
              <Input id="ltWa" placeholder="91XXXXXXXXXX" {...register('whatsappNumber')} />
            </Field>
            <Field label="Website (optional)" htmlFor="ltWeb">
              <Input id="ltWeb" placeholder="https://…" {...register('websiteUrl')} />
            </Field>
          </div>
        </Card>

        {/* Background */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">Background</h2>
          <Field label="Background type" htmlFor="ltBgType">
            <Controller
              control={control}
              name="backgroundType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="ltBgType" className="sm:max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="color">Color</SelectItem>
                    <SelectItem value="image">Photo</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {backgroundType === 'color' && (
            <Field label="Background color" htmlFor="ltBgColor" className="mt-4">
              <div className="flex items-center gap-3">
                <input type="color" id="ltBgColor" {...register('backgroundColor')} className="size-10 cursor-pointer rounded border border-border" />
                <Input value={watch('backgroundColor')} readOnly className="w-32" />
              </div>
            </Field>
          )}

          {backgroundType === 'image' && (
            <Field label="Background photo" className="mt-4">
              <div className="max-w-md">
                <ImageUpload value={bgImageUrl} onChange={setBgImageUrl} />
              </div>
            </Field>
          )}

          {backgroundType === 'video' && (
            <div className="mt-4 space-y-4">
              <Field
                label="Background video (.mp4)"
                hint="Keep it under ~15–20 seconds and ~10–15 MB — it loops muted behind the page."
              >
                <div className="flex items-center gap-3">
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => onVideoPick(e.target.files?.[0])}
                  />
                  <Button type="button" variant="outline" disabled={videoUploading} onClick={() => videoInputRef.current?.click()}>
                    {videoUploading ? <Loader2 className="animate-spin" /> : <Film />}
                    {bgVideoUrl ? 'Replace video' : 'Upload video'}
                  </Button>
                  {bgVideoUrl && (
                    <>
                      <a href={bgVideoUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary hover:underline">
                        Preview
                      </a>
                      <button type="button" className="text-sm text-muted-foreground hover:text-destructive" onClick={() => setBgVideoUrl(null)}>
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </Field>
              <Field
                label="Poster image (required)"
                hint="Shown instantly while the video loads, on any failure, and on mobile unless the toggle below is on."
              >
                <div className="max-w-md">
                  <ImageUpload value={bgImageUrl} onChange={setBgImageUrl} />
                </div>
              </Field>
              <Controller
                control={control}
                name="allowVideoOnMobile"
                render={({ field }) => (
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-surface/60 p-4">
                    <span>
                      <span className="block font-semibold text-foreground">Also play video on mobile</span>
                      <span className="block text-sm text-muted-foreground">
                        OFF (recommended) shows the poster on phones to save data; ON plays the video everywhere.
                      </span>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', field.value ? 'bg-primary' : 'bg-muted')}
                    >
                      <span className={cn('absolute top-1 size-5 rounded-full bg-white shadow transition-all', field.value ? 'left-6' : 'left-1')} />
                    </button>
                  </label>
                )}
              />
            </div>
          )}
        </Card>

        {/* Buttons & font */}
        <Card className="p-5">
          <h2 className="mb-4 font-display text-base font-semibold text-foreground">Buttons &amp; font</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Button color" htmlFor="ltBtnColor" hint="Used for PDF / Book Now / category tabs.">
              <div className="flex items-center gap-3">
                <input type="color" id="ltBtnColor" {...register('buttonColor')} className="size-10 cursor-pointer rounded border border-border" />
                <Input value={watch('buttonColor')} readOnly className="w-32" />
              </div>
            </Field>
            <Field label="Font" htmlFor="ltFont">
              <Controller
                control={control}
                name="fontChoice"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ltFont">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONTS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner className="size-4" />} Save LinkTree
          </Button>
        </div>
      </form>

      {/* Live preview */}
      {organization && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-base font-semibold text-foreground">Live preview</h2>
          <Card className="overflow-hidden p-0">
            <iframe key={publicUrl} title="LinkTree preview" src={`/linktree/${organization.slug}`} className="h-[640px] w-full border-0" />
          </Card>
        </div>
      )}
    </div>
  );
}
