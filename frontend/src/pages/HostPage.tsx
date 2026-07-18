import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { ArrowUpRight, Check, MapPin, Moon, Plane, Send, Sun } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { HostPagePayload } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

interface EnquiryValues {
  name: string;
  phone: string;
  email: string;
  destination: string;
  message: string;
}

/**
 * PUBLIC Linktree-style host page for an agency: /a/:slug
 * Branding comes from the organization; the enquiry form files a WEBSITE lead
 * straight into that agency's pipeline.
 */
export function HostPage() {
  const { slug } = useParams<{ slug: string }>();
  const reduce = useReducedMotion();
  const [sent, setSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const hostQuery = useQuery({
    queryKey: ['host', slug],
    queryFn: () => api.get<HostPagePayload>(`/public/host/${slug}`),
    enabled: !!slug,
    retry: 1,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EnquiryValues>({
    defaultValues: { name: '', phone: '', email: '', destination: '', message: '' },
  });

  const enquiryMutation = useMutation({
    mutationFn: (v: EnquiryValues) =>
      api.post(`/public/host/${slug}/enquiry`, {
        name: v.name.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        destination: v.destination.trim(),
        message: v.message.trim(),
      }),
    onSuccess: () => {
      setSent(true);
      reset();
    },
  });

  const host = hostQuery.data;

  if (hostQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 pt-16">
        <Skeleton className="mx-auto size-20 rounded-2xl" />
        <Skeleton className="mx-auto h-6 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  if (!host) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
          <Plane className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This agency page doesn't exist or was removed.</p>
      </div>
    );
  }

  const brand = host.brandPrimaryColor;
  const brand2 = host.brandSecondaryColor;

  const enquiryPhone = host.contactNumber;
  // Category filter chips (myair.link style), built from the packages' own categories.
  const categories = [...new Set(host.packages.flatMap((p) => p.categories ?? []))].sort();
  const shownPackages = activeCategory
    ? host.packages.filter((p) => (p.categories ?? []).includes(activeCategory))
    : host.packages;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, delay, ease: EASE } };

  return (
    <div className="min-h-dvh bg-surface pb-16">
      {/* Brand banner */}
      <div className="h-40 w-full sm:h-48" style={{ background: `linear-gradient(120deg, ${brand}, ${brand2})` }} />

      <div className="mx-auto -mt-16 max-w-lg px-4">
        {/* Identity */}
        <motion.div {...rise(0)} className="flex flex-col items-center text-center">
          {host.logoUrl ? (
            <img src={host.logoUrl} alt="" className="size-24 rounded-3xl border-4 border-white object-cover shadow-pop" />
          ) : (
            <span
              className="flex size-24 items-center justify-center rounded-3xl border-4 border-white font-display text-2xl font-bold text-white shadow-pop"
              style={{ backgroundColor: brand }}
            >
              {initials(host.name)}
            </span>
          )}
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground sm:text-3xl">{host.name}</h1>
          {host.bio && <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{host.bio}</p>}
        </motion.div>

        {/* Links (Linktree style) */}
        {host.hostLinks.length > 0 && (
          <div className="mt-7 space-y-3">
            {host.hostLinks.map((link, i) => (
              <motion.a
                key={`${link.url}-${i}`}
                {...rise(0.1 + i * 0.07)}
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 font-semibold text-foreground shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
              >
                {link.label}
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </motion.a>
            ))}
          </div>
        )}

        {/* Packages showcase (myair.link style: category chips + rich cards) */}
        {host.packages.length > 0 && (
          <div className="mt-10">
            <motion.h2 {...rise(0.2)} className="mb-3 text-center font-display text-lg font-bold text-foreground">
              Book &amp; explore
            </motion.h2>

            {categories.length > 0 && (
              <motion.div {...rise(0.24)} className="mb-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                    !activeCategory ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                  style={!activeCategory ? { backgroundColor: brand } : undefined}
                >
                  All
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setActiveCategory(c)}
                    className={cn(
                      'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors',
                      activeCategory === c ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                    style={activeCategory === c ? { backgroundColor: brand } : undefined}
                  >
                    {c}
                  </button>
                ))}
              </motion.div>
            )}

            <div className="grid gap-4">
              {shownPackages.map((pkg, i) => {
                const discounted = pkg.originalPrice != null && pkg.originalPrice > pkg.priceAmount;
                const waText = encodeURIComponent(
                  `Hi ${host.name}, I'm interested in *${pkg.name}* (${pkg.destination}, ${pkg.days}D/${pkg.nights}N). Please share details.`,
                );
                const waHref = enquiryPhone ? `https://wa.me/${enquiryPhone}?text=${waText}` : undefined;
                return (
                  <motion.a
                    key={pkg.id}
                    href={`/p/${pkg.id}`}
                    {...rise(0.28 + i * 0.05)}
                    className="block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
                  >
                    <div className="relative h-36 w-full bg-gradient-to-br from-muted to-surface">
                      {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {pkg.days}D / {pkg.nights}N
                      </span>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                        <p className="font-display text-base font-bold text-white drop-shadow">{pkg.name}</p>
                        <p className="flex items-center gap-1 text-xs text-white/85">
                          <MapPin className="size-3" /> {pkg.destination}
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="font-display text-lg font-bold" style={{ color: brand }}>
                        {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
                        {discounted && (
                          <span className="ml-2 text-xs font-medium text-muted-foreground line-through">
                            {formatCurrency(pkg.originalPrice!, pkg.priceCurrency)}
                          </span>
                        )}
                      </p>
                      {pkg.description && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{pkg.description}</p>}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex gap-1.5 text-[11px] font-semibold text-muted-foreground">
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                            <Moon className="size-3" /> {pkg.nights}
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                            <Sun className="size-3" /> {pkg.days}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground">View</span>
                          {waHref && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(waHref, '_blank');
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600"
                            >
                              <Send className="size-3.5" /> Enquire
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        )}

        {/* Enquiry form */}
        <motion.div {...rise(0.35)} className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="text-center font-display text-lg font-bold text-foreground">Plan your trip with us</h2>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            Tell us where you want to go — we'll get back to you fast.
          </p>

          {sent ? (
            <div className="mt-6 flex flex-col items-center py-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <p className="mt-3 font-semibold text-foreground">Enquiry sent!</p>
              <p className="mt-1 text-sm text-muted-foreground">The team will reach out to you shortly.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setSent(false)}>
                Send another
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit((v) => enquiryMutation.mutate(v))} className="mt-5 space-y-4" noValidate>
              <Field label="Your name" htmlFor="enqName" error={errors.name?.message} required>
                <Input id="enqName" {...register('name', { required: 'Your name is required' })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone" htmlFor="enqPhone" error={errors.phone?.message}>
                  <Input id="enqPhone" placeholder="+91 …" {...register('phone')} />
                </Field>
                <Field label="Email" htmlFor="enqEmail">
                  <Input id="enqEmail" type="email" {...register('email')} />
                </Field>
              </div>
              <Field label="Dream destination" htmlFor="enqDest">
                <Input id="enqDest" placeholder="Bali, Maldives, Europe…" {...register('destination')} />
              </Field>
              <Field label="Message" htmlFor="enqMsg">
                <Textarea id="enqMsg" rows={3} placeholder="Dates, budget, number of travellers…" {...register('message')} />
              </Field>
              {enquiryMutation.isError && (
                <p className="text-xs font-medium text-destructive">
                  Please add a phone number or email so the agency can reach you.
                </p>
              )}
              <Button
                type="submit"
                className={cn('w-full text-white transition-transform hover:scale-[1.01]')}
                style={{ backgroundColor: brand }}
                disabled={enquiryMutation.isPending}
              >
                {enquiryMutation.isPending ? <Spinner /> : <Send />}
                Send enquiry
              </Button>
            </form>
          )}
        </motion.div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold text-foreground">Voyage CRM</span> ✈
        </p>
      </div>
    </div>
  );
}
