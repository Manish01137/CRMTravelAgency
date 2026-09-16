import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  BedDouble,
  Check,
  Download,
  Instagram as InstagramIcon,
  Mail,
  MapPin,
  Moon,
  Phone,
  Plane,
  Send,
  Sparkles,
  Sun,
  UtensilsCrossed,
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
import { Banner, BulletList, BODY_FONT, DISPLAY_FONT, HAIRLINE, INK, MUTED, THEME_VARS } from '@/lib/signatureTheme';

const EASE = [0.22, 1, 0.36, 1] as const;

interface BrochureOrg {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  /** Derived server-side from the org's saved links — the same source LinkTree/Host Page use. */
  instagramUrl: string | null;
  /** Derived server-side: org contact phone, falling back to the package's own — digits only. */
  whatsappNumber: string | null;
}
interface PublicBrochure {
  package: TravelPackage;
  organization: BrochureOrg | null;
}

const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/**
 * PUBLIC customer-facing package page: /p/:id
 * Redesigned to match the "Signature" brochure template's visual language
 * (brand mark, Baloo 2 display type, blue/yellow banner headers, themed
 * accent colors) as one continuous responsive page — not the reference's
 * literal fixed-height print pages, which don't apply to a scrolling site.
 * Highlights/"why choose us" deliberately kept as this app's own existing
 * chip layout rather than the template's dedicated section; there is no
 * payment/bank/QR section — booking stays WhatsApp + the enquiry form below.
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

  const vars = THEME_VARS[pkg.signatureTheme] ?? THEME_VARS.SUNRISE;
  const orgName = org?.name ?? 'Travel Agency';
  const discounted = pkg.originalPrice != null && pkg.originalPrice > pkg.priceAmount;
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const thingsToCarry = lines(pkg.thingsToCarry);
  const terms = lines(pkg.termsConditions);

  const waDigits = org?.whatsappNumber ?? (pkg.contactNumber ?? '').replace(/\D/g, '');
  const waText = encodeURIComponent(
    `Hi ${orgName}, I'm interested in *${pkg.name}* (${pkg.destination}, ${pkg.days}D/${pkg.nights}N). Please share details.`,
  );
  const waHref = waDigits ? `https://wa.me/${waDigits}?text=${waText}` : undefined;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: EASE } };

  return (
    <div
      className="min-h-dvh pb-28 sm:pb-16"
      style={{ ...vars, backgroundColor: '#fff', color: INK, fontFamily: BODY_FONT } as React.CSSProperties}
    >
      <div className="mx-auto max-w-2xl px-4 pt-6">
        {/* Brand mark */}
        <motion.div {...rise(0)} className="flex flex-col items-center gap-2.5 text-center">
          <span
            className="flex size-16 items-center justify-center overflow-hidden rounded-full border-2"
            style={{ borderColor: 'var(--blue)', backgroundColor: 'var(--blue-pale)' }}
          >
            {org?.logoUrl ? (
              <img src={org.logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <span className="font-bold" style={{ color: 'var(--blue)', fontFamily: DISPLAY_FONT }}>
                {initials(orgName)}
              </span>
            )}
          </span>
          <p className="text-sm font-bold leading-tight" style={{ color: 'var(--blue-dark)', fontFamily: DISPLAY_FONT }}>
            {orgName}
          </p>
        </motion.div>

        {/* Cover */}
        <motion.div {...rise(0.05)} className="mt-4 text-center">
          <span className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: 'var(--blue-pale)', color: 'var(--blue-dark)' }}>
            <MapPin className="size-3.5" /> {pkg.destination}
          </span>
          <h1
            className="mt-2 text-4xl font-extrabold uppercase leading-[0.95] sm:text-5xl"
            style={{ fontFamily: DISPLAY_FONT, color: 'var(--blue-dark)' }}
          >
            {pkg.bookingTitle || pkg.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5 text-sm font-bold">
            <span className="flex items-center gap-1.5 rounded-full px-4 py-1.5" style={{ backgroundColor: 'var(--yellow)', color: INK }}>
              <Moon className="size-3.5" /> {pkg.nights} NIGHTS
            </span>
            <span className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-white" style={{ backgroundColor: 'var(--blue)' }}>
              <Sun className="size-3.5" /> {pkg.days} DAYS
            </span>
          </div>
        </motion.div>

        {pkg.bannerImageUrl && (
          <motion.img
            {...rise(0.1)}
            src={pkg.bannerImageUrl}
            alt=""
            className="mt-5 h-56 w-full rounded-2xl object-cover sm:h-72"
          />
        )}

        {/* Price + PDF */}
        <motion.div
          {...rise(0.12)}
          className="mt-5 flex items-center justify-between gap-3 rounded-2xl p-4"
          style={{ border: `1.5px solid ${HAIRLINE}` }}
        >
          <div>
            <p className="text-2xl font-bold" style={{ fontFamily: DISPLAY_FONT, color: 'var(--blue-dark)' }}>
              {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
              {discounted && (
                <span className="ml-2 text-sm font-medium line-through" style={{ color: MUTED }}>
                  {formatCurrency(pkg.originalPrice!, pkg.priceCurrency)}
                </span>
              )}
            </p>
            <p className="text-xs" style={{ color: MUTED }}>per person</p>
          </div>
          <Button variant="outline" onClick={() => window.open(`/p/${pkg.id}/pdf`, '_blank')}>
            <Download /> PDF
          </Button>
        </motion.div>

        {/* Highlights — "why choose us", kept as this app's own existing chip layout */}
        {pkg.highlights.length > 0 && (
          <motion.div {...rise(0.15)} className="mt-6 flex flex-wrap gap-2">
            {pkg.highlights.map((h, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium"
                style={{ backgroundColor: 'var(--blue-pale)', color: 'var(--blue-dark)' }}
              >
                <Sparkles className="size-3.5" style={{ color: 'var(--orange)' }} /> {h}
              </span>
            ))}
          </motion.div>
        )}

        {pkg.description && (
          <motion.p {...rise(0.18)} className="mt-6 whitespace-pre-line text-[15px] leading-relaxed">
            {pkg.description}
          </motion.p>
        )}

        {/* Brief itinerary */}
        {pkg.itinerary.length > 0 && (
          <motion.div {...rise(0.2)}>
            <Banner>BRIEF ITINERARY</Banner>
            <div className="space-y-1">
              {pkg.itinerary.map((d) => (
                <div key={d.day} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--blue-pale)' }}>
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: 'var(--blue)', fontFamily: DISPLAY_FONT }}
                  >
                    {d.day}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--blue-dark)' }}>{d.title}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Day-by-day detail */}
        {pkg.itinerary.length > 0 && (
          <motion.div {...rise(0.24)} className="mt-8 space-y-4">
            {pkg.itinerary.map((d) => (
              <div key={d.day} className="overflow-hidden rounded-2xl" style={{ border: `1.5px solid ${HAIRLINE}` }}>
                <div className="px-5 pt-5 text-center">
                  <span
                    className="inline-block rounded-xl px-5 py-1.5 text-sm font-bold text-white"
                    style={{ backgroundColor: 'var(--blue)', fontFamily: DISPLAY_FONT }}
                  >
                    DAY {d.day}
                  </span>
                  <h3 className="mt-2 text-lg font-extrabold uppercase" style={{ fontFamily: DISPLAY_FONT, color: INK }}>
                    {d.title}
                  </h3>
                </div>
                <div className="px-5 pb-5">
                  {d.description && (
                    <ul className="mt-3">
                      <BulletList items={lines(d.description)} />
                    </ul>
                  )}
                  {(d.images?.length ?? 0) > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {d.images!.map((src, k) => (
                        <img key={k} src={src} alt="" className="h-24 w-32 shrink-0 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                  {(d.activityBlocks?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-2.5">
                      {d.activityBlocks!.map((b, k) => (
                        <div key={k} className="flex gap-3">
                          {b.imageUrl && <img src={b.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{b.name}</p>
                            {b.description && <p className="mt-0.5 text-xs" style={{ color: MUTED }}>{b.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium" style={{ color: MUTED }}>
                    {d.stay && (
                      <span className="flex items-center gap-1.5">
                        <BedDouble className="size-3.5" style={{ color: 'var(--blue)' }} /> {d.stay}
                      </span>
                    )}
                    {(d.activities?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="size-3.5" style={{ color: 'var(--blue)' }} /> {d.activities!.join(' · ')}
                      </span>
                    )}
                    {d.meals && (
                      <span className="flex items-center gap-1.5">
                        <UtensilsCrossed className="size-3.5" style={{ color: 'var(--blue)' }} /> {d.meals}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {/* Inclusions / Exclusions */}
        {inclusions.length > 0 && (
          <motion.div {...rise(0.28)} className="mt-8">
            <Banner>INCLUSIONS</Banner>
            <BulletList items={inclusions} />
          </motion.div>
        )}
        {exclusions.length > 0 && (
          <motion.div {...rise(0.3)} className="mt-6">
            <Banner yellow>EXCLUSIONS</Banner>
            <BulletList items={exclusions} dotColor="var(--orange)" />
          </motion.div>
        )}

        {/* Pricing — tiers only; no payment/bank/QR section */}
        {pkg.pricingOptions.length > 0 && (
          <motion.div {...rise(0.32)} className="mt-8">
            <Banner>PRICING</Banner>
            <div className="overflow-hidden rounded-xl" style={{ border: `1.5px solid ${HAIRLINE}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--blue-pale)' }}>
                    <th className="px-4 py-2.5 text-left font-bold" style={{ color: 'var(--blue-dark)', fontFamily: DISPLAY_FONT }}>Option</th>
                    <th className="px-4 py-2.5 text-left font-bold" style={{ color: 'var(--blue-dark)', fontFamily: DISPLAY_FONT }}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.pricingOptions.map((p, i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                      <td className="px-4 py-2.5 font-medium">
                        {p.label} {p.season === 'PEAK' && <span className="text-xs" style={{ color: 'var(--orange)' }}>(Peak season)</span>}
                      </td>
                      <td className="px-4 py-2.5 font-semibold">{formatCurrency(p.price, pkg.priceCurrency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Gallery */}
        {pkg.galleryImages.length > 0 && (
          <motion.div {...rise(0.34)} className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {pkg.galleryImages.slice(0, 6).map((src, i) => (
              <img key={i} src={src} alt="" className="aspect-square w-full rounded-xl object-cover" />
            ))}
          </motion.div>
        )}

        {/* Things to carry */}
        {thingsToCarry.length > 0 && (
          <motion.div {...rise(0.36)} className="mt-8">
            <Banner>THINGS TO CARRY</Banner>
            <BulletList items={thingsToCarry} />
          </motion.div>
        )}

        {/* Terms & conditions */}
        {terms.length > 0 && (
          <motion.div {...rise(0.38)} className="mt-8">
            <Banner yellow>TERMS &amp; CONDITIONS</Banner>
            <BulletList items={terms} dotColor="var(--orange)" />
          </motion.div>
        )}

        {/* Enquiry */}
        <motion.div {...rise(0.4)} id="enquire" className="mt-10 rounded-2xl border border-border bg-card p-6 text-foreground shadow-soft">
          <h2 className="text-lg font-bold" style={{ fontFamily: DISPLAY_FONT }}>Interested? Get a callback</h2>
          <p className="mt-1 text-sm text-muted-foreground">Leave your number and {orgName} will reach out with dates &amp; offers.</p>
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
              <Button type="submit" className="w-full text-white" style={{ backgroundColor: 'var(--blue)' }} disabled={enquiryMutation.isPending}>
                {enquiryMutation.isPending ? <Spinner /> : <Send />} Request a callback
              </Button>
            </form>
          )}
        </motion.div>

        {/* Contact */}
        {(pkg.contactNumber || pkg.contactEmail || org?.instagramUrl) && (
          <motion.div {...rise(0.44)} className="mt-10">
            <Banner>CONTACT US!</Banner>
            <div className="space-y-2.5">
              {pkg.contactNumber && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold" style={{ border: `1.5px solid var(--yellow)` }}>
                  <Phone className="size-4" style={{ color: 'var(--blue)' }} /> {pkg.contactNumber}
                </div>
              )}
              {pkg.contactEmail && (
                <div className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold" style={{ border: `1.5px solid var(--yellow)` }}>
                  <Mail className="size-4" style={{ color: 'var(--blue)' }} /> {pkg.contactEmail}
                </div>
              )}
              {org?.instagramUrl && (
                <a
                  href={org.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold"
                  style={{ border: `1.5px solid var(--yellow)`, color: INK }}
                >
                  <InstagramIcon className="size-4" style={{ color: 'var(--blue)' }} /> Follow us on Instagram
                </a>
              )}
            </div>
          </motion.div>
        )}

        <p className="mt-8 text-center text-xs" style={{ color: MUTED }}>
          Powered by <span className="font-semibold" style={{ color: INK }}>{orgName}</span> ✈
        </p>
      </div>

      {/* Sticky book bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold" style={{ fontFamily: DISPLAY_FONT, color: 'var(--blue-dark)' }}>
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
              style={{ backgroundColor: 'var(--blue)' }}
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
