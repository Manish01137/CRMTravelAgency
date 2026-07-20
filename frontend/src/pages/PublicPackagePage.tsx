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
import { cn } from '@/lib/utils';
import type { PackageViewType, TravelPackage } from '@/types';
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
 * Premium template themes chosen via the package's View Type.
 * Every theme is a complete visual identity: its own palette (accent overrides
 * the org brand), display font, hero treatment and card language — so an
 * Adventure trip and a Honeymoon never look alike.
 */
interface Theme {
  page: string;
  heroH: string;
  overlay: string;
  title: string;
  /** CSS font-family for the hero title (defaults to Figtree). */
  titleFont?: string;
  /** CSS font-family for section headings. */
  headFont?: string;
  /** Fixed accent palette; falls back to the org's brand colors when unset. */
  accent?: string;
  accent2?: string;
  destChip: string;
  metaChip: string;
  card: string;
  body: string;
  muted: string;
  sectionTitle: string;
  highlightChip: string;
  timelineLine: string;
  priceCard: string;
}

const BEBAS = "'Bebas Neue', 'Figtree', sans-serif";
const PLAYFAIR = "'Playfair Display', Georgia, serif";
const GROTESK = "'Space Grotesk', 'Figtree', sans-serif";
const LORA = "'Lora', Georgia, serif";
const CAVEAT = "'Caveat', cursive";

const THEMES: Record<PackageViewType, Theme> = {
  // Classic — bright, friendly, org-brand gradient hero (the default).
  CLASSIC: {
    page: 'bg-surface text-foreground',
    heroH: 'h-64 sm:h-80',
    overlay: 'bg-gradient-to-t from-black/70 via-black/20 to-black/25',
    title: 'font-display text-3xl font-extrabold leading-tight drop-shadow sm:text-4xl',
    destChip: 'bg-white/20 backdrop-blur',
    metaChip: 'bg-white/20',
    card: 'rounded-2xl border border-border bg-card shadow-card',
    body: 'text-foreground',
    muted: 'text-muted-foreground',
    sectionTitle: 'font-display text-xl font-bold text-foreground',
    highlightChip: 'bg-card text-foreground shadow-card',
    timelineLine: 'before:bg-border',
    priceCard: 'border border-border bg-card shadow-pop',
  },
  // Modern — dark editorial, oversized uppercase display, glassy cards.
  MODERN: {
    page: 'bg-neutral-950 text-neutral-100',
    heroH: 'h-80 sm:h-[28rem]',
    overlay: 'bg-gradient-to-t from-black/85 via-black/35 to-black/40',
    title: 'font-display text-4xl font-black uppercase leading-[0.95] tracking-tight drop-shadow sm:text-6xl',
    destChip: 'bg-white/10 uppercase tracking-widest backdrop-blur',
    metaChip: 'bg-white/10',
    card: 'rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur',
    body: 'text-neutral-200',
    muted: 'text-neutral-400',
    sectionTitle: 'font-display text-2xl font-extrabold uppercase tracking-tight text-white',
    highlightChip: 'border border-white/15 bg-white/5 text-neutral-100',
    timelineLine: 'before:bg-white/15',
    priceCard: 'border border-white/10 bg-white/[0.06] backdrop-blur',
  },
  // Minimal — airy white, thin rules, small-caps labels.
  MINIMAL: {
    page: 'bg-white text-neutral-900',
    heroH: 'h-72 sm:h-[26rem]',
    overlay: 'bg-gradient-to-t from-black/55 via-black/10 to-black/15',
    title: 'font-display text-3xl font-bold leading-tight drop-shadow sm:text-5xl',
    destChip: 'bg-white/25 backdrop-blur',
    metaChip: 'bg-white/25',
    card: 'rounded-none border border-neutral-200 bg-white',
    body: 'text-neutral-800',
    muted: 'text-neutral-500',
    sectionTitle: 'font-display text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500',
    highlightChip: 'border border-neutral-200 bg-white text-neutral-700',
    timelineLine: 'before:bg-neutral-200',
    priceCard: 'border border-neutral-200 bg-white shadow-sm',
  },
  // Adventure — charcoal base, blaze-orange accents, towering condensed type.
  ADVENTURE: {
    page: 'bg-[#16130f] text-stone-100',
    heroH: 'h-80 sm:h-[30rem]',
    overlay: 'bg-gradient-to-t from-[#16130f] via-black/30 to-black/45',
    title: 'text-6xl font-normal uppercase leading-[0.9] tracking-wide drop-shadow-lg sm:text-8xl',
    titleFont: BEBAS,
    headFont: BEBAS,
    accent: '#f97316',
    accent2: '#dc2626',
    destChip: 'bg-orange-500/25 uppercase tracking-[0.25em] backdrop-blur',
    metaChip: 'bg-white/10 uppercase tracking-widest',
    card: 'rounded-md border-l-4 border-orange-500/80 bg-white/[0.05]',
    body: 'text-stone-100',
    muted: 'text-stone-400',
    sectionTitle: 'text-3xl font-normal uppercase tracking-widest text-orange-400',
    highlightChip: 'rounded-md border border-orange-500/30 bg-orange-500/10 uppercase tracking-wide text-orange-300',
    timelineLine: 'before:bg-orange-500/25',
    priceCard: 'border border-white/10 bg-white/[0.06]',
  },
  // Beach — sandy white, surf cyan + coral, handwritten hero script.
  BEACH: {
    page: 'bg-[#fffdf5] text-slate-800',
    heroH: 'h-72 sm:h-[26rem]',
    overlay: 'bg-gradient-to-t from-cyan-950/70 via-cyan-900/10 to-sky-900/20',
    title: 'text-5xl font-bold leading-tight drop-shadow sm:text-7xl',
    titleFont: CAVEAT,
    accent: '#0891b2',
    accent2: '#f59e0b',
    destChip: 'bg-white/30 backdrop-blur',
    metaChip: 'bg-white/30',
    card: 'rounded-3xl border border-cyan-100 bg-white shadow-[0_12px_35px_-18px_rgba(8,145,178,0.4)]',
    body: 'text-slate-800',
    muted: 'text-slate-500',
    sectionTitle: 'font-display text-xl font-extrabold text-cyan-900',
    highlightChip: 'rounded-full border border-cyan-100 bg-cyan-50 text-cyan-900',
    timelineLine: 'before:bg-cyan-200',
    priceCard: 'rounded-3xl border border-cyan-100 bg-white shadow-[0_12px_35px_-18px_rgba(8,145,178,0.4)]',
  },
  // Pilgrimage — warm cream, saffron & maroon, devotional serif.
  PILGRIMAGE: {
    page: 'bg-[#fff8ec] text-[#53331b]',
    heroH: 'h-72 sm:h-[26rem]',
    overlay: 'bg-gradient-to-t from-[#431f0c]/85 via-amber-950/20 to-amber-900/25',
    title: 'text-4xl font-semibold leading-tight drop-shadow sm:text-6xl',
    titleFont: LORA,
    headFont: LORA,
    accent: '#b45309',
    accent2: '#7c2d12',
    destChip: 'bg-amber-400/30 backdrop-blur',
    metaChip: 'bg-white/20',
    card: 'rounded-xl border border-amber-200 bg-white/85',
    body: 'text-[#53331b]',
    muted: 'text-[#8a6644]',
    sectionTitle: 'text-2xl font-semibold text-[#7c2d12]',
    highlightChip: 'rounded-full border border-amber-200 bg-amber-100/80 text-amber-900',
    timelineLine: 'before:bg-amber-300/70',
    priceCard: 'rounded-xl border-2 border-amber-300 bg-white',
  },
  // Romance — blush ivory, rose accents, italic serif elegance.
  ROMANCE: {
    page: 'bg-[#fdf3f7] text-[#48222f]',
    heroH: 'h-72 sm:h-[26rem]',
    overlay: 'bg-gradient-to-t from-[#4c1526]/80 via-rose-900/15 to-rose-900/20',
    title: 'text-4xl font-semibold italic leading-tight drop-shadow sm:text-6xl',
    titleFont: PLAYFAIR,
    headFont: PLAYFAIR,
    accent: '#e11d48',
    accent2: '#f472b6',
    destChip: 'bg-white/25 backdrop-blur',
    metaChip: 'bg-white/25',
    card: 'rounded-[2rem] border border-rose-100 bg-white shadow-[0_10px_30px_-18px_rgba(225,29,72,0.35)]',
    body: 'text-[#48222f]',
    muted: 'text-[#9d6b7b]',
    sectionTitle: 'text-2xl font-semibold italic text-rose-900',
    highlightChip: 'rounded-full border border-rose-100 bg-rose-50 text-rose-800',
    timelineLine: 'before:bg-rose-200',
    priceCard: 'rounded-[2rem] border border-rose-100 bg-white shadow-[0_10px_30px_-18px_rgba(225,29,72,0.35)]',
  },
  // Wildlife — deep jungle green, lime signal accents, techy grotesk.
  WILDLIFE: {
    page: 'bg-[#0c1911] text-emerald-50',
    heroH: 'h-80 sm:h-[28rem]',
    overlay: 'bg-gradient-to-t from-[#0c1911] via-emerald-950/40 to-black/40',
    title: 'text-4xl font-bold uppercase leading-none tracking-tight drop-shadow-lg sm:text-6xl',
    titleFont: GROTESK,
    headFont: GROTESK,
    accent: '#a3e635',
    accent2: '#166534',
    destChip: 'bg-lime-400/15 uppercase tracking-[0.2em] text-lime-200 backdrop-blur',
    metaChip: 'bg-white/10',
    card: 'rounded-2xl border border-emerald-800/70 bg-emerald-950/50',
    body: 'text-emerald-50',
    muted: 'text-emerald-200/60',
    sectionTitle: 'text-2xl font-bold uppercase tracking-wide text-lime-300',
    highlightChip: 'rounded-md border border-lime-400/25 bg-lime-400/10 text-lime-200',
    timelineLine: 'before:bg-emerald-800',
    priceCard: 'rounded-2xl border border-emerald-800/70 bg-emerald-950/60',
  },
  // Weekend — playful violet pop with chunky offset shadows.
  WEEKEND: {
    page: 'bg-[#f5f3ff] text-slate-900',
    heroH: 'h-64 sm:h-80',
    overlay: 'bg-gradient-to-t from-violet-950/80 via-violet-900/20 to-fuchsia-900/25',
    title: 'font-display text-4xl font-black leading-tight drop-shadow sm:text-5xl',
    accent: '#7c3aed',
    accent2: '#fb923c',
    destChip: 'bg-white/25 backdrop-blur',
    metaChip: 'bg-white/25',
    card: 'rounded-2xl border-2 border-violet-200 bg-white shadow-[5px_5px_0_0_rgba(124,58,237,0.2)]',
    body: 'text-slate-900',
    muted: 'text-slate-500',
    sectionTitle: 'font-display text-2xl font-black text-violet-900',
    highlightChip: 'rounded-xl border-2 border-violet-200 bg-white font-bold text-violet-700 shadow-[3px_3px_0_0_rgba(124,58,237,0.2)]',
    timelineLine: 'before:bg-violet-300',
    priceCard: 'rounded-2xl border-2 border-violet-300 bg-white shadow-[5px_5px_0_0_rgba(124,58,237,0.25)]',
  },
  // Luxury — ivory & gold, hairline rules, editorial serif.
  LUXURY: {
    page: 'bg-[#faf9f6] text-neutral-900',
    heroH: 'h-80 sm:h-[30rem]',
    overlay: 'bg-gradient-to-t from-[#171310]/85 via-black/15 to-black/25',
    title: 'text-4xl font-bold leading-tight tracking-tight drop-shadow sm:text-6xl',
    titleFont: PLAYFAIR,
    headFont: PLAYFAIR,
    accent: '#a3812e',
    accent2: '#171310',
    destChip: 'bg-white/20 uppercase tracking-[0.35em] backdrop-blur',
    metaChip: 'bg-white/20 uppercase tracking-widest',
    card: 'rounded-none border border-[#e4ddcc] bg-white',
    body: 'text-neutral-800',
    muted: 'text-neutral-500',
    sectionTitle: 'text-2xl font-semibold text-neutral-900',
    highlightChip: 'rounded-none border border-[#d8c9a3] bg-white uppercase tracking-wide text-neutral-700',
    timelineLine: 'before:bg-[#d8c9a3]',
    priceCard: 'rounded-none border-y-2 border-[#a3812e]/60 bg-white',
  },
  // Backpack — kraft paper, dashed sticker borders, teal marker accents.
  BACKPACK: {
    page: 'bg-[#f6f1e7] text-stone-800',
    heroH: 'h-64 sm:h-80',
    overlay: 'bg-gradient-to-t from-stone-900/80 via-stone-900/15 to-stone-800/25',
    title: 'text-4xl font-bold leading-tight drop-shadow sm:text-5xl',
    titleFont: GROTESK,
    headFont: GROTESK,
    accent: '#0d9488',
    accent2: '#f59e0b',
    destChip: 'bg-white/25 backdrop-blur',
    metaChip: 'bg-white/25',
    card: 'rounded-xl border-2 border-dashed border-stone-300 bg-white',
    body: 'text-stone-800',
    muted: 'text-stone-500',
    sectionTitle: 'text-2xl font-bold text-teal-800',
    highlightChip: 'rounded-full border-2 border-dashed border-teal-300 bg-teal-50 text-teal-800',
    timelineLine: 'before:border-l-2 before:border-dashed before:border-stone-300 before:bg-transparent',
    priceCard: 'rounded-xl border-2 border-dashed border-teal-400 bg-white',
  },
  // Family — cheerful sky blue + tangerine, soft rounded shapes.
  FAMILY: {
    page: 'bg-[#eef6ff] text-slate-800',
    heroH: 'h-64 sm:h-80',
    overlay: 'bg-gradient-to-t from-blue-950/75 via-blue-900/15 to-sky-900/20',
    title: 'font-display text-4xl font-extrabold leading-tight drop-shadow sm:text-5xl',
    accent: '#2563eb',
    accent2: '#f97316',
    destChip: 'bg-white/25 backdrop-blur',
    metaChip: 'bg-white/25',
    card: 'rounded-3xl border border-blue-100 bg-white shadow-[0_10px_30px_-18px_rgba(37,99,235,0.35)]',
    body: 'text-slate-800',
    muted: 'text-slate-500',
    sectionTitle: 'font-display text-2xl font-extrabold text-blue-900',
    highlightChip: 'rounded-full bg-blue-100 font-semibold text-blue-800',
    timelineLine: 'before:bg-blue-200',
    priceCard: 'rounded-3xl border border-blue-100 bg-white shadow-[0_10px_30px_-18px_rgba(37,99,235,0.35)]',
  },
  // Hills — misty pine white-to-green wash, calm serif italics.
  HILLS: {
    page: 'bg-gradient-to-b from-[#edfaf1] to-white text-slate-800',
    heroH: 'h-72 sm:h-[26rem]',
    overlay: 'bg-gradient-to-t from-emerald-950/80 via-emerald-900/15 to-slate-900/25',
    title: 'text-4xl font-semibold italic leading-tight drop-shadow sm:text-6xl',
    titleFont: LORA,
    headFont: LORA,
    accent: '#059669',
    accent2: '#334155',
    destChip: 'bg-white/25 backdrop-blur',
    metaChip: 'bg-white/25',
    card: 'rounded-2xl border border-emerald-100 border-t-4 border-t-emerald-500/70 bg-white',
    body: 'text-slate-800',
    muted: 'text-slate-500',
    sectionTitle: 'text-2xl font-semibold italic text-emerald-900',
    highlightChip: 'rounded-full border border-emerald-100 bg-emerald-50 text-emerald-800',
    timelineLine: 'before:bg-emerald-200',
    priceCard: 'rounded-2xl border border-emerald-100 border-t-4 border-t-emerald-500/70 bg-white',
  },
};

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

  const t = THEMES[pkg.viewType] ?? THEMES.CLASSIC;
  // Theme accents win over org branding so each template has a fixed identity;
  // Classic/Modern/Minimal keep the agency's own brand colors.
  const brand = t.accent ?? org?.brandPrimaryColor ?? '#4F46E5';
  const brand2 = t.accent2 ?? org?.brandSecondaryColor ?? '#0D9488';
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
    <div className={cn('min-h-dvh pb-28 sm:pb-16', t.page)}>
      {/* Hero */}
      <div className={cn('relative w-full overflow-hidden', t.heroH)} style={{ background: `linear-gradient(120deg, ${brand}, ${brand2})` }}>
        {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
        <div className={cn('absolute inset-0', t.overlay)} />
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
          <span className={cn('inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold', t.destChip)}>
            <MapPin className="size-3.5" /> {pkg.destination}
          </span>
          <h1 className={cn('mt-2', t.title)} style={t.titleFont ? { fontFamily: t.titleFont } : undefined}>
            {pkg.bookingTitle || pkg.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', t.metaChip)}>
              <Moon className="size-3.5" /> {pkg.nights}N
            </span>
            <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1', t.metaChip)}>
              <Sun className="size-3.5" /> {pkg.days}D
            </span>
          </div>
        </motion.div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {/* Price + PDF */}
        <motion.div {...rise(0.1)} className={cn('-mt-6 flex items-center justify-between gap-3 rounded-2xl p-4', t.priceCard)}>
          <div>
            <p className="font-display text-2xl font-bold" style={{ color: brand }}>
              {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
              {discounted && (
                <span className={cn('ml-2 text-sm font-medium line-through', t.muted)}>
                  {formatCurrency(pkg.originalPrice!, pkg.priceCurrency)}
                </span>
              )}
            </p>
            <p className={cn('text-xs', t.muted)}>per person</p>
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
                <span key={i} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium', t.highlightChip)}>
                  <Sparkles className="size-3.5" style={{ color: brand }} /> {h}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {pkg.description && (
          <motion.p {...rise(0.18)} className={cn('mt-6 whitespace-pre-line text-[15px] leading-relaxed', t.body)}>
            {pkg.description}
          </motion.p>
        )}

        {/* Day-wise itinerary */}
        {pkg.itinerary.length > 0 && (
          <motion.div {...rise(0.22)} className="mt-8">
            <h2 className={t.sectionTitle} style={t.headFont ? { fontFamily: t.headFont } : undefined}>
              Day-by-day plan
            </h2>
            <div className={cn('relative mt-4 space-y-4 before:absolute before:left-[15px] before:top-2 before:h-full before:w-0.5', t.timelineLine)}>
              {pkg.itinerary.map((d) => (
                <div key={d.day} className="relative pl-11">
                  <span
                    className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full font-display text-xs font-bold text-white shadow"
                    style={{ backgroundColor: brand }}
                  >
                    {d.day}
                  </span>
                  <div className={cn('p-4', t.card)}>
                    <h3
                      className={cn('font-display text-base font-bold', t.body)}
                      style={t.headFont ? { fontFamily: t.headFont } : undefined}
                    >
                      {d.title}
                    </h3>
                    {d.description && <p className={cn('mt-1 whitespace-pre-line text-sm', t.muted)}>{d.description}</p>}
                    {(d.images?.length ?? 0) > 0 && (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {d.images!.map((src, k) => (
                          <img key={k} src={src} alt="" className="h-24 w-32 shrink-0 rounded-lg object-cover" />
                        ))}
                      </div>
                    )}
                    {/* Selected activities (copied from the library) */}
                    {(d.activityBlocks?.length ?? 0) > 0 && (
                      <div className="mt-3 space-y-2.5">
                        {d.activityBlocks!.map((b, k) => (
                          <div key={k} className="flex gap-3">
                            {b.imageUrl && (
                              <img src={b.imageUrl} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
                            )}
                            <div className="min-w-0">
                              <p className={cn('text-sm font-semibold', t.body)}>{b.name}</p>
                              {b.description && <p className={cn('mt-0.5 text-xs', t.muted)}>{b.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={cn('mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium', t.muted)}>
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
              <div className={cn('p-5', t.card)}>
                <h3 className="font-display text-base font-bold text-emerald-600">What's included</h3>
                <ul className="mt-3 space-y-2">
                  {inclusions.map((l, i) => (
                    <li key={i} className={cn('flex items-start gap-2 text-sm', t.body)}>
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" /> {l}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {exclusions.length > 0 && (
              <div className={cn('p-5', t.card)}>
                <h3 className="font-display text-base font-bold text-red-500">Not included</h3>
                <ul className="mt-3 space-y-2">
                  {exclusions.map((l, i) => (
                    <li key={i} className={cn('flex items-start gap-2 text-sm', t.body)}>
                      <X className="mt-0.5 size-4 shrink-0 text-red-500" /> {l}
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

        {/* Enquiry — always a light card so the form stays readable on every theme */}
        <motion.div {...rise(0.34)} id="enquire" className="mt-10 rounded-2xl border border-border bg-card p-6 text-foreground shadow-soft">
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

        <p className={cn('mt-8 text-center text-xs', t.muted)}>
          Powered by <span className={cn('font-semibold', t.body)}>{orgName}</span> ✈
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
