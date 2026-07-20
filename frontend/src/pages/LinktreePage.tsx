import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, FileText, Globe, Instagram, MapPin, Plane, Search, Send } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { LinktreeFont, LinktreeModulePackage, LinktreeModulePayload } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatTravelDate, initials } from '@/lib/format';

const EASE = [0.22, 1, 0.36, 1] as const;

const FONT_FAMILIES: Record<LinktreeFont, string> = {
  figtree: "'Figtree', sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  grotesk: "'Space Grotesk', 'Figtree', sans-serif",
  lora: "'Lora', Georgia, serif",
  bebas: "'Bebas Neue', 'Figtree', sans-serif",
};

/**
 * PUBLIC LinkTree page: /linktree/:slug
 * Read-only, unauthenticated showcase of one organization's packages. The org
 * is resolved from the slug; the payload is already scoped server-side (RLS),
 * and this page renders only what that payload contains.
 */
export function LinktreePage() {
  const { slug } = useParams<{ slug: string }>();
  const reduce = useReducedMotion();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const query = useQuery({
    queryKey: ['linktree', slug],
    queryFn: () => api.get<LinktreeModulePayload>(`/public/linktree/${slug}`),
    enabled: !!slug,
    retry: 1,
  });

  const payload = query.data;
  const theme = payload?.organization.linktreeTheme ?? {};

  const packages = useMemo(() => {
    const all = payload?.packages ?? [];
    const q = search.trim().toLowerCase();
    return all.filter(
      (p) =>
        (!activeCategory || p.categoryIds.includes(activeCategory)) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [payload?.packages, search, activeCategory]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6 pt-16">
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="mx-auto h-6 w-48" />
        <Skeleton className="h-12 w-full rounded-full" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-surface p-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-white">
          <Plane className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This LinkTree doesn't exist or was removed.</p>
      </div>
    );
  }

  const org = payload.organization;
  const name = theme.agencyName || org.name;
  const logo = theme.logoUrl || org.logoUrl;
  const btn = theme.buttonColor || '#F5B92E';
  const font = FONT_FAMILIES[theme.fontChoice ?? 'figtree'];
  const bgType = theme.backgroundType ?? 'color';
  const bgColor = theme.backgroundColor || org.brandPrimaryColor || '#1D4ED8';
  const waDigits = (theme.whatsappNumber ?? '').replace(/\D/g, '');
  // Mobile = coarse pointer / small screen; poster-only unless the org opts in.
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const wantVideo = bgType === 'video' && !!theme.backgroundVideoUrl && !videoFailed && (!isMobile || !!theme.allowVideoOnMobile);

  const bookHref = (p: LinktreeModulePackage) =>
    waDigits
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          `Hi ${name}, I want to book *${p.name}* (${p.destination}, ${p.days}D/${p.nights}N). Please share details.`,
        )}`
      : `/p/${p.id}#enquire`;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: EASE } };

  return (
    <div
      className="relative min-h-dvh"
      style={{ '--lt-btn': btn, fontFamily: font, backgroundColor: bgColor } as React.CSSProperties}
    >
      {/* Background layer: color / photo / video (poster-first, silent fallback) */}
      <div className="fixed inset-0">
        {bgType === 'color' && <div className="h-full w-full" style={{ backgroundColor: bgColor }} />}
        {bgType !== 'color' && theme.backgroundImageUrl && (
          <img
            src={theme.backgroundImageUrl}
            alt=""
            className={cn('h-full w-full object-cover transition-opacity duration-700', wantVideo && videoReady ? 'opacity-0' : 'opacity-100')}
          />
        )}
        {wantVideo && (
          <video
            src={theme.backgroundVideoUrl!}
            poster={theme.backgroundImageUrl ?? undefined}
            autoPlay
            loop
            muted
            playsInline
            onCanPlay={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
            className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', videoReady ? 'opacity-100' : 'opacity-0')}
          />
        )}
        <div className="absolute inset-0 bg-black/35" />
      </div>

      <div className="relative mx-auto max-w-lg px-4 pb-16 pt-10">
        {/* Profile */}
        <motion.div {...rise(0)} className="flex flex-col items-center text-center">
          {logo ? (
            <span className="flex size-24 items-center justify-center rounded-full bg-white p-1.5 shadow-pop">
              <img src={logo} alt="" className="size-full rounded-full object-cover" />
            </span>
          ) : (
            <span className="flex size-24 items-center justify-center rounded-full border-4 border-white bg-black/30 text-2xl font-bold text-white shadow-pop">
              {initials(name)}
            </span>
          )}
          <h1 className="mt-4 text-3xl font-extrabold uppercase tracking-wide text-white drop-shadow-lg" style={{ fontFamily: font }}>
            {name}
          </h1>
          {theme.shortBio && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-white/90 drop-shadow">{theme.shortBio}</p>}

          <div className="mt-4 flex items-center gap-3">
            {theme.instagramUrl && (
              <a
                href={theme.instagramUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <Instagram className="size-5" />
              </a>
            )}
            {waDigits && (
              <a
                href={`https://wa.me/${waDigits}`}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="flex size-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-transform hover:scale-110"
              >
                <Send className="size-5" />
              </a>
            )}
            {theme.websiteUrl && (
              <a
                href={theme.websiteUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold text-white backdrop-blur transition-transform hover:scale-105"
              >
                <Globe className="size-4" /> Website
              </a>
            )}
          </div>
        </motion.div>

        {/* Search */}
        <motion.div {...rise(0.08)} className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search packages…"
              aria-label="Search packages"
              className="h-12 w-full rounded-full border-0 bg-white pl-11 pr-4 text-[15px] text-neutral-900 shadow-pop outline-none placeholder:text-neutral-400"
            />
          </div>
        </motion.div>

        {/* Category tabs: All + non-empty categories, in the agency's order */}
        {payload.categories.length > 0 && (
          <motion.div {...rise(0.12)} className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={cn('shrink-0 rounded-xl px-4 py-2 text-sm font-bold shadow-card transition-colors', activeCategory ? 'bg-white text-neutral-700' : 'text-neutral-900')}
              style={!activeCategory ? { backgroundColor: btn } : undefined}
            >
              All
            </button>
            {payload.categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(activeCategory === c.id ? null : c.id)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold shadow-card transition-colors',
                  activeCategory === c.id ? 'text-neutral-900' : 'bg-white text-neutral-700',
                )}
                style={activeCategory === c.id ? { backgroundColor: btn } : undefined}
              >
                {c.name}
              </button>
            ))}
          </motion.div>
        )}

        {/* Package cards */}
        <div className="mt-4 space-y-3">
          {packages.length === 0 && (
            <div className="rounded-2xl bg-white/90 p-8 text-center text-sm text-neutral-600 backdrop-blur">
              {search || activeCategory ? 'No packages match — try another search or tab.' : 'No packages published yet.'}
            </div>
          )}
          {packages.map((p, i) => (
            <motion.div
              key={p.id}
              {...rise(0.16 + Math.min(i, 8) * 0.05)}
              className="overflow-hidden rounded-2xl bg-white/95 shadow-pop backdrop-blur"
            >
              <a href={`/p/${p.id}`} className="flex items-center gap-3 p-3">
                <span className="size-16 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:size-[4.5rem]">
                  {p.bannerImageUrl ? (
                    <img src={p.bannerImageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-neutral-400">
                      <MapPin className="size-5" />
                    </span>
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold uppercase leading-snug text-neutral-900" style={{ fontFamily: font }}>
                    {p.name}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-neutral-600">
                    from {formatCurrency(p.priceAmount, p.priceCurrency)}
                  </span>
                  {p.departures.length > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-neutral-500">
                      <CalendarDays className="size-3 shrink-0" />
                      <span className="truncate">{p.departures.map((d) => formatTravelDate(d)).join(' · ')}</span>
                    </span>
                  )}
                </span>

                <span className="flex shrink-0 flex-col gap-1.5 sm:flex-row" onClick={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`/p/${p.id}/pdf`, '_blank');
                    }}
                    className="flex items-center justify-center gap-1 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: btn }}
                  >
                    <FileText className="size-3.5" /> PDF
                  </button>
                  <a
                    href={bookHref(p)}
                    target={waDigits ? '_blank' : undefined}
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1 rounded-xl px-3.5 py-2 text-sm font-bold text-neutral-900 shadow-sm transition-transform hover:scale-105"
                    style={{ backgroundColor: btn }}
                  >
                    Book Now
                  </a>
                </span>
              </a>
            </motion.div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-white/70">
          Powered by <span className="font-semibold text-white">{name}</span> ✈
        </p>
      </div>
    </div>
  );
}
