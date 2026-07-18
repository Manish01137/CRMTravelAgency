import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  BedDouble,
  Check,
  Download,
  MapPin,
  Moon,
  Plane,
  Send,
  Sparkles,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

interface BrochureOrg {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
}
interface PublicBrochure {
  package: TravelPackage;
  organization: BrochureOrg | null;
}

const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * PUBLIC customer-facing package page: /p/:id
 * A shareable, mobile-first web page showing the day-by-day plan, with a
 * Book-on-WhatsApp CTA, an enquiry form (files a lead), and a PDF download.
 */
export function PublicPackagePage() {
  const { id } = useParams<{ id: string }>();
  const reduce = useReducedMotion();
  const [sent, setSent] = useState(false);

  const query = useQuery({
    queryKey: ['public-package', id],
    queryFn: () => api.get<PublicBrochure>(`/public/package/${id}`),
    enabled: !!id,
    retry: 1,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; phone: string; message: string }>({
    defaultValues: { name: '', phone: '', message: '' },
  });

  const org = query.data?.organization;
  const pkg = query.data?.package;

  const enquiryMutation = useMutation({
    mutationFn: (v: { name: string; phone: string; message: string }) =>
      api.post(`/public/host/${org!.slug}/enquiry`, {
        name: v.name.trim(),
        phone: v.phone.trim(),
        destination: pkg?.destination,
        message: `[${pkg?.name}] ${v.message.trim()}`.trim(),
      }),
    onSuccess: () => {
      setSent(true);
      reset();
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
          <Plane className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Package not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This link doesn't exist or was removed.</p>
      </div>
    );
  }

  const brand = org?.brandPrimaryColor ?? '#4F46E5';
  const brand2 = org?.brandSecondaryColor ?? '#0D9488';
  const orgName = org?.name ?? 'Travel Agency';
  const discounted = pkg.originalPrice != null && pkg.originalPrice > pkg.priceAmount;
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);

  const waDigits = (pkg.contactNumber ?? '').replace(/\D/g, '');
  const waText = encodeURIComponent(
    `Hi ${orgName}, I'm interested in *${pkg.name}* (${pkg.destination}, ${pkg.days}D/${pkg.nights}N). Please share details.`,
  );
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${waText}` : undefined;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: EASE } };

  return (
    <div className="min-h-dvh bg-surface pb-28 sm:pb-16">
      {/* Hero */}
      <div className="relative h-64 w-full overflow-hidden sm:h-80" style={{ background: `linear-gradient(120deg, ${brand}, ${brand2})` }}>
        {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/25" />
        <div className="absolute left-0 right-0 top-0 flex items-center gap-2.5 p-4 text-white">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">
              {initials(orgName)}
            </span>
          )}
          <span className="font-display text-sm font-bold">{orgName}</span>
        </div>
        <motion.div {...rise(0.05)} className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-7">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-2.5 py-1 text-xs font-semibold backdrop-blur">
            <MapPin className="size-3.5" /> {pkg.destination}
          </span>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight drop-shadow sm:text-4xl">
            {pkg.bookingTitle || pkg.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
              <Moon className="size-3.5" /> {pkg.nights}N
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1">
              <Sun className="size-3.5" /> {pkg.days}D
            </span>
          </div>
        </motion.div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* Price + PDF */}
        <motion.div {...rise(0.1)} className="-mt-6 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-pop">
          <div>
            <p className="font-display text-2xl font-bold" style={{ color: brand }}>
              {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
              {discounted && (
                <span className="ml-2 text-sm font-medium text-muted-foreground line-through">
                  {formatCurrency(pkg.originalPrice!, pkg.priceCurrency)}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">per person</p>
          </div>
          <Button variant="outline" onClick={() => window.open(`/p/${pkg.id}/pdf`, '_blank')}>
            <Download /> PDF
          </Button>
        </motion.div>

        {/* Highlights */}
        {pkg.highlights.length > 0 && (
          <motion.div {...rise(0.15)} className="mt-6">
            <div className="flex flex-wrap gap-2">
              {pkg.highlights.map((h, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-card">
                  <Sparkles className="size-3.5" style={{ color: brand }} /> {h}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {pkg.description && (
          <motion.p {...rise(0.18)} className="mt-6 whitespace-pre-line text-[15px] leading-relaxed text-foreground">
            {pkg.description}
          </motion.p>
        )}

        {/* Day-wise itinerary */}
        {pkg.itinerary.length > 0 && (
          <motion.div {...rise(0.22)} className="mt-8">
            <h2 className="font-display text-xl font-bold text-foreground">Day-by-day plan</h2>
            <div className="relative mt-4 space-y-4 before:absolute before:left-[15px] before:top-2 before:h-full before:w-0.5 before:bg-border">
              {pkg.itinerary.map((d) => (
                <div key={d.day} className="relative pl-11">
                  <span
                    className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full font-display text-xs font-bold text-white shadow"
                    style={{ backgroundColor: brand }}
                  >
                    {d.day}
                  </span>
                  <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
                    <h3 className="font-display text-base font-bold text-foreground">{d.title}</h3>
                    {d.description && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{d.description}</p>}
                    {(d.images?.length ?? 0) > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {d.images!.map((src, k) => (
                          <img key={k} src={src} alt="" className="h-24 w-32 shrink-0 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-muted-foreground">
                      {d.stay && (
                        <span className="flex items-center gap-1.5">
                          <BedDouble className="size-3.5" style={{ color: brand }} /> {d.stay}
                        </span>
                      )}
                      {(d.activities?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="size-3.5" style={{ color: brand }} /> {d.activities!.join(' · ')}
                        </span>
                      )}
                      {d.meals && (
                        <span className="flex items-center gap-1.5">
                          <UtensilsCrossed className="size-3.5" style={{ color: brand }} /> {d.meals}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Inclusions / Exclusions */}
        {(inclusions.length > 0 || exclusions.length > 0) && (
          <motion.div {...rise(0.26)} className="mt-8 grid gap-4 sm:grid-cols-2">
            {inclusions.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-bold text-emerald-700">What's included</h3>
                <ul className="mt-3 space-y-2">
                  {inclusions.map((l, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exclusions.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-bold text-destructive">Not included</h3>
                <ul className="mt-3 space-y-2">
                  {exclusions.map((l, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" /> {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}

        {/* Gallery */}
        {pkg.galleryImages.length > 0 && (
          <motion.div {...rise(0.3)} className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pkg.galleryImages.slice(0, 6).map((src, i) => (
              <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </motion.div>
        )}

        {/* Enquiry */}
        <motion.div {...rise(0.34)} id="enquire" className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-bold text-foreground">Interested? Get a callback</h2>
          <p className="mt-1 text-sm text-muted-foreground">Leave your number and {orgName} will reach out with dates & offers.</p>
          {sent ? (
            <div className="mt-5 flex flex-col items-center py-4 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <p className="mt-3 font-semibold text-foreground">Request sent!</p>
              <p className="mt-1 text-sm text-muted-foreground">We'll be in touch shortly.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit((v) => enquiryMutation.mutate(v))} className="mt-4 space-y-3" noValidate>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Your name" htmlFor="pkgName" error={errors.name?.message} required>
                  <Input id="pkgName" {...register('name', { required: 'Your name is required' })} />
                </Field>
                <Field label="Phone" htmlFor="pkgPhone" error={errors.phone?.message} required>
                  <Input id="pkgPhone" placeholder="+91 …" {...register('phone', { required: 'Phone is required' })} />
                </Field>
              </div>
              <Field label="Message" htmlFor="pkgMsg">
                <Textarea id="pkgMsg" rows={2} placeholder="Dates, number of travellers…" {...register('message')} />
              </Field>
              {enquiryMutation.isError && (
                <p className="text-xs font-medium text-destructive">Something went wrong — please try WhatsApp instead.</p>
              )}
              <Button type="submit" className="w-full text-white" style={{ backgroundColor: brand }} disabled={enquiryMutation.isPending}>
                {enquiryMutation.isPending ? <Spinner /> : <Send />} Request a callback
              </Button>
            </form>
          )}
        </motion.div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">{orgName}</span> ✈
        </p>
      </div>

      {/* Sticky book bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold" style={{ color: brand }}>
              {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
            </p>
            <p className="-mt-0.5 text-[11px] text-muted-foreground">per person</p>
          </div>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white"
            >
              <Send className="size-4" /> Book on WhatsApp
            </a>
          ) : (
            <a
              href="#enquire"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white"
              style={{ backgroundColor: brand }}
            >
              <Send className="size-4" /> Enquire
            </a>
          )}
        </div>
      </div>

      {/* Desktop floating WhatsApp */}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-6 right-6 z-20 hidden items-center gap-2 rounded-full bg-emerald-500 px-5 py-3.5 font-semibold text-white shadow-pop transition-transform hover:scale-105 sm:flex"
        >
          <Send className="size-4" /> Book on WhatsApp
        </a>
      )}
    </div>
  );
}
