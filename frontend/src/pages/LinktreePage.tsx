import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, Globe, Instagram, MapPin, Plane, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { LinktreeFont, LinktreeModulePackage, LinktreeModulePayload } from '@/types';
import { formatCurrency, formatTravelDate, initials } from '@/lib/format';
import { BookTripSheet } from '@/components/linktree/BookTripSheet';

const EASE = [0.22, 1, 0.36, 1] as const;

const FONT_FAMILIES: Record<LinktreeFont, string> = {
  figtree: "'Figtree', sans-serif",
  playfair: "'Playfair Display', Georgia, serif",
  grotesk: "'Space Grotesk', 'Figtree', sans-serif",
  lora: "'Lora', Georgia, serif",
  bebas: "'Bebas Neue', 'Figtree', sans-serif",
};

/** Default top colour of the background gradient (fades to deep navy at the bottom). */
const DEFAULT_TOP = '#4A67D6';
const BOTTOM = '#0B1024';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.4h-.01a9.4 9.4 0 0 1-4.79-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.36 9.36 0 0 1-1.44-5c0-5.18 4.22-9.4 9.41-9.4a9.34 9.34 0 0 1 6.65 2.76 9.34 9.34 0 0 1 2.75 6.65c0 5.18-4.22 9.4-9.4 9.4m8-17.41A11.25 11.25 0 0 0 12.05.67C5.8.67.7 5.76.7 12.02c0 2 .52 3.95 1.52 5.67L.6 23.33l5.77-1.51a11.3 11.3 0 0 0 5.67 1.45h.01c6.25 0 11.34-5.09 11.35-11.35a11.28 11.28 0 0 0-3.32-8.03" />
    </svg>
  );
}

/**
 * PUBLIC LinkTree page: /linktree/:slug — one agency's trips on one link
 * (for the Instagram bio / WhatsApp status). Royal-blue → navy gradient (or
 * the agency's photo / video), round logo, name, bio, category tabs, and one
 * dark glass row per trip with PDF · BOOK · WhatsApp.
 *
 * Read-only and unauthenticated: the org comes from the slug and the payload
 * is already scoped server-side (RLS); this page renders only what it contains.
 */
export function LinktreePage() {
  const { slug } = useParams<{ slug: string }>();
  const reduce = useReducedMotion();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [booking, setBooking] = useState<{ pkg: LinktreeModulePackage; mode: 'book' | 'pdf' } | null>(null);
  const closeBooking = useCallback(() => setBooking(null), []);
  const [tabsOverflow, setTabsOverflow] = useState(false);

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
        (!activeCategory || p.linktreeCategoryIds.includes(activeCategory)) &&
        (!q || p.name.toLowerCase().includes(q) || p.destination.toLowerCase().includes(q)),
    );
  }, [payload?.packages, search, activeCategory]);

  // The tabs row scrolls sideways on phones — show the ">" hint while there's more to the right.
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const check = () => setTabsOverflow(el.scrollWidth - el.scrollLeft - el.clientWidth > 4);
    check();
    el.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [payload?.categories.length]);

  if (query.isLoading) {
    return (
      <div className="min-h-dvh" style={{ background: `linear-gradient(180deg, ${DEFAULT_TOP} 0%, ${BOTTOM} 100%)` }}>
        <div className="mx-auto max-w-xl space-y-4 px-5 pt-16">
          <div className="mx-auto size-24 animate-pulse rounded-full bg-white/20" />
          <div className="mx-auto h-7 w-48 animate-pulse rounded-full bg-white/20" />
          <div className="mx-auto h-4 w-64 animate-pulse rounded-full bg-white/10" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center text-white" style={{ background: `linear-gradient(180deg, ${DEFAULT_TOP} 0%, ${BOTTOM} 100%)` }}>
        <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15">
          <Plane className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-sm text-white/70">This link doesn't exist or was removed.</p>
      </div>
    );
  }

  const org = payload.organization;
  const name = theme.agencyName || org.name;
  const logo = theme.logoUrl || org.logoUrl;
  const font = FONT_FAMILIES[theme.fontChoice ?? 'figtree'];
  const bgType = theme.backgroundType ?? 'color';
  const top = theme.backgroundColor || DEFAULT_TOP;
  // An agency that picked its own button colour gets a filled BOOK button in it.
  const accent = theme.buttonColor && theme.buttonColor.toUpperCase() !== '#F5B92E' ? theme.buttonColor : null;
  const waDigits = (theme.whatsappNumber ?? '').replace(/\D/g, '');
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches;
  const wantVideo = bgType === 'video' && !!theme.backgroundVideoUrl && !videoFailed && (!isMobile || !!theme.allowVideoOnMobile);
  const exploreHref = theme.websiteUrl || `/site/${org.slug}`;

  const waHref = (p: LinktreeModulePackage) =>
    `https://wa.me/${waDigits}?text=${encodeURIComponent(
      `Hi ${name}, I'm interested in *${p.name}* (${p.days}D/${p.nights}N). Please share the details.`,
    )}`;

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, delay, ease: EASE } };

  const pill =
    'flex h-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 px-2.5 text-[12px] font-semibold tracking-wide text-white transition-colors hover:bg-white/20 sm:h-9 sm:px-4 sm:text-[13px]';

  return (
    <div className="relative flex min-h-dvh flex-col" style={{ fontFamily: font, backgroundColor: BOTTOM }}>
      {/* Background: gradient (default), or the agency's photo / video under a dark wash */}
      <div className="fixed inset-0">
        <div className="h-full w-full" style={{ background: `linear-gradient(180deg, ${top} 0%, ${BOTTOM} 100%)` }} />
        {bgType !== 'color' && theme.backgroundImageUrl && (
          <img
            src={theme.backgroundImageUrl}
            alt=""
            className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', wantVideo && videoReady ? 'opacity-0' : 'opacity-100')}
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
        {bgType !== 'color' && <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(11,16,36,.35) 0%, rgba(11,16,36,.88) 100%)` }} />}
      </div>

      <main className="relative mx-auto w-full max-w-xl flex-1 px-4 pb-10 pt-12 sm:px-5 sm:pt-16">
        {/* Profile */}
        <motion.div {...rise(0)} className="flex flex-col items-center text-center">
          <span className="flex size-[104px] items-center justify-center rounded-full bg-white p-[5px] shadow-[0_12px_40px_rgba(0,0,0,.35)] ring-4 ring-white/25">
            {logo ? (
              <img src={logo} alt={name} className="size-full rounded-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center rounded-full bg-[#0B1024] text-3xl font-bold text-white">{initials(name)}</span>
            )}
          </span>
          <h1
            className={cn(
              'mt-5 break-words font-extrabold uppercase leading-tight text-white sm:text-[32px] sm:tracking-[0.18em]',
              name.length > 18 ? 'text-[22px] tracking-[0.1em]' : 'text-[28px] tracking-[0.16em]',
            )}
          >
            {name}
          </h1>
          {theme.shortBio && (
            <p className="mt-3 max-w-md whitespace-pre-line text-[15px] leading-relaxed text-[#c9d6ff]">{theme.shortBio}</p>
          )}
          {(theme.instagramUrl || theme.websiteUrl) && (
            <div className="mt-4 flex items-center gap-2.5">
              {theme.instagramUrl && (
                <a href={theme.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram" className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20">
                  <Instagram className="size-[18px]" />
                </a>
              )}
              {theme.websiteUrl && (
                <a href={theme.websiteUrl} target="_blank" rel="noreferrer" aria-label="Website" className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20">
                  <Globe className="size-[18px]" />
                </a>
              )}
            </div>
          )}
        </motion.div>

        {/* Search — only worth it with a long list */}
        {payload.packages.length > 8 && (
          <motion.div {...rise(0.06)} className="relative mt-7">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/50" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trips…"
              aria-label="Search trips"
              className="h-11 w-full rounded-full border border-white/15 bg-white/10 pl-11 pr-4 text-[15px] text-white outline-none backdrop-blur placeholder:text-white/50 focus:border-white/40"
            />
          </motion.div>
        )}

        {/* Category tabs */}
        {payload.categories.length > 0 && (
          <motion.div {...rise(0.1)} className="relative -mx-4 mt-7 sm:-mx-5">
            <div ref={tabsRef} className="flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:px-5 [&::-webkit-scrollbar]:hidden">
              {[{ id: null as string | null, name: 'All' }, ...payload.categories].map((c) => {
                const on = activeCategory === c.id;
                return (
                  <button
                    key={c.id ?? 'all'}
                    type="button"
                    onClick={() => setActiveCategory(c.id)}
                    className={cn(
                      'h-10 shrink-0 whitespace-nowrap rounded-full px-5 text-[13px] font-bold uppercase tracking-[0.16em] transition-colors',
                      on ? 'bg-white text-[#0B1024] shadow-lg' : 'border border-white/25 bg-white/10 text-white hover:bg-white/20',
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            {tabsOverflow && (
              <button
                type="button"
                aria-label="More categories"
                onClick={() => tabsRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                className="absolute right-2 top-0.5 flex size-9 items-center justify-center rounded-full bg-[#0B1024]/90 text-white shadow-lg ring-1 ring-white/20"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </motion.div>
        )}

        {/* Trips */}
        <div className="mt-5 space-y-3">
          {packages.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-8 text-center text-sm text-white/70">
              {search || activeCategory ? 'No trips here yet — try another tab.' : 'No trips published yet.'}
            </div>
          )}
          {packages.map((p, i) => (
            <motion.div
              key={p.id}
              {...rise(0.14 + Math.min(i, 8) * 0.04)}
              className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-[#141c3d]/70 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,.25)] backdrop-blur-md sm:gap-3.5 sm:p-3"
            >
              <a href={`/p/${p.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3.5">
                <span className="size-11 shrink-0 overflow-hidden rounded-xl bg-white/10 sm:size-14">
                  {p.bannerImageUrl ? (
                    <img src={p.bannerImageUrl} alt="" loading="lazy" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center text-white/40">
                      <MapPin className="size-5" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold leading-snug text-white sm:text-base">{p.name}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-white/65 sm:text-[13px]">
                    {p.days}D/{p.nights}N · {formatCurrency(p.priceAmount, p.priceCurrency)}
                    {p.departures.length > 0 && <span className="hidden sm:inline"> · Next {formatTravelDate(p.departures[0])}</span>}
                  </span>
                </span>
              </a>
              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <button type="button" onClick={() => setBooking({ pkg: p, mode: 'pdf' })} className={pill}>
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() => setBooking({ pkg: p, mode: 'book' })}
                  className={cn(pill, accent && 'border-transparent text-[#0B1024] hover:opacity-90')}
                  style={accent ? { backgroundColor: accent } : undefined}
                >
                  BOOK
                </button>
                {waDigits && (
                  <a
                    href={waHref(p)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Ask about ${p.name} on WhatsApp`}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25D366] sm:size-10 text-white shadow-[0_4px_14px_rgba(37,211,102,.35)] transition-transform hover:scale-105"
                  >
                    <WhatsAppIcon className="size-5" />
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Explore all trips */}
        <motion.a
          {...rise(0.2)}
          href={exploreHref}
          target={theme.websiteUrl ? '_blank' : undefined}
          rel="noreferrer"
          className="mt-8 flex h-14 w-full items-center justify-center rounded-2xl border border-white/20 bg-[#0d1226]/80 text-[15px] font-bold uppercase tracking-[0.22em] text-white transition-colors hover:bg-[#151b36]"
        >
          Explore all trips
        </motion.a>
      </main>

      <BookTripSheet
        slug={org.slug}
        pkg={booking?.pkg ?? null}
        mode={booking?.mode}
        agencyName={name}
        whatsappHref={booking && waDigits ? waHref(booking.pkg) : null}
        onClose={closeBooking}
      />

      <footer className="relative bg-black py-6 text-center text-sm text-white/45">
        Powered by{' '}
        <a href="https://joinetra.com" target="_blank" rel="noreferrer" className="text-white/70 hover:text-white">
          Joinetra
        </a>
      </footer>
    </div>
  );
}
