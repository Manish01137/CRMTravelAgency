import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Instagram, Mail, Phone, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PackageItineraryDay, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

/**
 * SIGNATURE — the single, fixed package brochure template.
 *
 * There is exactly ONE design for every package; agencies cannot pick fonts,
 * colours or layout — they only supply the content, which already lives on the
 * package. This file is presentation-only: it RENDERS existing package /
 * itinerary / day data into an A4-portrait, print-to-PDF document (same
 * window.print pipeline used by invoices & itineraries). It adds no data fields.
 *
 * Missing data is always omitted gracefully — never shown blank or as a
 * placeholder image.
 */

interface BrochureOrg {
  name: string;
  logoUrl: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  instagramUrl: string | null;
}
interface PublicBrochure {
  package: TravelPackage;
  organization: BrochureOrg | null;
}

// --- Fixed design tokens (not agency-editable) -------------------------------
const INK = '#0d0d0d'; // near-black — dark narrative boxes & frame border
const PAPER = '#ffffff'; // content-page background
const NAVY = '#1c2b52'; // deep navy — eyebrows/markers on light pages
const ACCENT = '#dd9a45'; // warm amber — bullet squares, FAQ bars, cover/closing eyebrow, footer icons
const SCRIPT = "'Alex Brush', cursive"; // flowing script eyebrow labels
const HEAD = "'Poppins', sans-serif"; // bold condensed-ish sans headings

// --- Small text helpers ------------------------------------------------------
/** Split a textarea field into trimmed, non-empty lines (bullet lists). */
const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** Split free text into paragraphs (blank-line separated, else per line). */
const paragraphs = (s: string | null | undefined): string[] => {
  const text = (s ?? '').trim();
  if (!text) return [];
  const byBlank = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return byBlank.length > 1 ? byBlank : lines(text);
};

/** The day's cover photo: explicit day image, else first activity-block image. */
const dayCover = (d: PackageItineraryDay): string | undefined =>
  d.images?.[0] ?? d.activityBlocks?.find((b) => b.imageUrl)?.imageUrl ?? undefined;

/** The day's narrative. Uses the day description; falls back to activity blocks
 *  (the newer builder flow stores day content there) so the page is never empty. */
const dayNarrative = (d: PackageItineraryDay): string[] => {
  if (d.description && d.description.trim()) return paragraphs(d.description);
  const blocks = d.activityBlocks ?? [];
  return blocks
    .map((b) => [b.name, b.description].filter(Boolean).join(' — '))
    .filter(Boolean);
};

/**
 * Per-day stat pills (Drive Distance / Time / Altitude).
 * NOTE: these are not fields on the current itinerary-day model, so this returns
 * [] for today's data and the pills are omitted. It reads them defensively so
 * the design is ready the day such data exists — without adding any field now.
 */
const dayStats = (d: PackageItineraryDay): { label: string; value: string }[] => {
  const raw = d as unknown as Record<string, unknown>;
  const out: { label: string; value: string }[] = [];
  const add = (label: string, ...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k];
      if (typeof v === 'string' && v.trim()) {
        out.push({ label, value: v.trim() });
        return;
      }
    }
  };
  add('Drive Distance', 'driveDistance', 'distance');
  add('Time', 'driveTime', 'time', 'duration');
  add('Altitude', 'altitude', 'elevation');
  return out;
};

// --- Reusable presentational pieces ------------------------------------------
/** One printed A4-portrait sheet. `clip` hides overflow (dark/full-bleed pages);
 *  content pages stay visible so long text flows onto a second printed page.
 *  `framed` adds the thin black page border; `footerBar` adds the bottom
 *  black-to-grey gradient accent strip — both used on the light content pages. */
function Sheet({
  children,
  className,
  clip,
  style,
  framed,
  footerBar,
}: {
  children: ReactNode;
  className?: string;
  clip?: boolean;
  style?: CSSProperties;
  framed?: boolean;
  footerBar?: boolean;
}) {
  return (
    <section
      style={{ ...(framed ? { border: `3px solid ${INK}` } : null), ...style }}
      className={cn(
        'brochure-page relative mx-auto mb-6 w-full max-w-[210mm] min-h-[297mm] shadow-card',
        'print:mb-0 print:max-w-none print:shadow-none',
        clip ? 'overflow-hidden rounded-xl print:rounded-none' : 'overflow-visible',
        className,
      )}
    >
      {children}
      {footerBar && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2.5"
          style={{ background: `linear-gradient(90deg, ${INK} 0%, #9ca3af 100%)` }}
        />
      )}
    </section>
  );
}

/** Flowing script "eyebrow" label above a heading. Colour depends on the page
 *  it sits on: navy on light pages, amber over full-bleed photos, white on the
 *  flat dark gradient (cancellation/terms) pages. */
function Eyebrow({ children, className, color = NAVY }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span className={cn('block text-3xl leading-none', className)} style={{ fontFamily: SCRIPT, color }}>
      {children}
    </span>
  );
}

/** Eyebrow (script) + bold heading, used consistently on every page. */
function PageHeading({
  eyebrow,
  title,
  align = 'left',
  eyebrowColor = NAVY,
  titleColor = INK,
}: {
  eyebrow: string;
  title: string;
  align?: 'left' | 'center';
  eyebrowColor?: string;
  titleColor?: string;
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
      <h2 className="mt-1 text-4xl font-black uppercase tracking-tight sm:text-5xl" style={{ fontFamily: HEAD, color: titleColor }}>
        {title}
      </h2>
    </div>
  );
}

/** A photo with a full arched (semicircle) top — cover strip & short itinerary. */
function ArchPhoto({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  return (
    <div style={style} className={cn('overflow-hidden rounded-t-[999px] rounded-b-2xl border-[3px] border-white', className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

/** A circular framed photo with a white ring (cancellation / terms pages). */
function CirclePhoto({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-full border-[5px] border-white/90 shadow-lg', className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

/** A scalloped (bite-edged) decorative border — inclusions page top & bottom. */
function Scallop() {
  return (
    <div
      aria-hidden
      className="h-4 w-full"
      style={{
        backgroundImage: `radial-gradient(circle at 10px 10px, ${PAPER} 9px, ${INK} 10px)`,
        backgroundSize: '20px 20px',
        backgroundRepeat: 'repeat-x',
        backgroundColor: INK,
      }}
    />
  );
}

export function PackageBrochurePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const pkgQuery = useQuery({
    queryKey: ['public-package', id],
    queryFn: () => api.get<PublicBrochure>(`/public/package/${id}`),
    enabled: !!id,
  });

  const pkg = pkgQuery.data?.package;
  const org = pkgQuery.data?.organization;

  if (pkgQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }
  if (!pkg) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-center">
        <p className="text-muted-foreground">Package not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/packages')}>
          <ArrowLeft /> Back
        </Button>
      </div>
    );
  }

  // --- Derived, presentation-only values -----------------------------------
  const orgName = org?.name ?? 'Travel Agency';
  const logoUrl = org?.logoUrl ?? null;
  const instagramUrl = org?.instagramUrl ?? null;
  const title = pkg.bookingTitle || pkg.name;
  const duration = `${pkg.nights}N/${pkg.days}D`;
  const price = formatCurrency(pkg.priceAmount, pkg.priceCurrency);
  const phone = pkg.contactNumber?.trim() || null;
  const email = pkg.contactEmail?.trim() || null;

  const gallery = (pkg.galleryImages ?? []).filter(Boolean);
  // Photo pool for decorative frames (banner first, then gallery), de-duped.
  const photoPool = [pkg.bannerImageUrl, ...gallery].filter((u): u is string => !!u);
  const uniquePool = Array.from(new Set(photoPool));
  const pick = (n: number, offset = 0) =>
    uniquePool.length ? Array.from({ length: n }, (_, i) => uniquePool[(offset + i) % uniquePool.length]) : [];

  const coverStrip = gallery.slice(0, 5); // "from the package's photo gallery"
  const heroPhoto = pkg.bannerImageUrl ?? gallery[0] ?? null;
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const cancellation = paragraphs(pkg.cancellationPolicy);
  const terms = paragraphs(pkg.termsConditions);
  const inclusionsPhoto = uniquePool[0] ?? null;

  const Logo = ({ className }: { className?: string }) =>
    logoUrl ? (
      <img src={logoUrl} alt={orgName} className={cn('object-contain', className)} />
    ) : (
      // Fallback badge (no logo uploaded): force a square regardless of the
      // "h-X w-auto" sizing classes callers pass for the real <img> case —
      // w-auto has nothing to size against on a <span>, which otherwise
      // collapses this into a narrow vertical pill.
      <span
        className={cn('flex aspect-square items-center justify-center rounded-xl text-xl font-black text-white', className)}
        style={{ backgroundColor: ACCENT, fontFamily: HEAD }}
      >
        {orgName.slice(0, 1)}
      </span>
    );

  // Dark policy page (Cancellation & Terms share this layout, different photos).
  function DarkPolicyPage({ eyebrow, title, body, photos }: { eyebrow: string; title: string; body: string[]; photos: string[] }) {
    const stack = photos.slice(0, 3);
    const feature = photos[3];
    return (
      <Sheet clip className="text-white">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(225deg, #3d3a34 0%, ${INK} 60%, #000 100%)` }}
        />
        <div className="relative grid min-h-[297mm] grid-cols-[minmax(150px,220px)_1fr]">
          {/* Left: small square marker + circular photos connected by a line */}
          <div className="relative flex flex-col items-center gap-8 py-16">
            <span className="mb-2 size-2.5 shrink-0 bg-white/80" />
            {stack.length > 0 && <div className="absolute inset-y-16 w-px bg-white/25" />}
            {stack.map((src, i) => (
              <CirclePhoto key={i} src={src} className="relative z-10 size-28" />
            ))}
          </div>
          {/* Right: feature photo + heading + centered policy text */}
          <div className="relative py-16 pr-14">
            {feature && (
              <div className="mb-6 flex flex-col items-end">
                <CirclePhoto src={feature} className="size-32" />
                <div className="mt-4 h-px w-full bg-white/25" />
              </div>
            )}
            <PageHeading eyebrow={eyebrow} title={title} eyebrowColor="#ffffff" titleColor="#ffffff" />
            <div className="mt-6 max-w-xl space-y-3 text-center text-[15px] leading-relaxed text-white/80">
              {body.length ? (
                body.map((p, i) => <p key={i}>{p}</p>)
              ) : (
                <p className="text-white/50">Please contact us for details.</p>
              )}
            </div>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <div className="min-h-dvh bg-neutral-800 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .brochure-page { break-after: page; }
          .brochure-page:last-child { break-after: auto; }
        }
      `}</style>

      {/* Toolbar (hidden in print) */}
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Download PDF
        </Button>
      </div>

      {/* ===================== 1 · COVER ===================== */}
      <Sheet clip className="text-white" style={{ backgroundColor: INK }}>
        {heroPhoto && <img src={heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {/* darker at top so the logo/title read; darker again at the bottom for the footer bar */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.68) 0%, rgba(0,0,0,.22) 34%, rgba(0,0,0,.5) 78%, rgba(0,0,0,.7) 100%)' }}
        />
        <div className="relative flex min-h-[297mm] flex-col">
          <div className="flex flex-1 flex-col items-center px-10 pt-14 text-center">
            <Logo className="h-24 w-auto max-w-[70%]" />
            <h1 className="mt-8 text-6xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl" style={{ fontFamily: HEAD }}>
              {title}
            </h1>
            {/* white rectangular price box */}
            <div className="mt-8 rounded-lg bg-white px-8 py-3 text-lg font-bold shadow-lg" style={{ color: NAVY }}>
              {duration} : {price}/Person
            </div>
          </div>

          {/* strip of up to 5 arched photos — resizes to however many exist, gentle height variation */}
          {coverStrip.length > 0 && (
            <div className="relative flex items-end justify-center gap-3 px-10 pb-12">
              {coverStrip.map((src, i) => (
                <ArchPhoto key={i} src={src} className="flex-1" style={{ height: i % 2 === 0 ? '8.5rem' : '7rem' }} />
              ))}
            </div>
          )}

          {/* dark footer bar: instagram (if any) · phone · email */}
          {(instagramUrl || phone || email) && (
            <div className="relative flex flex-wrap items-center justify-center gap-x-8 gap-y-1.5 bg-black/75 px-8 py-4 text-sm font-semibold">
              {instagramUrl && (
                <span className="flex items-center gap-2 text-white">
                  <Instagram className="size-4" style={{ color: ACCENT }} /> {orgName}
                </span>
              )}
              {phone && (
                <span className="flex items-center gap-2 text-white">
                  <Phone className="size-4" style={{ color: ACCENT }} /> {phone}
                </span>
              )}
              {email && (
                <span className="flex items-center gap-2 text-white">
                  <Mail className="size-4" style={{ color: ACCENT }} /> {email}
                </span>
              )}
            </div>
          )}
        </div>
      </Sheet>

      {/* ===================== 2 · SHORT ITINERARY ===================== */}
      {pkg.itinerary.length > 0 && (
        <Sheet framed footerBar style={{ backgroundColor: PAPER, color: INK }} className="px-12 py-14">
          <PageHeading eyebrow="Short" title="Itinerary" align="center" />
          <div className="relative mx-auto mt-12 max-w-3xl">
            {pkg.itinerary.map((d, i) => {
              const cover = dayCover(d);
              const stats = dayStats(d);
              const photoLeft = i % 2 === 0;
              const Info = (
                <div className={cn('flex flex-col justify-center', photoLeft ? 'pl-6 text-left' : 'items-end pr-6 text-right')}>
                  <span className="text-sm font-bold uppercase tracking-widest text-neutral-800" style={{ fontFamily: HEAD }}>
                    Day {d.day}
                  </span>
                  <h3 className="text-xl font-bold italic" style={{ fontFamily: HEAD }}>
                    {d.title}
                  </h3>
                  {stats.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs text-neutral-500">
                      {stats.map((s) => (
                        <li key={s.label}>
                          {s.label}: {s.value}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
              const Photo = cover ? <ArchPhoto src={cover} className="h-36 w-full" /> : <div />;
              return (
                <div key={d.day} className="grid grid-cols-[1fr_40px_1fr] items-center pb-10">
                  <div>{photoLeft ? Photo : Info}</div>
                  {/* center line + navy diamond marker */}
                  <div className="relative flex h-full items-center justify-center">
                    <div className="absolute inset-y-0 w-px bg-neutral-300" />
                    <div className="relative z-10 size-4 rotate-45 border-2 border-white shadow" style={{ backgroundColor: NAVY }} />
                  </div>
                  <div>{photoLeft ? Info : Photo}</div>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* ===================== 3 · DETAILED ITINERARY (one page per day) ===================== */}
      {pkg.itinerary.map((d, i) => {
        const cover = dayCover(d);
        const narrative = dayNarrative(d);
        const stats = dayStats(d);
        const isFirst = i === 0;
        return (
          <Sheet key={`day-${d.day}`} framed footerBar style={{ backgroundColor: PAPER, color: INK }} className="flex flex-col px-12 py-12">
            {/* Day 1 carries the section header; later days just show the logo */}
            {isFirst ? (
              <PageHeading eyebrow="Detailed" title="Itinerary" align="center" />
            ) : (
              <div className="flex justify-center">
                <Logo className="h-16 w-auto max-w-[60%]" />
              </div>
            )}

            {/* dark rounded rectangle: full narrative, justified */}
            {narrative.length > 0 && (
              <div className="mt-8 rounded-3xl px-9 py-8 text-white shadow-lg" style={{ backgroundColor: INK }}>
                <div className="space-y-3 text-[15px] leading-relaxed text-justify text-white/85">
                  {narrative.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            {/* full-width photo banner with overlays (or a charcoal bar if no photo).
                Fixed height keeps every day on exactly one A4 page (no print overflow). */}
            <div className="relative mt-8 h-[26rem] w-full overflow-hidden rounded-3xl" style={{ backgroundColor: '#2a2521' }}>
              {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
              {/* bottom-left: light "Day n" label + bold title */}
              <div className="absolute bottom-5 left-6 text-white">
                <span className="text-2xl font-light" style={{ fontFamily: HEAD }}>
                  Day {d.day}
                </span>
                <p className="text-lg font-medium leading-tight" style={{ fontFamily: HEAD }}>
                  {d.title}
                </p>
              </div>
              {/* bottom-right: white stat pills (only stats that exist) */}
              {stats.length > 0 && (
                <div className="absolute bottom-5 right-6 flex flex-col items-end gap-2">
                  {stats.map((s) => (
                    <span key={s.label} className="rounded bg-white/95 px-3 py-1 text-xs font-bold italic shadow" style={{ color: INK }}>
                      {s.label}: {s.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Sheet>
        );
      })}

      {/* ===================== 4 · INCLUSIONS / EXCLUSIONS ===================== */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Sheet style={{ backgroundColor: PAPER, color: INK }} className="flex flex-col px-12 py-8">
          <Scallop />
          <div className="flex-1 py-10">
            <PageHeading eyebrow="Your dream destination" title="Is Just One Ticket Away" />
            <div className="mt-10 grid grid-cols-[1.3fr_1fr] gap-10">
              <div className="space-y-8">
                {inclusions.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold" style={{ fontFamily: HEAD }}>
                      <span className="size-2.5 shrink-0" style={{ backgroundColor: ACCENT }} /> What&apos;s Included:
                    </h3>
                    <div className="space-y-2.5">
                      {inclusions.map((l, i) => (
                        <p key={i} className="text-sm">
                          {l}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div>
                    <h3 className="mb-3 flex items-center gap-2 text-lg font-bold" style={{ fontFamily: HEAD }}>
                      <span className="size-2.5 shrink-0" style={{ backgroundColor: ACCENT }} /> What&apos;s NOT Included:
                    </h3>
                    <div className="space-y-2.5">
                      {exclusions.map((l, i) => (
                        <p key={i} className="text-sm text-neutral-600">
                          {l}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {inclusionsPhoto && (
                <div className="overflow-hidden rounded-lg">
                  <img src={inclusionsPhoto} alt="" className="h-full min-h-[24rem] w-full object-cover" />
                </div>
              )}
            </div>
          </div>
          <Scallop />
        </Sheet>
      )}

      {/* ===================== 5 · CANCELLATION POLICY ===================== */}
      {cancellation.length > 0 && (
        <DarkPolicyPage eyebrow="Cancellation" title="Policy" body={cancellation} photos={pick(4, 0)} />
      )}

      {/* ===================== 6 · TERMS & CONDITIONS ===================== */}
      {terms.length > 0 && (
        <DarkPolicyPage eyebrow="Terms and" title="Conditions" body={terms} photos={pick(4, 1)} />
      )}

      {/* ===================== 7 · FAQ (Good to Know) ===================== */}
      {pkg.faqs.length > 0 && (
        <Sheet framed footerBar style={{ backgroundColor: PAPER, color: INK }} className="px-12 py-14">
          <div className="flex justify-center">
            <Logo className="h-10 w-auto max-w-[50%]" />
          </div>
          <div className="mt-8">
            <PageHeading eyebrow="Good to" title="Know" align="center" />
          </div>
          <div className="mx-auto mt-10 max-w-3xl space-y-6">
            {pkg.faqs.map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1 w-1 shrink-0" style={{ backgroundColor: ACCENT }} />
                <div>
                  <p className="text-base font-bold" style={{ fontFamily: HEAD }}>
                    {f.question}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-500">{f.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {/* ===================== 8 · CLOSING / BOOKING CTA ===================== */}
      <Sheet clip className="text-white" style={{ backgroundColor: INK }}>
        {heroPhoto && <img src={heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative flex min-h-[297mm] flex-col items-center justify-center px-12 text-center">
          <Logo className="h-20 w-auto max-w-[60%]" />
          <Eyebrow className="mt-8 text-3xl" color={ACCENT}>
            Let&apos;s plan your journey
          </Eyebrow>
          <h2 className="mt-1 text-5xl font-black uppercase leading-tight tracking-tight sm:text-6xl" style={{ fontFamily: HEAD }}>
            Book {title}
          </h2>
          <p className="mt-5 max-w-md text-base text-white/85">
            Reach out to lock in your dates — our team will share a tailored itinerary, payment plan and availability
            within a few hours.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 text-base font-semibold">
            {phone && (
              <span className="flex items-center gap-2">
                <Phone className="size-4" style={{ color: ACCENT }} /> {phone}
              </span>
            )}
            {email && (
              <span className="flex items-center gap-2">
                <Mail className="size-4" style={{ color: ACCENT }} /> {email}
              </span>
            )}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
