import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { ArrowUpRight, Check, Mail, MapPin, Moon, Phone, Plane, Send, Sun } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SitePayload } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatTravelDate, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * PUBLIC Host Page mini-website: /site/:slug
 * A company website — banner, about, featured packages, upcoming departures,
 * contact + inquiry form (files a lead). Distinct from the AirLink bio page.
 */
export function SitePage() {
  const { slug } = useParams<{ slug: string }>();
  const reduce = useReducedMotion();
  const [sent, setSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const siteQuery = useQuery({
    queryKey: ['site', slug],
    queryFn: () => api.get<SitePayload>(`/public/site/${slug}`),
    enabled: !!slug,
    retry: 1,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; phone: string; email: string; message: string }>({
    defaultValues: { name: '', phone: '', email: '', message: '' },
  });

  const enquiryMutation = useMutation({
    mutationFn: (v: { name: string; phone: string; email: string; message: string }) =>
      api.post(`/public/host/${slug}/enquiry`, {
        name: v.name.trim(),
        phone: v.phone.trim(),
        email: v.email.trim(),
        message: v.message.trim(),
      }),
    onSuccess: () => {
      setSent(true);
      reset();
    },
  });

  if (siteQuery.isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  const site = siteQuery.data;
  if (!site) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
          <Plane className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This website doesn't exist or was removed.</p>
      </div>
    );
  }

  const org = site.organization;
  const brand = org.brandPrimaryColor;
  const brand2 = org.brandSecondaryColor;
  const categories = [...new Set(site.packages.flatMap((p) => p.categories ?? []))].sort();
  const shownPackages = activeCategory
    ? site.packages.filter((p) => (p.categories ?? []).includes(activeCategory))
    : site.packages;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.3, delay } }
      : {
          initial: { opacity: 0, y: 24 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <div className="min-h-dvh bg-surface">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: brand }}>
                {initials(org.name)}
              </span>
            )}
            <span className="font-display text-base font-bold text-foreground">{org.name}</span>
          </div>
          <div className="hidden items-center gap-4 text-sm font-medium text-muted-foreground sm:flex">
            <a href="#packages" className="hover:text-foreground">Packages</a>
            <a href="#departures" className="hover:text-foreground">Departures</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </div>
          {org.contactPhone && (
            <a
              href={`tel:${org.contactPhone}`}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white"
              style={{ backgroundColor: brand }}
            >
              <Phone className="size-3.5" /> Call
            </a>
          )}
        </div>
      </header>

      {/* Hero / banner */}
      <div className="relative h-72 w-full overflow-hidden sm:h-96" style={{ background: `linear-gradient(120deg, ${brand}, ${brand2})` }}>
        {org.bannerImageUrl && <img src={org.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/25" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
          <motion.h1
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="font-display text-4xl font-extrabold drop-shadow-lg sm:text-6xl"
          >
            {org.name}
          </motion.h1>
          {org.bio && <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base">{org.bio}</p>}
          <div className="mt-6 flex gap-3">
            <a href="#packages" className="rounded-xl bg-white px-5 py-2.5 font-semibold text-neutral-900 shadow-pop transition-transform hover:scale-105">
              Explore trips
            </a>
            <a href="#contact" className="rounded-xl bg-white/15 px-5 py-2.5 font-semibold text-white backdrop-blur transition-colors hover:bg-white/25">
              Enquire
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12">
        {/* About */}
        {org.aboutText && (
          <motion.section {...rise(0)} className="mx-auto max-w-3xl text-center">
            <h2 className="font-display text-2xl font-bold text-foreground">About us</h2>
            <div className="mx-auto mt-2 h-1 w-16 rounded-full" style={{ backgroundColor: brand }} />
            <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{org.aboutText}</p>
          </motion.section>
        )}

        {/* Featured packages */}
        {site.packages.length > 0 && (
          <motion.section {...rise(0.05)} id="packages" className="mt-16 scroll-mt-20">
            <h2 className="text-center font-display text-2xl font-bold text-foreground">Featured packages</h2>
            <div className="mx-auto mt-2 h-1 w-16 rounded-full" style={{ backgroundColor: brand }} />

            {categories.length > 0 && (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
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
              </div>
            )}

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shownPackages.map((p) => {
                const discounted = p.originalPrice != null && p.originalPrice > p.priceAmount;
                return (
                  <a
                    key={p.id}
                    href={`/p/${p.id}`}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-1 hover:shadow-soft"
                  >
                    <div className="relative h-40 w-full bg-muted">
                      {p.bannerImageUrl && <img src={p.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
                      <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        {p.days}D / {p.nights}N
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="font-display text-base font-bold text-foreground">{p.name}</h3>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {p.destination}
                      </p>
                      <div className="mt-3 flex flex-1 items-end justify-between">
                        <p className="font-display text-lg font-bold" style={{ color: brand }}>
                          {formatCurrency(p.priceAmount, p.priceCurrency)}
                          {discounted && (
                            <span className="ml-1.5 text-xs font-medium text-muted-foreground line-through">
                              {formatCurrency(p.originalPrice!, p.priceCurrency)}
                            </span>
                          )}
                        </p>
                        <span className="flex items-center gap-1 text-sm font-semibold text-foreground group-hover:underline">
                          View <ArrowUpRight className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Upcoming departures */}
        {site.departures.length > 0 && (
          <motion.section {...rise(0.05)} id="departures" className="mt-16 scroll-mt-20">
            <h2 className="text-center font-display text-2xl font-bold text-foreground">Upcoming departures</h2>
            <div className="mx-auto mt-2 h-1 w-16 rounded-full" style={{ backgroundColor: brand }} />
            <div className="mt-8 space-y-3">
              {site.departures.map((d) => (
                <a
                  key={d.id}
                  href={`/p/${d.packageId}`}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-card transition-colors hover:bg-muted/40"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-20">
                    {d.coverImage ? (
                      <img src={d.coverImage} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <MapPin className="size-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-foreground">{d.name || d.packageName}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.destination} · {d.days}D/{d.nights}N{d.pickupCity ? ` · from ${d.pickupCity}` : ''}
                    </p>
                    <p className="mt-1 flex items-center gap-3 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center gap-1"><Sun className="size-3" /> {formatTravelDate(d.departureDate)}</span>
                      <span className="flex items-center gap-1"><Moon className="size-3" /> {d.nights}N</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-base font-bold" style={{ color: brand }}>
                      {formatCurrency(d.pricePerPerson, d.priceCurrency)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">per person</p>
                  </div>
                </a>
              ))}
            </div>
          </motion.section>
        )}

        {/* Links */}
        {org.hostLinks.length > 0 && (
          <motion.section {...rise(0.05)} className="mt-16">
            <div className="mx-auto flex max-w-lg flex-col gap-3">
              {org.hostLinks.map((link, i) => (
                <a
                  key={`${link.url}-${i}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 font-semibold text-foreground shadow-card transition-all hover:-translate-y-0.5 hover:shadow-soft"
                >
                  {link.label}
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </a>
              ))}
            </div>
          </motion.section>
        )}

        {/* Contact + inquiry */}
        <motion.section {...rise(0.05)} id="contact" className="mt-16 scroll-mt-20 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-bold text-foreground">Get in touch</h2>
            <div className="mt-4 space-y-3 text-sm">
              {org.contactPhone && (
                <a href={`tel:${org.contactPhone}`} className="flex items-center gap-2.5 text-foreground hover:text-primary">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Phone className="size-4" /></span>
                  {org.contactPhone}
                </a>
              )}
              {org.contactEmail && (
                <a href={`mailto:${org.contactEmail}`} className="flex items-center gap-2.5 text-foreground hover:text-primary">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Mail className="size-4" /></span>
                  {org.contactEmail}
                </a>
              )}
              {org.address && (
                <p className="flex items-start gap-2.5 text-muted-foreground">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><MapPin className="size-4" /></span>
                  {org.address}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-xl font-bold text-foreground">Send an enquiry</h2>
            {sent ? (
              <div className="mt-5 flex flex-col items-center py-6 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="size-6" strokeWidth={3} />
                </span>
                <p className="mt-3 font-semibold text-foreground">Enquiry sent!</p>
                <p className="mt-1 text-sm text-muted-foreground">We'll be in touch shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit((v) => enquiryMutation.mutate(v))} className="mt-4 space-y-3" noValidate>
                <Field label="Your name" htmlFor="sName" error={errors.name?.message} required>
                  <Input id="sName" {...register('name', { required: 'Your name is required' })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Phone" htmlFor="sPhone">
                    <Input id="sPhone" placeholder="+91 …" {...register('phone')} />
                  </Field>
                  <Field label="Email" htmlFor="sEmail">
                    <Input id="sEmail" type="email" {...register('email')} />
                  </Field>
                </div>
                <Field label="Message" htmlFor="sMsg">
                  <Textarea id="sMsg" rows={2} placeholder="Where do you want to go?" {...register('message')} />
                </Field>
                {enquiryMutation.isError && (
                  <p className="text-xs font-medium text-destructive">Add a phone or email so we can reach you.</p>
                )}
                <Button type="submit" className="w-full text-white" style={{ backgroundColor: brand }} disabled={enquiryMutation.isPending}>
                  {enquiryMutation.isPending ? <Spinner /> : <Send />} Send enquiry
                </Button>
              </form>
            )}
          </div>
        </motion.section>
      </div>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {org.name}
      </footer>
    </div>
  );
}
