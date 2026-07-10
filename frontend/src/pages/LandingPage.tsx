import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  Contact2,
  LayoutGrid,
  MessageCircle,
  Plane,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UsersRound,
  Wallet,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------ Motion helpers ----------------------------- */

const EASE = [0.22, 1, 0.36, 1] as const;

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Ether-style section heading: violet eyebrow → huge headline → gray subtext. */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light = false,
  eyebrowClass,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  light?: boolean;
  eyebrowClass?: string;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <p className={cn('text-base font-semibold', eyebrowClass ?? (light ? 'text-amber-300' : 'text-primary'))}>
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl',
          light ? 'text-white' : 'text-foreground',
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={cn('mx-auto mt-5 max-w-2xl text-base sm:text-lg', light ? 'text-white/75' : 'text-muted-foreground')}>
          {subtitle}
        </p>
      )}
    </Reveal>
  );
}

/* --------------------------------- Chrome ---------------------------------- */

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm',
        className,
      )}
    >
      <Plane className="size-5" />
    </span>
  );
}

function Nav() {
  const { status } = useAuth();
  const authed = status === 'authenticated';
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-tight text-foreground">Voyage</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#why" className="transition-colors hover:text-foreground">
            Why Voyage
          </a>
          <a href="#features" className="transition-colors hover:text-foreground">
            Features
          </a>
          <a href="#stories" className="transition-colors hover:text-foreground">
            Stories
          </a>
        </nav>
        <div className="flex items-center gap-2.5">
          {authed ? (
            <Button asChild size="sm" className="h-10 px-4">
              <Link to="/dashboard">
                Open dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="h-10 px-4">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="h-10 px-4">
                <Link to="/signup">
                  Get started <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------- Hero ---------------------------------- */

/** CSS-built product preview — a miniature of the real leads dashboard. */
function ProductMock() {
  const rows = [
    { name: 'Priya Menon', dest: 'Bali, Indonesia', status: 'New', dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700' },
    { name: 'Tom Becker', dest: 'Swiss Alps', status: 'Proposal', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
    { name: 'Nadia Hassan', dest: 'Maldives', status: 'Won', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  ];
  const stages = ['bg-blue-500', 'bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-orange-500', 'bg-emerald-600'];
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-pop">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-amber-400" />
          <span className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 hidden rounded-md bg-card px-3 py-0.5 text-[10px] text-muted-foreground sm:block">
            app.voyagecrm.com/leads
          </span>
        </div>
        <div className="flex">
          <div className="hidden w-36 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 sm:flex">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="flex size-5 items-center justify-center rounded-md bg-primary text-white">
                <Plane className="size-3" />
              </span>
              <span className="font-display text-[11px] font-bold">Voyage</span>
            </div>
            {['Dashboard', 'Leads', 'Team', 'Settings'].map((item, i) => (
              <div
                key={item}
                className={cn(
                  'rounded-md px-2 py-1.5 text-[10px] font-medium',
                  i === 1 ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                )}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1 space-y-3 p-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Leads captured', '2,430'],
                ["Today's leads", '7'],
                ['Converted', '44'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border bg-card p-2.5">
                  <p className="truncate text-[9px] text-muted-foreground">{label}</p>
                  <p className="font-display text-sm font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-0.5 overflow-hidden">
              {stages.map((c, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-4 flex-1 [clip-path:polygon(0_0,calc(100%-6px)_0,100%_50%,calc(100%-6px)_100%,0_100%,5px_50%)]',
                    c,
                    i > 2 && 'hidden sm:block',
                  )}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.name} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                      {r.name.split(' ').map((p) => p[0]).join('')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold text-foreground">{r.name}</p>
                      <p className="truncate text-[9px] text-muted-foreground">{r.dest}</p>
                    </div>
                  </div>
                  <span className={cn('flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium', r.pill)}>
                    <span className={cn('size-1 rounded-full', r.dot)} />
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="animate-float absolute -bottom-6 -left-4 hidden items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-pop sm:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-700">
          <MessageCircle className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground">New WhatsApp lead</p>
          <p className="text-[10px] text-muted-foreground">Priya · Bali · ₹2.5L budget</p>
        </div>
      </div>
      <div className="animate-float-delayed absolute -right-4 -top-6 hidden items-center gap-2.5 rounded-xl border border-border bg-card p-3 shadow-pop sm:flex">
        <span className="flex size-8 items-center justify-center rounded-full bg-teal-100 text-teal-700">
          <CalendarCheck2 className="size-4" />
        </span>
        <div>
          <p className="text-xs font-semibold text-foreground">Booking confirmed</p>
          <p className="text-[10px] text-muted-foreground">Maldives · $5,300</p>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const { status } = useAuth();
  const authed = status === 'authenticated';

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : {
          initial: { opacity: 0, y: 22 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.65, delay, ease: EASE },
        };

  return (
    <section className="relative overflow-hidden">
      <div className="animate-blob pointer-events-none absolute -top-24 left-1/2 h-[26rem] w-[26rem] -translate-x-[80%] rounded-full bg-primary/15 blur-3xl" />
      <div className="animate-blob-slow pointer-events-none absolute -top-10 left-1/2 h-[22rem] w-[22rem] translate-x-[10%] rounded-full bg-violet-400/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_50%_-10%,hsl(var(--primary)/0.06),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
        <motion.div {...rise(0)} className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground shadow-card">
            <span className="flex text-amber-400" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-3 fill-current" strokeWidth={0} />
              ))}
            </span>
            Rated 4.8 · Trusted by travel agencies across India
          </span>
        </motion.div>

        <motion.h1
          {...rise(0.1)}
          className="mx-auto max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl"
        >
          All-in-one Operating System for{' '}
          <span className="bg-gradient-to-r from-primary via-violet-500 to-primary bg-clip-text text-transparent">
            Travel Agencies
          </span>
        </motion.h1>

        <motion.p {...rise(0.2)} className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
          Capture every enquiry, run one clean pipeline, and close more trips together — without
          juggling five different tools.
        </motion.p>

        <motion.div {...rise(0.3)} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {authed ? (
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/dashboard">
                Open your dashboard <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to="/signup">
                  Get started free <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link to="/login">Sign in</Link>
              </Button>
            </>
          )}
        </motion.div>

        <motion.p {...rise(0.38)} className="mt-4 text-xs text-muted-foreground">
          No learning curve. Set up your agency in under two minutes.
        </motion.p>

        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, scale: 0.97 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.45, ease: EASE }}
          className="mt-14"
        >
          <ProductMock />
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------- “What makes us different” bento --------------------- */

interface Bento {
  bg: string;
  iconBg: string;
  Icon: typeof Zap;
  title: string;
  text: string;
  soon?: boolean;
  inner: ReactNode;
}

function InnerTagline({ line1, line2, icon }: { line1: string; line2: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-card">
      <p className="font-display text-lg font-bold leading-snug text-foreground sm:text-xl">
        {line1}
        <br />
        {line2}
      </p>
      <span className="shrink-0 text-primary">{icon}</span>
    </div>
  );
}

const BENTOS: Bento[] = [
  {
    bg: 'bg-[#E9E4FB]',
    iconBg: 'bg-violet-500',
    Icon: LayoutGrid,
    title: 'All-in-One Solution',
    text: 'Handle everything from enquiry to itinerary in one place. Capture leads, assign agents, track stages, and follow up — without switching tools.',
    inner: (
      <InnerTagline
        line1="Everything You Need."
        line2="In One Place."
        icon={
          <span className="grid grid-cols-2 gap-1.5">
            <span className="size-5 rounded-md border-[3px] border-violet-500" />
            <span className="size-5 rotate-45 rounded-md border-[3px] border-violet-500" />
            <span className="size-5 rounded-md border-[3px] border-violet-500" />
            <span className="size-5 rounded-md border-[3px] border-violet-500" />
          </span>
        }
      />
    ),
  },
  {
    bg: 'bg-[#D9F2F8]',
    iconBg: 'bg-cyan-400',
    Icon: TrendingUp,
    title: 'Boost Bookings',
    text: 'Reply first, follow up on time, and keep every enquiry warm. Faster responses mean more confirmed trips and more word-of-mouth.',
    inner: (
      <InnerTagline
        line1="More Follow-ups."
        line2="More Bookings."
        icon={<TrendingUp className="size-10 text-cyan-500" />}
      />
    ),
  },
  {
    bg: 'bg-[#FADEE5]',
    iconBg: 'bg-pink-400',
    Icon: MessageCircle,
    title: 'Streamline Operations',
    text: 'One pipeline for the whole team — assignments, remarks, reminders and roles, so nothing slips through personal chats and spreadsheets.',
    inner: (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-lg font-bold text-foreground sm:text-xl">Less Chaos. More Clarity</p>
          <BellRing className="size-8 shrink-0 text-pink-400" />
        </div>
        <div className="mt-5 flex gap-3">
          <div className="-rotate-3 rounded-xl bg-pink-100 p-4 shadow-card transition-transform duration-200 hover:rotate-0">
            <p className="flex items-center gap-1 text-[10px] font-medium text-pink-700">
              <UsersRound className="size-3" /> User-Friendly
            </p>
            <p className="mt-1 font-display text-sm font-bold text-foreground">No Learning Curve</p>
          </div>
          <div className="rotate-2 rounded-xl bg-pink-100 p-4 shadow-card transition-transform duration-200 hover:rotate-0">
            <p className="flex items-center gap-1 text-[10px] font-medium text-pink-700">
              <TrendingUp className="size-3" /> Efficiency
            </p>
            <p className="mt-1 font-display text-sm font-bold text-foreground">Optimised Workflow</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    bg: 'bg-[#D9F2E2]',
    iconBg: 'bg-emerald-500',
    Icon: Wallet,
    title: 'Simplify Money Matters',
    text: 'Quotes, invoices, bills and payment tracking for every booking — completely paperless and hassle-free.',
    soon: true,
    inner: (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <p className="font-display text-lg font-bold leading-snug text-foreground sm:text-xl">
            Effortless Invoices.
            <br />
            Seamlessly Managed.
          </p>
          <Wallet className="size-9 shrink-0 text-emerald-500" />
        </div>
        <div className="mt-5 flex gap-2 text-xs font-medium">
          <span className="rounded-lg bg-white px-4 py-2 text-foreground shadow-card">Invoices</span>
          <span className="rounded-lg bg-emerald-50 px-4 py-2 text-muted-foreground">Reminders</span>
        </div>
      </div>
    ),
  },
];

function BentoSection() {
  return (
    <section id="why" className="bg-surface py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Why choose us"
          title="What makes us different"
          subtitle="Unrivaled simplicity, speed, and customer delight — built only for travel agencies."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {BENTOS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 2) * 0.1}>
              <div className={cn('flex h-full flex-col rounded-[2rem] p-7 sm:p-9', b.bg)}>
                <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-white', b.iconBg)}>
                  <b.Icon className="size-6" />
                </span>
                <div className="mt-6 flex items-center gap-3">
                  <h3 className="font-display text-2xl font-bold text-foreground sm:text-[1.7rem]">{b.title}</h3>
                  {b.soon && (
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                      Soon
                    </span>
                  )}
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-foreground/70">{b.text}</p>
                <div className="mt-7 flex-1">{b.inner}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------- “Experience the difference” tab pillars ---------------- */

interface Pillar {
  key: string;
  label: string;
  Icon: typeof Zap;
  iconColor: string;
  tabActive: string;
  cardBg: string;
  title: string;
  text: string;
  soon?: boolean;
  statLabel: string;
  statValue: string;
  statAccent: string;
  chip: string;
  chipBg: string;
}

const PILLARS: Pillar[] = [
  {
    key: 'leads',
    label: 'Leads',
    Icon: Contact2,
    iconColor: 'text-pink-500',
    tabActive: 'border-pink-300 bg-pink-50',
    cardBg: 'bg-[#FADEE5]',
    title: 'Leads',
    text: 'Every enquiry — WhatsApp, Instagram, website or walk-in — lands in one colored pipeline with hot/warm flags, quick filters, and bulk actions.',
    statLabel: 'Pipeline value',
    statValue: '₹4.2L',
    statAccent: 'bg-pink-500',
    chip: 'Lead Management',
    chipBg: 'bg-pink-100 text-pink-700',
  },
  {
    key: 'bookings',
    label: 'Bookings',
    Icon: CalendarCheck2,
    iconColor: 'text-amber-500',
    tabActive: 'border-amber-300 bg-amber-50',
    cardBg: 'bg-[#FCEFD3]',
    title: 'Bookings',
    text: 'Turn a won lead into a booking in one click — itineraries, departure calendar, invoices and bills, all connected to the same customer.',
    soon: true,
    statLabel: 'Departures this month',
    statValue: '18',
    statAccent: 'bg-amber-400',
    chip: 'Itinerary Builder',
    chipBg: 'bg-amber-100 text-amber-700',
  },
  {
    key: 'inbox',
    label: 'Communication',
    Icon: MessageCircle,
    iconColor: 'text-emerald-500',
    tabActive: 'border-emerald-300 bg-emerald-50',
    cardBg: 'bg-[#D9F2E2]',
    title: 'Communication',
    text: 'Chat on WhatsApp and Instagram from inside the CRM, with every message attached to the right lead — no more digging through personal phones.',
    soon: true,
    statLabel: 'Avg. first reply',
    statValue: '4 min',
    statAccent: 'bg-emerald-500',
    chip: 'Unified Inbox',
    chipBg: 'bg-emerald-100 text-emerald-700',
  },
  {
    key: 'ai',
    label: 'Automation',
    Icon: Sparkles,
    iconColor: 'text-sky-500',
    tabActive: 'border-sky-300 bg-sky-50',
    cardBg: 'bg-[#DCEBFB]',
    title: 'Automation & AI',
    text: 'Auto follow-ups when a lead goes quiet, bot flows that capture enquiries while you sleep, and AI-drafted replies in your agency’s tone.',
    soon: true,
    statLabel: 'Follow-ups automated',
    statValue: '132',
    statAccent: 'bg-sky-500',
    chip: 'AI Assistant',
    chipBg: 'bg-sky-100 text-sky-700',
  },
];

function PillarShowcase() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const p = PILLARS[active];

  return (
    <section id="features" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Built for travel agents"
          title="Experience the Difference"
          subtitle="A smart, all-in-one platform built with travel agencies to connect, manage, and grow the business effortlessly."
        />

        {/* Tabs */}
        <Reveal className="mt-12">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PILLARS.map((tab, i) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={i === active}
                className={cn(
                  'flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-4 text-sm font-semibold text-foreground shadow-card transition-all duration-200',
                  i === active ? cn(p.tabActive, 'scale-[1.02]') : 'border-border hover:-translate-y-0.5 hover:shadow-soft',
                )}
              >
                <tab.Icon className={cn('size-6', tab.iconColor)} />
                {tab.label}
              </button>
            ))}
          </div>
        </Reveal>

        {/* Showcase card */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={p.key}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: EASE }}
              className={cn('grid gap-10 rounded-[2rem] p-8 sm:p-12 lg:grid-cols-2 lg:items-center', p.cardBg)}
            >
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-3xl font-bold text-foreground sm:text-4xl">{p.title}</h3>
                  {p.soon && (
                    <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground/70">
                      Coming soon
                    </span>
                  )}
                </div>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-foreground/75">{p.text}</p>
                <Button asChild size="lg" className="mt-8 bg-foreground text-background hover:bg-foreground/85">
                  <Link to="/signup">
                    {p.soon ? 'Join early access' : 'Try it now'} <ArrowRight />
                  </Link>
                </Button>
              </div>

              {/* CSS illustration: overlapping mini cards + floating icon dots */}
              <div className="relative mx-auto w-full max-w-sm py-6">
                <div className="absolute -top-2 left-6 flex gap-3">
                  {[Contact2, MessageCircle, CalendarCheck2].map((I, idx) => (
                    <span
                      key={idx}
                      className={cn(
                        'flex size-10 items-center justify-center rounded-full bg-white shadow-soft',
                        idx === 1 && 'animate-float',
                      )}
                    >
                      <I className={cn('size-4', p.iconColor)} />
                    </span>
                  ))}
                </div>
                <div className="mt-10 rounded-2xl bg-white p-5 shadow-pop">
                  <p className="text-xs text-muted-foreground">{p.statLabel}</p>
                  <p className="font-display text-3xl font-bold text-foreground">{p.statValue}</p>
                  <div className="mt-3 flex h-14 items-end gap-1.5">
                    {[35, 55, 40, 70, 50, 90, 65].map((h, idx) => (
                      <span
                        key={idx}
                        style={{ height: `${h}%` }}
                        className={cn('flex-1 rounded-sm', idx === 5 ? p.statAccent : 'bg-muted')}
                      />
                    ))}
                  </div>
                  <p className="mt-3 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    Weekly overview <TrendingUp className="size-3" />
                  </p>
                </div>
                <div className="animate-float-delayed absolute -right-2 top-16 rounded-xl bg-white px-4 py-2.5 shadow-pop">
                  <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', p.chipBg)}>{p.chip}</span>
                </div>
                <div className="absolute -bottom-1 right-8 rounded-xl bg-white p-3.5 shadow-pop">
                  <p className="text-[10px] text-muted-foreground">Conversion</p>
                  <p className="font-display text-lg font-bold text-foreground">32%</p>
                  <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full w-1/3 rounded-full', p.statAccent)} />
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* -------------------------- Violet ecosystem band --------------------------- */

const CHECKLIST: { label: string; soon?: boolean }[] = [
  { label: 'Colored pipeline with hot & warm flags' },
  { label: 'Team assignments, roles & remarks' },
  { label: 'Your brand across the whole workspace' },
  { label: 'Database-level isolation for your data' },
  { label: 'WhatsApp & Instagram lead capture', soon: true },
  { label: 'Automatic follow-up reminders', soon: true },
];

const FLOATING_UPDATES = [
  { Icon: MessageCircle, label: 'New WhatsApp lead', bg: 'bg-pink-100', color: 'text-pink-600', rotate: '-rotate-2' },
  { Icon: BellRing, label: 'Follow-up due · Tom', bg: 'bg-violet-100', color: 'text-violet-600', rotate: 'rotate-1' },
  { Icon: CalendarCheck2, label: 'Itinerary sent', bg: 'bg-emerald-100', color: 'text-emerald-600', rotate: '-rotate-1' },
  { Icon: Wallet, label: 'Payment received', bg: 'bg-amber-100', color: 'text-amber-600', rotate: 'rotate-2' },
];

function EcosystemSection() {
  return (
    <section className="bg-primary py-24 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          light
          eyebrow="All-in-One Ecosystem"
          title="Trusted by Agencies, Loved by Travellers"
          subtitle="Seamless communication, streamlined operations, and a thriving travel business."
        />

        {/* Row A: updates card + copy */}
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-[2rem] bg-[#FBE9EE] p-7 sm:p-9">
              <p className="text-center font-medium italic text-foreground/60">
                all important updates at one place ↓
              </p>
              <div className="mx-auto mt-6 max-w-xs space-y-4">
                {FLOATING_UPDATES.map((u) => (
                  <div
                    key={u.label}
                    className={cn('flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft transition-transform duration-200 hover:rotate-0 hover:scale-[1.02]', u.rotate)}
                  >
                    <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', u.bg, u.color)}>
                      <u.Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{u.label}</p>
                      <div className="mt-1.5 flex gap-2">
                        <span className="h-1.5 w-16 rounded-full bg-muted" />
                        <span className="h-1.5 w-8 rounded-full bg-muted" />
                      </div>
                    </div>
                    <span className="text-muted-foreground">×</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h3 className="font-display text-3xl font-bold sm:text-4xl">Unified Customer Communication</h3>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
              It's not just one-way updates. Enquiries, follow-ups, itineraries, and payments — every
              interaction with a traveller lives on their lead, visible to your whole team. Happy
              agents. Happy travellers.
            </p>
            <p className="mt-4 text-sm font-medium text-amber-300">
              WhatsApp & Instagram inboxes arrive in the next release — your pipeline is ready for
              them today.
            </p>
          </Reveal>
        </div>

        {/* Row B: checklist + secured card */}
        <div className="mt-20 grid items-center gap-10 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <h3 className="font-display text-3xl font-bold sm:text-4xl">Boost Your Conversions</h3>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
              Forget lost enquiries, forgotten follow-ups, and spreadsheets nobody updates. Everything
              your team needs to close trips, in one place.
            </p>
            <ul className="mt-7 space-y-4">
              {CHECKLIST.map((item) => (
                <li key={item.label} className="flex items-center gap-3 text-[15px] font-medium">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-primary">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {item.label}
                  {item.soon && (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Soon
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <div className="rounded-[2rem] bg-[#FCF3DC] p-7 sm:p-9">
              <p className="text-center font-medium italic text-foreground/60">your pipeline, secured ↓</p>
              <div className="relative mx-auto mt-6 max-w-xs">
                <div className="rounded-2xl bg-white p-5 shadow-pop">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                      <Plane className="size-4" />
                    </span>
                    <p className="font-display text-sm font-bold text-foreground">Wanderlust Travel Co.</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {['Priya · Bali · ₹2.5L', 'Tom · Swiss Alps · ₹4.1L', 'Nadia · Maldives · ₹5.3L'].map((row) => (
                      <div key={row} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2">
                        <span className="text-[11px] font-medium text-foreground">{row}</span>
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="animate-float absolute -right-4 -top-4 flex items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-pop">
                  <ShieldCheck className="size-4 text-emerald-600" />
                  <span className="text-[11px] font-bold text-foreground">Only your agency sees this</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- Core features ------------------------------ */

const CORE = [
  {
    Icon: UsersRound,
    iconBg: 'bg-violet-400',
    title: 'Built for Travel People',
    text: 'Voyage is designed around how agencies actually sell trips — enquiries, follow-ups, departures — not generic sales jargon.',
  },
  {
    Icon: Zap,
    iconBg: 'bg-cyan-400',
    title: 'Easy-to-Use',
    text: 'Anyone who can use Instagram & WhatsApp can use Voyage. Your team is productive on day one, no training needed.',
  },
  {
    Icon: ShieldCheck,
    iconBg: 'bg-amber-400',
    title: 'Your Brand + Your Data',
    text: 'Your logo and colors across the workspace, with your data isolated at the database level — no other agency can ever see it.',
  },
];

function CoreSection() {
  return (
    <section className="bg-surface py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="What makes us different"
          title="Core Features for Seamless Agency Management"
          subtitle="Experience seamless operations and enhanced productivity with a tool your team will actually use."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {CORE.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.1}>
              <div className="h-full rounded-[1.75rem] bg-card p-8 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-soft">
                <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-white', c.iconBg)}>
                  <c.Icon className="size-6" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-foreground">{c.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Testimonials ------------------------------ */

const QUOTES = [
  {
    quote:
      'We used to lose enquiries in three different WhatsApp accounts. Now every lead is on one board and nothing slips through.',
    role: 'Founder, Wanderlust Travel Co.',
    name: 'Aisha K.',
    avatarBg: 'bg-violet-500',
  },
  {
    quote:
      'What stood out was how effortlessly it brought the whole team onto a single platform. Voyage became our go-to hub for every customer interaction.',
    role: 'Director, Globe Hoppers',
    name: 'Diego A.',
    avatarBg: 'bg-teal-500',
  },
];

function QuotesSection() {
  return (
    <section id="stories" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Testimonials"
          title="Hear from Travel Agencies"
          subtitle="Here are some glowing reviews from our early-access agencies."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={i * 0.1}>
              <figure className="h-full rounded-[1.75rem] bg-card p-8 shadow-card">
                <blockquote className="text-lg leading-relaxed text-foreground">“{q.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className={cn('flex size-11 items-center justify-center rounded-full font-display text-sm font-bold text-white', q.avatarBg)}>
                    {q.name.slice(0, 1)}
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-foreground">{q.role}</span>
                    <span className="block text-sm text-muted-foreground">{q.name}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------- Page ----------------------------------- */

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <Nav />
      <main>
        <Hero />
        <BentoSection />
        <PillarShowcase />
        <EcosystemSection />
        <CoreSection />
        <QuotesSection />

        {/* Final CTA */}
        <section className="px-4 pb-24 sm:px-6">
          <Reveal>
            <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-primary px-6 py-16 text-center shadow-pop sm:px-12">
              <div className="animate-blob pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
              <div className="animate-blob-slow pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-violet-300/20 blur-2xl" />
              <div className="relative">
                <p className="text-base font-semibold text-amber-300">No learning curve, effortless & streamlined</p>
                <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
                  Stop losing leads to the group chat
                </h2>
                <p className="mx-auto mt-4 max-w-md text-sm text-white/75 sm:text-base">
                  Create your agency's workspace now — free while we're in early access.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button asChild size="lg" className="w-full bg-white text-primary hover:bg-white/90 sm:w-auto">
                    <Link to="/signup">
                      Get started free <ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 sm:w-auto"
                  >
                    <Link to="/login">Access Voyage</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:px-6 sm:text-left">
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8 rounded-lg" />
            <div>
              <p className="font-display text-sm font-bold text-foreground">Voyage CRM</p>
              <p className="text-xs text-muted-foreground">The all-in-one CRM for travel agencies.</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link to="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link to="/signup" className="transition-colors hover:text-foreground">
              Create account
            </Link>
            <a href="#features" className="transition-colors hover:text-foreground">
              Features
            </a>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Voyage CRM</p>
        </div>
      </footer>
    </div>
  );
}
