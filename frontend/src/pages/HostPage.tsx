import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, FileText, Globe, Instagram, MapPin, Phone, Plane, Search, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { HostPagePayload, LinktreePackage } from '@/types';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatTravelDate, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * PUBLIC LinkTree — the agency's travel package hub (/:slug, /link/:slug, /a/:slug).
 * Not a website: profile header, search, category chips and package cards
 * (image · name · departures · price · PDF · Book Now). Everything renders
 * live from the CRM — packages with "Show on LinkTree" ON appear automatically.
 */
export function HostPage() {
  const { slug } = useParams<{ slug: string }>();
  const reduce = useReducedMotion();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const hostQuery = useQuery({
    queryKey: ['host', slug],
    queryFn: () => api.get<HostPagePayload>(`/public/host/${slug}`),
    enabled: !!slug,
    retry: 1,
  });

  const host = hostQuery.data;

  const categories = useMemo(
    () => [...new Set((host?.packages ?? []).flatMap((p) => p.categories ?? []))].sort(),
    [host?.packages],
  );
  const packages = useMemo(() => {
    const all = host?.packages ?? [];
    const q = search.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!activeCategory || (p.categories ?? []).includes(activeCategory)) &&
        (!q || p.name.toLowerCase().includes(q) || p.destination.toLowerCase().includes(q)),
    );
  }, [host?.packages, search, activeCategory]);

  if (hostQuery.isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 pt-16">
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="mx-auto h-6 w-48" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
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
  const phone = host.contactNumber;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: EASE } };

  const bookHref = (p: LinktreePackage) =>
    phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(
          `Hi ${host.name}, I want to book *${p.name}* (${p.destination}, ${p.days}D/${p.nights}N). Please share details.`,
        )}`
      : `/p/${p.id}#enquire`;

  return (
    <div className="relative min-h-dvh bg-neutral-900">
      {/* Full-page cover background */}
      <div className="fixed inset-0">
        {host.linktreeCoverUrl ? (
          <img src={host.linktreeCoverUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(160deg, ${brand}, ${brand2})` }} />
        )}
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="relative mx-auto max-w-lg px-4 pb-16 pt-10">
        {/* Profile */}
        <motion.div {...rise(0)} className="flex flex-col items-center text-center">
          {host.logoUrl ? (
            <span className="flex size-24 items-center justify-center rounded-full bg-white p-1.5 shadow-pop">
              <img src={host.logoUrl} alt="" className="size-full rounded-full object-cover" />
            </span>
          ) : (
            <span
              className="flex size-24 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-pop"
              style={{ backgroundColor: brand }}
            >
              {initials(host.name)}
            </span>
          )}
          <h1 className="mt-4 font-display text-3xl font-extrabold uppercase tracking-wide text-white drop-shadow-lg">
            {host.name}
          </h1>
          {host.bio && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/85 drop-shadow">{host.bio}</p>}

          {/* Contact icons: Instagram · WhatsApp · Call · Website */}
          <div className="mt-4 flex items-center gap-3">
            {host.instagramUrl && (
              <a
                href={host.instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <Instagram className="size-5" />
              </a>
            )}
            {phone && (
              <a
                href={`https://wa.me/${phone}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <Send className="size-5" />
              </a>
            )}
            {phone && (
              <a
                href={`tel:+${phone}`}
                aria-label="Call"
                className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <Phone className="size-5" />
              </a>
            )}
            {host.websiteUrl && (
              <a
                href={host.websiteUrl}
                aria-label="Website"
                className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <Globe className="size-5" />
              </a>
            )}
          </div>
        </motion.div>

        {/* Search */}
        <motion.div {...rise(0.08)} className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packages…"
              aria-label="Search packages"
              className="h-12 rounded-full border-0 bg-white pl-11 text-[15px] shadow-pop"
            />
          </div>
        </motion.div>

        {/* Category chips (auto-synced from package categories) */}
        {categories.length > 0 && (
          <motion.div {...rise(0.12)} className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn(
                'shrink-0 rounded-xl px-4 py-2 text-sm font-bold shadow-card transition-colors',
                !activeCategory ? 'text-neutral-900' : 'bg-white text-neutral-700',
              )}
              style={!activeCategory ? { backgroundColor: brand2 } : undefined}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(activeCategory === c ? null : c)}
                className={cn(
                  'shrink-0 rounded-xl px-4 py-2 text-sm font-bold shadow-card transition-colors',
                  activeCategory === c ? 'text-neutral-900' : 'bg-white text-neutral-700',
                )}
                style={activeCategory === c ? { backgroundColor: brand2 } : undefined}
              >
                {c}
              </button>
            ))}
          </motion.div>
        )}

        {/* Package cards */}
        <div className="mt-4 space-y-3">
          {packages.length === 0 && (
            <div className="rounded-2xl bg-white/90 p-8 text-center text-sm text-neutral-600 backdrop-blur">
              {search || activeCategory ? 'No packages match — try another search or category.' : 'No packages published yet.'}
            </div>
          )}
          {packages.map((p, i) => (
            <motion.div
              key={p.id}
              {...rise(0.16 + Math.min(i, 8) * 0.05)}
              className="overflow-hidden rounded-2xl shadow-pop"
              style={{ backgroundColor: brand }}
            >
              <a href={`/p/${p.id}`} className="flex items-center gap-3 p-3">
                {/* Image */}
                <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-white/20 sm:size-[4.5rem]">
                  {p.bannerImageUrl ? (
                    <img src={p.bannerImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-white/70">
                      <MapPin className="size-5" />
                    </span>
                  )}
                </span>

                {/* Name · price · departures */}
                <span className="min-w-0 flex-1 text-white">
                  <span className="block truncate font-display text-[15px] font-bold uppercase leading-snug">
                    {p.name}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-white/90">
                    from {formatCurrency(p.priceAmount, p.priceCurrency)}
                  </span>
                  {p.departures.length > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-white/80">
                      <CalendarDays className="size-3 shrink-0" />
                      <span className="truncate">
                        {p.departures.map((d) => formatTravelDate(d)).join(' · ')}
                      </span>
                    </span>
                  )}
                </span>

                {/* PDF + Book */}
                <span className="flex shrink-0 flex-col gap-1.5 sm:flex-row" onClick={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/p/${p.id}/pdf`, '_blank');
                    }}
                    className="flex items-center justify-center gap-1 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: brand2 }}
                  >
                    <FileText className="size-3.5" /> PDF
                  </button>
                  <a
                    href={bookHref(p)}
                    target={phone ? '_blank' : undefined}
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: brand2 }}
                  >
                    Book
                  </a>
                </span>
              </a>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-white/70">
          Powered by <span className="font-semibold text-white">{host.name}</span> ✈
        </p>
      </div>
    </div>
  );
}
