import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  ArrowRight,
  Check,
  FileText,
  Instagram,
  Mail,
  MapPin,
  Menu,
  Moon,
  Phone,
  Plane,
  Send,
  Star,
  Sun,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SitePackage, SitePayload } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;
const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'packages', label: 'Packages' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'contact', label: 'Contact' },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * PUBLIC Host Page — a premium single-page marketing site for one agency.
 * URL: /{slug} (and /site/:slug). No session; the org is resolved from the slug
 * and the payload is already tenant-scoped server-side (RLS). Independent of
 * LinkTree. Sections: Navbar → Hero → Packages (ALL) → Reviews → Footer/contact.
 */
export function SitePage() {
  const { slug } = useParams<{ slug: string }>();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const query = useQuery({
    queryKey: ['site', slug],
    queryFn: () => api.get<SitePayload>(`/public/site/${slug}`),
    enabled: !!slug,
    retry: 1,
  });

  // Navbar turns solid once the hero is scrolled past.
  useEffect(() => {
    const onScroll = () => {
      const h = heroRef.current?.offsetHeight ?? 400;
      setScrolled(window.scrollY > h - 80);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [query.data]);

  if (query.isLoading) {
    return (
      <div className="min-h-dvh bg-surface">
        <Skeleton className="h-[70vh] w-full" />
        <div className="mx-auto max-w-6xl space-y-4 p-6">
          <Skeleton className="mx-auto h-8 w-48" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const site = query.data;
  if (!site) {
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

  const org = site.organization;
  const brand = org.brandPrimaryColor;
  const brand2 = org.brandSecondaryColor;
  const bioText = org.bio || org.aboutText;
  const wa = org.whatsappNumber;
  const waPackage = (p: SitePackage) =>
    wa
      ? `https://wa.me/${wa}?text=${encodeURIComponent(
          `Hi ${org.name}, I'm interested in *${p.name}* (${p.destination}, ${p.days}D/${p.nights}N). Please share details.`,
        )}`
      : `#contact`;

  const heroAnim = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } }
      : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE } };
  const inView = (delay = 0) =>
    reduce
      ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, viewport: { once: true }, transition: { duration: 0.3, delay } }
      : {
          initial: { opacity: 0, y: 28 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: '-60px' },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <div className="min-h-dvh bg-surface" style={{ ['--brand' as string]: brand }}>
      {/* NAVBAR */}
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
          scrolled ? 'border-b border-border bg-white/95 shadow-sm backdrop-blur' : 'bg-transparent',
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button onClick={() => scrollToId('home')} className="flex items-center gap-2.5">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
            ) : (
              <span className="flex size-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: brand }}>
                {initials(org.name)}
              </span>
            )}
            <span className={cn('font-display text-base font-bold transition-colors', scrolled ? 'text-foreground' : 'text-white drop-shadow')}>
              {org.name}
            </span>
          </button>

          <nav className="hidden items-center gap-6 sm:flex">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => scrollToId(n.id)}
                className={cn('text-sm font-semibold transition-colors', scrolled ? 'text-muted-foreground hover:text-foreground' : 'text-white/90 hover:text-white')}
              >
                {n.label}
              </button>
            ))}
          </nav>

          <button
            className={cn('sm:hidden', scrolled ? 'text-foreground' : 'text-white')}
            aria-label="Menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border bg-white sm:hidden">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setMenuOpen(false);
                  scrollToId(n.id);
                }}
                className="block w-full px-5 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted"
              >
                {n.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="home" ref={heroRef} className="relative flex min-h-[85vh] items-center justify-center overflow-hidden">
        {org.bannerImageUrl ? (
          <img src={org.bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${brand}, ${brand2})` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/60" />

        <div className="relative mx-auto max-w-3xl px-4 text-center text-white">
          <motion.h1 {...heroAnim(0.05)} className="font-display text-4xl font-extrabold leading-tight drop-shadow-lg sm:text-6xl">
            {org.name}
          </motion.h1>
          {bioText && (
            <motion.p {...heroAnim(0.18)} className="mx-auto mt-4 max-w-xl text-base text-white/90 drop-shadow sm:text-lg">
              {bioText}
            </motion.p>
          )}
          <motion.div {...heroAnim(0.3)} className="mt-8 flex flex-col items-center gap-4">
            <button
              onClick={() => scrollToId('packages')}
              className="flex items-center gap-2 rounded-full px-7 py-3.5 font-semibold text-white shadow-pop transition-transform hover:scale-105"
              style={{ backgroundColor: brand }}
            >
              View Packages <ArrowRight className="size-4" />
            </button>
            <div className="flex items-center gap-3">
              {wa && (
                <a
                  href={`https://wa.me/${wa}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
                >
                  <Send className="size-5" />
                </a>
              )}
              {org.instagramUrl && (
                <a
                  href={org.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
                >
                  <Instagram className="size-5" />
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* PACKAGES */}
      <section id="packages" className="scroll-mt-16 bg-surface py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div {...inView()} className="text-center">
            <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">Our Packages</h2>
            <div className="mx-auto mt-3 h-1 w-20 rounded-full" style={{ backgroundColor: brand }} />
          </motion.div>

          {site.packages.length === 0 ? (
            <p className="mt-10 text-center text-muted-foreground">Packages coming soon.</p>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {site.packages.map((p, i) => {
                const discounted = p.originalPrice != null && p.originalPrice > p.priceAmount;
                return (
                  <motion.div
                    {...inView(Math.min(i, 6) * 0.05)}
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-soft"
                  >
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                      {p.bannerImageUrl ? (
                        <img
                          src={p.bannerImageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <MapPin className="size-8" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                        {p.days}D / {p.nights}N
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="font-display text-lg font-bold text-foreground">{p.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3.5" /> {p.destination}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                          <Moon className="size-3" /> {p.nights}N
                        </span>
                        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                          <Sun className="size-3" /> {p.days}D
                        </span>
                      </div>
                      <p className="mt-4 font-display text-2xl font-bold" style={{ color: brand }}>
                        {formatCurrency(p.priceAmount, p.priceCurrency)}
                        {discounted && (
                          <span className="ml-2 align-middle text-sm font-medium text-muted-foreground line-through">
                            {formatCurrency(p.originalPrice!, p.priceCurrency)}
                          </span>
                        )}
                        <span className="text-xs font-medium text-muted-foreground"> / person</span>
                      </p>
                      <div className="mt-5 flex gap-2 border-t border-border pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => window.open(`/p/${p.id}/pdf`, '_blank')}
                        >
                          <FileText /> View PDF
                        </Button>
                        <a
                          href={waPackage(p)}
                          target={wa ? '_blank' : undefined}
                          rel="noreferrer"
                          onClick={(e) => {
                            if (!wa) {
                              e.preventDefault();
                              scrollToId('contact');
                            }
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
                        >
                          <Send className="size-3.5" /> Enquire Now
                        </a>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* REVIEWS — hidden entirely when there are none */}
      {site.reviews.length > 0 && (
        <section id="reviews" className="scroll-mt-16 bg-card py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4">
            <motion.div {...inView()} className="text-center">
              <h2 className="font-display text-3xl font-bold text-foreground sm:text-4xl">What travellers say</h2>
              <div className="mx-auto mt-3 h-1 w-20 rounded-full" style={{ backgroundColor: brand }} />
            </motion.div>
            <div className="mt-10 flex snap-x gap-5 overflow-x-auto pb-4 scrollbar-thin sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
              {site.reviews.map((r, i) => (
                <motion.div
                  {...inView(Math.min(i, 6) * 0.05)}
                  key={r.id}
                  className="min-w-[85%] snap-center rounded-2xl border border-border bg-surface p-6 shadow-card sm:min-w-0"
                >
                  {r.rating != null && (
                    <div className="mb-2 flex gap-0.5" aria-label={`${r.rating} out of 5`}>
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Star key={k} className={cn('size-4', k < r.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30')} />
                      ))}
                    </div>
                  )}
                  <p className="text-[15px] leading-relaxed text-foreground">“{r.quote}”</p>
                  <div className="mt-4 flex items-center gap-3">
                    {r.photoUrl ? (
                      <img src={r.photoUrl} alt="" loading="lazy" className="size-10 rounded-full object-cover" />
                    ) : (
                      <span className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                        {initials(r.reviewerName)}
                      </span>
                    )}
                    <p className="font-display text-sm font-bold text-foreground">{r.reviewerName}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FOOTER + CONTACT */}
      <SiteFooter site={site} brand={brand} />
    </div>
  );
}

/* --------------------------------- Footer --------------------------------- */
function SiteFooter({ site, brand }: { site: SitePayload; brand: string }) {
  const org = site.organization;
  const [sent, setSent] = useState(false);
  const { slug } = useParams<{ slug: string }>();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; contact: string; message: string }>({
    defaultValues: { name: '', contact: '', message: '' },
  });

  // The inline form files a real WEBSITE lead via the existing enquiry endpoint.
  const enquiry = useMutation({
    mutationFn: (v: { name: string; contact: string; message: string }) => {
      const contact = v.contact.trim();
      const isEmail = contact.includes('@');
      return api.post(`/public/host/${slug}/enquiry`, {
        name: v.name.trim(),
        email: isEmail ? contact : undefined,
        phone: isEmail ? undefined : contact,
        message: v.message.trim(),
      });
    },
    onSuccess: () => {
      setSent(true);
      reset();
    },
  });

  return (
    <footer id="contact" className="scroll-mt-16 text-white" style={{ backgroundColor: '#141922' }}>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-[1.1fr_1fr]">
        {/* Brand + links + contact details */}
        <div>
          <div className="flex items-center gap-2.5">
            {org.logoUrl ? (
              <img src={org.logoUrl} alt="" className="size-10 rounded-lg object-cover" />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: brand }}>
                {initials(org.name)}
              </span>
            )}
            <span className="font-display text-lg font-bold">{org.name}</span>
          </div>
          {(org.bio || org.aboutText) && <p className="mt-3 max-w-sm text-sm text-white/70">{org.bio || org.aboutText}</p>}

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => scrollToId(n.id)} className="text-sm font-medium text-white/70 hover:text-white">
                {n.label}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-2 text-sm text-white/80">
            {org.contactPhone && (
              <a href={`tel:${org.contactPhone}`} className="flex items-center gap-2 hover:text-white">
                <Phone className="size-4" /> {org.contactPhone}
              </a>
            )}
            {org.contactEmail && (
              <a href={`mailto:${org.contactEmail}`} className="flex items-center gap-2 hover:text-white">
                <Mail className="size-4" /> {org.contactEmail}
              </a>
            )}
            {org.address && (
              <p className="flex items-start gap-2">
                <MapPin className="size-4 shrink-0" /> {org.address}
              </p>
            )}
          </div>

          <div className="mt-5 flex items-center gap-3">
            {org.whatsappNumber && (
              <a href={`https://wa.me/${org.whatsappNumber}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <Send className="size-4" />
              </a>
            )}
            {org.instagramUrl && (
              <a href={org.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                <Instagram className="size-4" />
              </a>
            )}
          </div>
        </div>

        {/* Inline contact form → creates a Lead */}
        <div className="rounded-2xl bg-white/[0.06] p-6 backdrop-blur">
          <h3 className="font-display text-lg font-bold">Send an enquiry</h3>
          {sent ? (
            <div className="mt-5 flex flex-col items-center py-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="size-6" strokeWidth={3} />
              </span>
              <p className="mt-3 font-semibold">Thanks — we'll be in touch!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit((v) => enquiry.mutate(v))} className="mt-4 space-y-3" noValidate>
              <Field label="Name" htmlFor="fName" error={errors.name?.message} className="[&_label]:text-white/80">
                <Input id="fName" className="border-white/15 bg-white/10 text-white placeholder:text-white/40" {...register('name', { required: 'Your name is required' })} />
              </Field>
              <Field label="Phone or email" htmlFor="fContact" error={errors.contact?.message} className="[&_label]:text-white/80">
                <Input id="fContact" placeholder="+91 … or you@email.com" className="border-white/15 bg-white/10 text-white placeholder:text-white/40" {...register('contact', { required: 'Add a phone or email' })} />
              </Field>
              <Field label="Message" htmlFor="fMsg" className="[&_label]:text-white/80">
                <Textarea id="fMsg" rows={3} placeholder="Where would you like to go?" className="border-white/15 bg-white/10 text-white placeholder:text-white/40" {...register('message')} />
              </Field>
              {enquiry.isError && <p className="text-xs font-medium text-red-300">Something went wrong — please try WhatsApp.</p>}
              <Button type="submit" className="w-full text-white" style={{ backgroundColor: brand }} disabled={enquiry.isPending}>
                {enquiry.isPending ? <Spinner /> : <Send />} Send enquiry
              </Button>
            </form>
          )}
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} {org.name}. All rights reserved.
      </div>
    </footer>
  );
}
