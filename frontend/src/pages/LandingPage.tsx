import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  Check,
  ChevronDown,
  Contact2,
  Footprints,
  Globe,
  Instagram,
  LayoutGrid,
  Mail,
  MessageCircle,
  Plane,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  UsersRound,
  Wallet,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { cn } from '@/lib/utils';

/* ------------------------------ Motion helpers ----------------------------- */

const EASE = [0.22, 1, 0.36, 1] as const;
const VIEWPORT = { once: true, margin: '-60px' } as const;

/** Rise + fade on scroll (headings, generic blocks). */
function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.6, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Slide in from the left or right with a tiny rotation settle (bento cards). */
function RevealX({
  children,
  from,
  delay = 0,
  className,
}: {
  children: ReactNode;
  from: 'left' | 'right';
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const x = from === 'left' ? -48 : 48;
  const rotate = from === 'left' ? -1.5 : 1.5;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, x, rotate }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, x: 0, rotate: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** 3D flip-up on scroll (core feature cards). */
function FlipIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, rotateX: -35, y: 32 }}
      whileInView={reduce ? { opacity: 1 } : { opacity: 1, rotateX: 0, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.7, delay, ease: EASE }}
      style={{ transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Mouse-follow 3D tilt wrapper (hero product mock). */
function Tilt({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 140, damping: 18 });
  const sry = useSpring(ry, { stiffness: 140, damping: 18 });
  if (reduce) return <>{children}</>;
  return (
    <motion.div
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 1100 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * 6);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/** Ether-style section heading: eyebrow → huge headline → gray subtext. */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
  light = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <Reveal className="mx-auto max-w-3xl text-center">
      <p className={cn('text-base font-semibold', light ? 'text-amber-300' : 'text-primary')}>{eyebrow}</p>
      <h2 className={cn('mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl', light ? 'text-white' : 'text-foreground')}>
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
    <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm', className)}>
      <Plane className="size-5" />
    </span>
  );
}

function Nav() {
  const { status } = useAuth();
  const authed = status === 'authenticated';
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.25rem] max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <LogoMark />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">Voyage</span>
        </Link>
        <nav className="hidden items-center gap-8 text-[15px] font-semibold text-foreground md:flex">
          <a href="#why" className="transition-colors hover:text-primary">
            About Us
          </a>
          <a href="#features" className="relative transition-colors hover:text-primary">
            Features
            <span className="absolute -right-6 -top-3 rounded-full bg-pink-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
              New
            </span>
          </a>
          <a href="#how" className="ml-3 transition-colors hover:text-primary">
            How it works
          </a>
          <a href="#faq" className="transition-colors hover:text-primary">
            FAQ
          </a>
        </nav>
        <div className="flex items-center gap-3">
          {authed ? (
            <Button asChild size="sm" className="h-11 rounded-xl bg-foreground px-5 text-background hover:bg-foreground/90">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="h-11 rounded-xl px-5 text-[15px] font-semibold">
                <Link to="/login">Login</Link>
              </Button>
              <Button asChild size="sm" className="h-11 rounded-xl bg-foreground px-5 text-[15px] font-semibold text-background hover:bg-foreground/90">
                <Link to="/signup">Get Started</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ----------------------------------- Hero ---------------------------------- */

function ProductMock() {
  const rows = [
    { name: 'Priya Menon', dest: 'Bali, Indonesia', status: 'New', dot: 'bg-blue-500', pill: 'bg-blue-50 text-blue-700' },
    { name: 'Tom Becker', dest: 'Swiss Alps', status: 'Proposal', dot: 'bg-amber-500', pill: 'bg-amber-50 text-amber-700' },
    { name: 'Nadia Hassan', dest: 'Maldives', status: 'Won', dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700' },
  ];
  const stages = ['bg-blue-500', 'bg-violet-500', 'bg-pink-500', 'bg-amber-500', 'bg-orange-500', 'bg-emerald-600'];
  return (
    <div className="relative mx-auto w-full">
      <div className="relative overflow-hidden rounded-[1.4rem] border border-border bg-card shadow-pop">
        {/* periodic shine sweep */}
        <span className="animate-sheen pointer-events-none absolute inset-y-0 z-10 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
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
              <div key={item} className={cn('rounded-md px-2 py-1.5 text-[10px] font-medium', i === 1 ? 'bg-primary/10 text-primary' : 'text-muted-foreground')}>
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

      {/* Floating cards + destination chips around the mock */}
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
      <div className="animate-float-delayed absolute -left-16 top-16 hidden -rotate-3 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 shadow-pop lg:flex">
        <span className="text-base">🌴</span>
        <span className="text-xs font-semibold text-foreground">Bali · ₹49,999</span>
      </div>
      <div className="animate-float absolute -right-14 bottom-16 hidden rotate-2 items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 shadow-pop lg:flex">
        <span className="text-base">🏔️</span>
        <span className="text-xs font-semibold text-foreground">Swiss Alps · ₹1.2L</span>
      </div>
    </div>
  );
}

/** Hand-drawn curved arrow for the hero annotations (Ether style). */
function CurvedArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 64" fill="none" className={className} aria-hidden>
      <path d="M8 6 C 24 36, 44 50, 74 46" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M62 56 L 76 46 L 66 31" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Hero() {
  const reduce = useReducedMotion();
  const { status } = useAuth();
  const authed = status === 'authenticated';

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.25, delay } }
      : { initial: { opacity: 0, y: 22 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.65, delay, ease: EASE } };

  const blurIn = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay } }
      : {
          initial: { opacity: 0, y: 24, filter: 'blur(10px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          transition: { delay, duration: 0.65, ease: EASE },
        };

  return (
    <section className="relative overflow-hidden bg-[#5433EB] pb-20 text-white sm:pb-24">
      {/* subtle drifting glows on the flat violet */}
      <div className="animate-blob pointer-events-none absolute -left-24 top-24 h-96 w-96 rounded-full bg-white/[0.07] blur-3xl" />
      <div className="animate-blob-slow pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-fuchsia-300/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-4 pt-14 text-center sm:px-6 sm:pt-20">
        {/* Yellow rating pill with avatar stack + green stars */}
        <motion.div {...rise(0)} className="mb-9 flex justify-center">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-amber-300 py-1.5 pl-2 pr-4 text-sm font-bold text-[#1A2340] shadow-pop">
            <span className="flex -space-x-2" aria-hidden>
              {[
                ['A', 'bg-violet-500'],
                ['S', 'bg-pink-500'],
                ['M', 'bg-teal-500'],
              ].map(([letter, color]) => (
                <span
                  key={letter}
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-amber-300',
                    color,
                  )}
                >
                  {letter}
                </span>
              ))}
            </span>
            Rated 4.8
            <span className="flex text-emerald-700" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-current" strokeWidth={0} />
              ))}
            </span>
            <span className="hidden font-semibold sm:inline">by 40+ agencies</span>
          </span>
        </motion.div>

        {/* Ether-style two-line headline: yellow + white */}
        <h1 className="font-display font-bold leading-[1.06] tracking-tight">
          <motion.span {...blurIn(0.15)} className="block text-5xl text-amber-300 sm:text-7xl">
            All-in-one
          </motion.span>
          <motion.span {...blurIn(0.32)} className="mx-auto mt-2 block max-w-4xl text-4xl text-white sm:text-6xl">
            Operating System for Travel Agencies
          </motion.span>
        </h1>

        <motion.p {...rise(0.5)} className="mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg">
          Everything your agency needs to capture, operate, and grow — without switching between
          multiple tools and apps.
        </motion.p>

        {/* Black + white button pair */}
        <motion.div {...rise(0.62)} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="w-full rounded-xl bg-[#14162B] px-7 text-white shadow-pop transition-transform hover:scale-[1.02] hover:bg-[#14162B]/90 sm:w-auto"
          >
            <Link to="/signup">Book a Free Demo</Link>
          </Button>
          <Button
            asChild
            size="lg"
            className="w-full rounded-xl bg-white px-7 text-foreground hover:bg-white/90 sm:w-auto"
          >
            <Link to={authed ? '/dashboard' : '/login'}>Access Voyage</Link>
          </Button>
        </motion.div>

        {/* Framed dashboard screenshot with handwritten annotations */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 60, scale: 0.95 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.75, ease: EASE }}
          className="relative mx-auto mt-20 max-w-4xl"
        >
          {/* “No Learning Curve” — left annotation */}
          <div className="absolute -top-16 left-0 hidden -translate-x-2/3 lg:block">
            <p className="-rotate-6 font-hand text-3xl font-bold leading-none text-white">
              No Learning
              <br />
              Curve
            </p>
            <CurvedArrow className="ml-14 mt-1 w-14 text-white/90" />
          </div>
          {/* “Effortless & Streamlined” — right annotation */}
          <div className="absolute -top-16 right-0 hidden translate-x-2/3 text-right lg:block">
            <CurvedArrow className="mb-1 ml-auto mr-14 w-14 -scale-x-100 text-white/90" />
            <p className="rotate-3 font-hand text-3xl font-bold leading-none text-white">
              Effortless &
              <br />
              Streamlined
            </p>
          </div>

          <Tilt>
            <div className="rounded-[2rem] bg-white/20 p-2 shadow-2xl ring-1 ring-white/30 sm:p-3">
              <ProductMock />
            </div>
          </Tilt>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------------------- NEW · channel marquee strip ------------------------- */

const CHANNELS: { Icon: typeof Zap; label: string; cls: string }[] = [
  { Icon: MessageCircle, label: 'WhatsApp', cls: 'bg-green-50 text-green-700' },
  { Icon: Instagram, label: 'Instagram', cls: 'bg-pink-50 text-pink-600' },
  { Icon: ThumbsUp, label: 'Facebook', cls: 'bg-blue-50 text-blue-600' },
  { Icon: Globe, label: 'Website', cls: 'bg-indigo-50 text-indigo-600' },
  { Icon: Mail, label: 'Email', cls: 'bg-amber-50 text-amber-600' },
  { Icon: Smartphone, label: 'SMS', cls: 'bg-violet-50 text-violet-600' },
  { Icon: Sparkles, label: 'Gemini AI', cls: 'bg-fuchsia-50 text-fuchsia-600' },
  { Icon: UsersRound, label: 'Referrals', cls: 'bg-teal-50 text-teal-600' },
  { Icon: Footprints, label: 'Walk-ins', cls: 'bg-slate-100 text-slate-600' },
];

function ChannelMarquee() {
  return (
    <section className="border-y border-border bg-card py-8">
      <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        One pipeline for enquiries from every channel
      </p>
      <div className="relative mt-5 overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-card to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-card to-transparent" />
        <div className="animate-marquee flex w-max gap-4">
          {[...CHANNELS, ...CHANNELS].map((c, i) => (
            <span key={i} className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold', c.cls)}>
              <c.Icon className="size-4" />
              {c.label}
            </span>
          ))}
        </div>
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
    inner: <InnerTagline line1="More Follow-ups." line2="More Bookings." icon={<TrendingUp className="size-10 text-cyan-500" />} />,
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
            <RevealX key={b.title} from={i % 2 === 0 ? 'left' : 'right'} delay={(i % 2) * 0.08}>
              <div className={cn('flex h-full flex-col rounded-[2rem] p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-9', b.bg)}>
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
            </RevealX>
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

        {/* Tabs pop in with a spring stagger */}
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PILLARS.map((tab, i) => (
            <motion.button
              key={tab.key}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={i === active}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.82, y: 16 }}
              whileInView={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ type: 'spring', stiffness: 240, damping: 18, delay: i * 0.08 }}
              className={cn(
                'flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-4 text-sm font-semibold text-foreground shadow-card transition-all duration-200',
                i === active ? cn(p.tabActive, 'scale-[1.02]') : 'border-border hover:-translate-y-0.5 hover:shadow-soft',
              )}
            >
              <tab.Icon className={cn('size-6', tab.iconColor)} />
              {tab.label}
            </motion.button>
          ))}
        </div>

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

              <div className="relative mx-auto w-full max-w-sm py-6">
                <div className="absolute -top-2 left-6 flex gap-3">
                  {[Contact2, MessageCircle, CalendarCheck2].map((I, idx) => (
                    <span key={idx} className={cn('flex size-10 items-center justify-center rounded-full bg-white shadow-soft', idx === 1 && 'animate-float')}>
                      <I className={cn('size-4', p.iconColor)} />
                    </span>
                  ))}
                </div>
                <div className="mt-10 rounded-2xl bg-white p-5 shadow-pop">
                  <p className="text-xs text-muted-foreground">{p.statLabel}</p>
                  <p className="font-display text-3xl font-bold text-foreground">{p.statValue}</p>
                  <div className="mt-3 flex h-14 items-end gap-1.5">
                    {[35, 55, 40, 70, 50, 90, 65].map((h, idx) => (
                      <motion.span
                        key={idx}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: 0.15 + idx * 0.05, duration: 0.4, ease: EASE }}
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

/* ----------------------- NEW · animated stats band -------------------------- */

const STATS = [
  { to: 2430, suffix: '+', label: 'Enquiries captured' },
  { to: 480, suffix: '+', label: 'Trips booked' },
  { to: 4.8, decimals: 1, label: 'Average rating' },
  { to: 4, suffix: ' min', label: 'Avg. first reply' },
];

function StatsBand() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal>
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-primary to-violet-600 px-6 py-12 shadow-pop sm:px-12">
          <div className="animate-blob pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid grid-cols-2 gap-8 text-center md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <p className="font-display text-4xl font-bold text-white sm:text-5xl">
                  <CountUp to={s.to} suffix={s.suffix ?? ''} decimals={s.decimals ?? 0} />
                </p>
                <p className="mt-2 text-sm text-white/70">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
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
  { Icon: MessageCircle, label: 'New WhatsApp lead', bg: 'bg-pink-100', color: 'text-pink-600', rotate: -2 },
  { Icon: BellRing, label: 'Follow-up due · Tom', bg: 'bg-violet-100', color: 'text-violet-600', rotate: 1 },
  { Icon: CalendarCheck2, label: 'Itinerary sent', bg: 'bg-emerald-100', color: 'text-emerald-600', rotate: -1 },
  { Icon: Wallet, label: 'Payment received', bg: 'bg-amber-100', color: 'text-amber-600', rotate: 2 },
];

function EcosystemSection() {
  const reduce = useReducedMotion();
  return (
    <section className="bg-primary py-24 text-white">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          light
          eyebrow="All-in-One Ecosystem"
          title="Trusted by Agencies, Loved by Travellers"
          subtitle="Seamless communication, streamlined operations, and a thriving travel business."
        />

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          <RevealX from="left">
            <div className="rounded-[2rem] bg-[#FBE9EE] p-7 sm:p-9">
              <p className="text-center font-medium italic text-foreground/60">all important updates at one place ↓</p>
              <div className="mx-auto mt-6 max-w-xs space-y-4">
                {FLOATING_UPDATES.map((u, i) => (
                  <motion.div
                    key={u.label}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 28, rotate: u.rotate * 3 }}
                    whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0, rotate: u.rotate }}
                    viewport={VIEWPORT}
                    transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.15 + i * 0.13 }}
                    className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-soft transition-transform duration-200 hover:rotate-0 hover:scale-[1.02]"
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
                  </motion.div>
                ))}
              </div>
            </div>
          </RevealX>
          <RevealX from="right" delay={0.1}>
            <h3 className="font-display text-3xl font-bold sm:text-4xl">Unified Customer Communication</h3>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
              It's not just one-way updates. Enquiries, follow-ups, itineraries, and payments — every
              interaction with a traveller lives on their lead, visible to your whole team. Happy
              agents. Happy travellers.
            </p>
            <p className="mt-4 text-sm font-medium text-amber-300">
              WhatsApp & Instagram inboxes arrive in the next release — your pipeline is ready for them today.
            </p>
          </RevealX>
        </div>

        <div className="mt-20 grid items-center gap-10 lg:grid-cols-2">
          <RevealX from="left" className="order-2 lg:order-1">
            <h3 className="font-display text-3xl font-bold sm:text-4xl">Boost Your Conversions</h3>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-white/75">
              Forget lost enquiries, forgotten follow-ups, and spreadsheets nobody updates. Everything
              your team needs to close trips, in one place.
            </p>
            <ul className="mt-7 space-y-4">
              {CHECKLIST.map((item, i) => (
                <motion.li
                  key={item.label}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: -18 }}
                  whileInView={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
                  viewport={VIEWPORT}
                  transition={{ duration: 0.4, delay: 0.1 + i * 0.09, ease: EASE }}
                  className="flex items-center gap-3 text-[15px] font-medium"
                >
                  <motion.span
                    initial={reduce ? undefined : { scale: 0 }}
                    whileInView={reduce ? undefined : { scale: 1 }}
                    viewport={VIEWPORT}
                    transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 0.18 + i * 0.09 }}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-primary"
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </motion.span>
                  {item.label}
                  {item.soon && (
                    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                      Soon
                    </span>
                  )}
                </motion.li>
              ))}
            </ul>
          </RevealX>
          <RevealX from="right" delay={0.1} className="order-1 lg:order-2">
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
          </RevealX>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ NEW · how it works timeline ----------------------- */

const STEPS = [
  { n: 1, title: 'Create your agency', text: 'Sign up free — your branded, isolated workspace is ready in under two minutes.' },
  { n: 2, title: 'Bring in your team', text: 'Invite agents with a link. Everyone works the same pipeline with the right permissions.' },
  { n: 3, title: 'Close more trips', text: 'Capture enquiries, move them through stages, and never let a follow-up slip again.' },
];

function HowItWorks() {
  const reduce = useReducedMotion();
  return (
    <section id="how" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Getting started" title="Up and Running in Minutes" subtitle="Three steps between you and a pipeline your whole team loves." />
        <div className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
          {/* dashed connector */}
          <div className="absolute left-[18%] right-[18%] top-8 hidden border-t-2 border-dashed border-primary/25 md:block" />
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 32 }}
              whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.55, delay: i * 0.18, ease: EASE }}
              className="relative text-center"
            >
              <motion.span
                initial={reduce ? undefined : { scale: 0 }}
                whileInView={reduce ? undefined : { scale: 1 }}
                viewport={VIEWPORT}
                transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.1 + i * 0.18 }}
                className="relative z-10 mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-500 font-display text-2xl font-bold text-white shadow-pop"
              >
                {s.n}
              </motion.span>
              <h3 className="mt-5 font-display text-xl font-bold text-foreground">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </motion.div>
          ))}
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
            <FlipIn key={c.title} delay={i * 0.12}>
              <div className="h-full rounded-[1.75rem] bg-card p-8 shadow-card transition-all duration-200 hover:-translate-y-1 hover:shadow-soft">
                <span className={cn('flex h-14 w-14 items-center justify-center rounded-2xl text-white', c.iconBg)}>
                  <c.Icon className="size-6" />
                </span>
                <h3 className="mt-6 font-display text-xl font-bold text-foreground">{c.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{c.text}</p>
              </div>
            </FlipIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Testimonials ------------------------------ */

const QUOTES = [
  {
    quote: 'We used to lose enquiries in three different WhatsApp accounts. Now every lead is on one board and nothing slips through.',
    role: 'Founder, Wanderlust Travel Co.',
    name: 'Aisha K.',
    avatarBg: 'bg-violet-500',
  },
  {
    quote: 'What stood out was how effortlessly it brought the whole team onto a single platform. Voyage became our go-to hub for every customer interaction.',
    role: 'Director, Globe Hoppers',
    name: 'Diego A.',
    avatarBg: 'bg-teal-500',
  },
];

function QuotesSection() {
  const reduce = useReducedMotion();
  return (
    <section id="stories" className="py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading eyebrow="Testimonials" title="Hear from Travel Agencies" subtitle="Here are some glowing reviews from our early-access agencies." />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {QUOTES.map((q, i) => (
            <motion.figure
              key={q.name}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.93 }}
              whileInView={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.55, delay: i * 0.12, ease: EASE }}
              className="h-full rounded-[1.75rem] bg-card p-8 shadow-card"
            >
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
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------- NEW · FAQ ---------------------------------- */

const FAQS = [
  {
    q: 'How long does it take to set up?',
    a: 'Under two minutes. Sign up, name your agency, and your branded workspace is live — invite your team whenever you like.',
  },
  {
    q: 'Can my whole team use it?',
    a: 'Yes. Invite as many agents as you need with a link. Admins manage the agency and team; agents work the pipeline. Everyone sees the same, always-up-to-date board.',
  },
  {
    q: "Is my agency's data private?",
    a: 'Completely. Every agency lives in its own isolated workspace, enforced at the database level with row-level security — not just in the app. One agency can never see another\'s data.',
  },
  {
    q: 'When do WhatsApp & Instagram inboxes arrive?',
    a: "They're rolling out in upcoming releases, along with bookings, invoices and AI follow-ups. Your pipeline is ready for them today — leads you add now connect to those tools automatically.",
  },
  {
    q: 'What does it cost?',
    a: "It's free while we're in early access. Early agencies lock in preferential pricing when paid plans launch.",
  },
];

function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-surface py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow="FAQ" title="Questions, Answered" subtitle="Everything agencies usually ask before getting started." />
        <div className="mt-12 space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={f.q} delay={i * 0.06}>
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
                  >
                    <span className="font-display text-base font-semibold text-foreground sm:text-lg">{f.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.25 }} className="shrink-0 text-muted-foreground">
                      <ChevronDown className="size-5" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground sm:px-6">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
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
        <ChannelMarquee />
        <BentoSection />
        <PillarShowcase />
        <StatsBand />
        <EcosystemSection />
        <HowItWorks />
        <CoreSection />
        <QuotesSection />
        <FaqSection />

        {/* Final CTA — yellow card sitting half on white, half on the dark footer (Ether style) */}
        <section className="relative px-4 pt-24 sm:px-6">
          <div className="absolute inset-x-0 bottom-0 h-44 bg-[#141414]" />
          <Reveal className="relative">
            <div className="relative mx-auto grid max-w-6xl items-center gap-12 rounded-[2.5rem] bg-[#F6D960] p-8 sm:p-14 lg:grid-cols-2">
              <div>
                <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-[#141414] sm:text-5xl">
                  Transform Your Agency's Management Today!
                </h2>
                <p className="mt-5 max-w-md text-lg text-[#141414]/70">
                  Capture more enquiries, streamline your team, and simplify follow-ups — experience
                  the difference today.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="mt-8 rounded-xl bg-[#141414] px-7 text-white hover:bg-[#141414]/85"
                >
                  <Link to="/signup">Get Started Today</Link>
                </Button>
              </div>

              {/* Illustration cluster */}
              <div className="relative mx-auto w-full max-w-md pb-24 sm:pb-28">
                <div className="rounded-2xl bg-white p-6 shadow-soft">
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-display text-lg font-bold text-[#141414] sm:text-xl">
                      More Enquiries. More Bookings.
                    </p>
                    <TrendingUp className="size-7 shrink-0 text-emerald-500" />
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-sky-100 p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#141414]/60">
                        <MessageCircle className="size-3.5" /> Enquiry
                      </p>
                      <p className="mt-1.5 font-display text-base font-bold text-[#141414]">Higher Volume</p>
                    </div>
                    <div className="rounded-xl bg-sky-100 p-4">
                      <p className="flex items-center gap-1.5 text-[11px] font-medium text-[#141414]/60">
                        <CalendarCheck2 className="size-3.5" /> Closure
                      </p>
                      <p className="mt-1.5 font-display text-base font-bold text-[#141414]">Better Conversion</p>
                    </div>
                  </div>
                </div>

                {/* Overlapping progress card */}
                <div className="absolute -bottom-2 right-0 w-[min(17rem,85%)] rounded-2xl bg-white p-5 shadow-pop">
                  <p className="text-sm font-bold text-[#141414]">Empowering owners, agents and travellers</p>
                  <div className="mt-2.5 flex -space-x-1.5">
                    {[
                      ['A', 'bg-violet-500'],
                      ['S', 'bg-pink-500'],
                      ['M', 'bg-teal-500'],
                    ].map(([letter, color]) => (
                      <span
                        key={letter}
                        className={cn(
                          'flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white',
                          color,
                        )}
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-[#141414]/60">Transformation in progress</p>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#141414]/10">
                    <span className="block h-full w-2/3 rounded-full bg-[#141414]" />
                  </div>
                </div>

                {/* Handwritten annotation */}
                <div className="absolute -bottom-4 left-0 hidden items-center gap-1 sm:flex">
                  <p className="-rotate-6 font-hand text-2xl font-bold leading-none text-[#141414]">
                    Seamless
                    <br />
                    Setup
                  </p>
                  <CurvedArrow className="mt-2 w-10 -rotate-45 text-[#141414]" />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* Dark multi-column footer (Ether style) */}
      <footer className="bg-[#141414] pt-20 text-white">
        <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <LogoMark className="h-9 w-9" />
                <span className="font-display text-2xl font-bold tracking-tight">Voyage</span>
              </div>
              <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/60">
                Discover Voyage, the leading travel-agency CRM to capture enquiries, boost bookings,
                manage your team effectively, and automate follow-ups. Try it today!
              </p>
            </div>

            <div>
              <p className="font-display text-lg font-bold">Quick Links</p>
              <ul className="mt-4 space-y-3 text-[15px] text-white/60">
                <li><Link to="/" className="transition-colors hover:text-white">Home</Link></li>
                <li><a href="#why" className="transition-colors hover:text-white">Why Voyage</a></li>
                <li><a href="#features" className="transition-colors hover:text-white">Features</a></li>
              </ul>
            </div>

            <div>
              <p className="font-display text-lg font-bold">Company</p>
              <ul className="mt-4 space-y-3 text-[15px] text-white/60">
                <li><a href="#how" className="transition-colors hover:text-white">How it works</a></li>
                <li><a href="#stories" className="transition-colors hover:text-white">Testimonials</a></li>
                <li><a href="#faq" className="transition-colors hover:text-white">FAQ</a></li>
              </ul>
            </div>

            <div>
              <p className="font-display text-lg font-bold">Legal</p>
              <ul className="mt-4 space-y-3 text-[15px] text-white/60">
                <li><a href="#" className="transition-colors hover:text-white">Terms &amp; Conditions</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="transition-colors hover:text-white">Refund &amp; Cancellation</a></li>
              </ul>
            </div>

            <div>
              <p className="max-w-[200px] font-display text-lg font-bold leading-snug">
                Ready to simplify agency operations? Start here.
              </p>
              <Button asChild size="lg" className="mt-5 rounded-xl px-7">
                <Link to="/signup">Get Started</Link>
              </Button>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-white/50 sm:flex-row">
            <p>© {new Date().getFullYear()} Voyage CRM. All rights reserved.</p>
            <p>Made for travel agencies ✈️</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
