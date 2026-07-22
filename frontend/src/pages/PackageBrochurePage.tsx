import type { CSSProperties, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Mail, Phone, Printer } from 'lucide-react';
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
}
interface PublicBrochure {
  package: TravelPackage;
  organization: BrochureOrg | null;
}

// --- Fixed design tokens (not agency-editable) -------------------------------
const INK = '#161311'; // charcoal
const CREAM = '#faf6ef';
const ACCENT = '#e07a3c'; // warm orange — eyebrow ornaments, FAQ bars, price
const SCRIPT = "'Caveat', cursive"; // italic script eyebrow labels
const HEAD = "'Figtree', sans-serif"; // bold sans headings

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
 *  content pages stay visible so long text flows onto a second printed page. */
function Sheet({
  children,
  className,
  clip,
  style,
}: {
  children: ReactNode;
  className?: string;
  clip?: boolean;
  style?: CSSProperties;
}) {
  return (
    <section
      style={style}
      className={cn(
        'brochure-page relative mx-auto mb-6 w-full max-w-[210mm] min-h-[297mm] shadow-card',
        'print:mb-0 print:max-w-none print:shadow-none',
        clip ? 'overflow-hidden rounded-xl print:rounded-none' : 'overflow-visible',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Small italic script "eyebrow" label above a heading. */
function Eyebrow({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cn('block text-2xl leading-none', className)} style={{ fontFamily: SCRIPT, color: ACCENT, ...style }}>
      {children}
    </span>
  );
}

/** Eyebrow (script) + bold sans heading, used consistently on every page. */
function PageHeading({
  eyebrow,
  title,
  align = 'left',
  dark = false,
}: {
  eyebrow: string;
  title: string;
  align?: 'left' | 'center';
  dark?: boolean;
}) {
  return (
    <div className={align === 'center' ? 'text-center' : ''}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2
        className="mt-1 text-4xl font-black uppercase tracking-tight sm:text-5xl"
        style={{ fontFamily: HEAD, color: dark ? '#fff' : INK }}
      >
        {title}
      </h2>
    </div>
  );
}

/** A photo with a full arched (semicircle) top — cover strip & short itinerary. */
function ArchPhoto({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-t-[999px] rounded-b-2xl', className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

/** A circular framed photo (cancellation / terms pages). */
function CirclePhoto({ src, className }: { src: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-full border-4 border-white/80 shadow-lg', className)}>
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

/** A row of small dots — the "dashed scalloped" decoration. */
function Scallop() {
  return (
    <div
      aria-hidden
      className="h-3.5 w-full"
      style={{
        backgroundImage: `radial-gradient(circle at 7px 7px, ${ACCENT} 3px, transparent 3.5px)`,
        backgroundSize: '18px 14px',
        backgroundRepeat: 'repeat-x',
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
  const title = pkg.bookingTitle || pkg.name;
  const duration = `${pkg.nights}N / ${pkg.days}D`;
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
      <img src={logoUrl} alt={orgName} className={cn('rounded-xl bg-white object-contain p-1', className)} />
    ) : (
      <span
        className={cn('flex items-center justify-center rounded-xl text-xl font-black text-white', className)}
        style={{ backgroundColor: ACCENT, fontFamily: HEAD }}
      >
        {orgName.slice(0, 1)}
      </span>
    );

  // Contact row (phone + email + instagram — only what exists).
  const ContactRow = ({ tone }: { tone: 'light' | 'dark' }) => {
    const color = tone === 'dark' ? 'text-white/90' : 'text-white';
    if (!phone && !email) return null;
    return (
      <div className={cn('flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold', color)}>
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
    );
  };

  // Dark policy page (Cancellation & Terms share this layout, different photos).
  function DarkPolicyPage({ eyebrow, title, body, photos }: { eyebrow: string; title: string; body: string[]; photos: string[] }) {
    const stack = photos.slice(0, 3);
    const feature = photos[3];
    return (
      <Sheet clip className="text-white">
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, #2a2521 0%, ${INK} 55%, #050505 100%)` }} />
        <div className="relative grid min-h-[297mm] grid-cols-[minmax(150px,220px)_1fr]">
          {/* Left: circular photos connected by a line */}
          <div className="relative flex flex-col items-center gap-8 py-16">
            {stack.length > 1 && <div className="absolute inset-y-16 w-px bg-white/25" />}
            {stack.map((src, i) => (
              <CirclePhoto key={i} src={src} className="relative z-10 size-28" />
            ))}
          </div>
          {/* Right: heading + policy text */}
          <div className="relative py-16 pr-12">
            {feature && <CirclePhoto src={feature} className="absolute right-10 top-12 size-24" />}
            <div className="max-w-xl">
              <PageHeading eyebrow={eyebrow} title={title} dark />
              <div className="mt-6 space-y-3 text-[15px] leading-relaxed text-white/80">
                {body.length ? (
                  body.map((p, i) => <p key={i}>{p}</p>)
                ) : (
                  <p className="text-white/50">Please contact us for details.</p>
                )}
              </div>
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
        {/* darker at top so the logo/title read; lighter mid */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.72) 0%, rgba(0,0,0,.28) 38%, rgba(0,0,0,.55) 100%)' }} />
        <div className="relative flex min-h-[297mm] flex-col">
          <div className="flex flex-1 flex-col items-center px-10 pt-16 text-center">
            <Logo className="size-20" />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.35em] text-white/80" style={{ fontFamily: HEAD }}>
              {orgName}
            </p>
            {pkg.destination && (
              <p className="mt-10 text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
                {pkg.destination}
              </p>
            )}
            <h1 className="mt-3 text-6xl font-black uppercase leading-[0.95] tracking-tight sm:text-7xl" style={{ fontFamily: HEAD }}>
              {title}
            </h1>
            {/* white rounded price box */}
            <div className="mt-8 rounded-full bg-white px-8 py-3 text-lg font-extrabold shadow-lg" style={{ color: INK }}>
              {duration} <span style={{ color: ACCENT }}>:</span> {price}/Person
            </div>
          </div>

          {/* strip of up to 5 arched photos — resizes to however many exist */}
          {coverStrip.length > 0 && (
            <div className="relative flex items-end justify-center gap-3 px-10 pb-12">
              {coverStrip.map((src, i) => (
                <ArchPhoto key={i} src={src} className="h-32 flex-1 border-2 border-white/70" />
              ))}
            </div>
          )}

          {/* dark footer bar: instagram (if any) · phone · email */}
          {(phone || email) && (
            <div className="relative flex items-center justify-center gap-x-6 gap-y-1 bg-black/70 px-8 py-4 text-sm font-semibold">
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
        <Sheet style={{ backgroundColor: CREAM, color: INK }} className="px-12 py-14">
          <PageHeading eyebrow="Short" title="Itinerary" align="center" />
          <div className="relative mx-auto mt-12 max-w-3xl">
            {pkg.itinerary.map((d, i) => {
              const cover = dayCover(d);
              const stats = dayStats(d);
              const photoLeft = i % 2 === 0;
              const Info = (
                <div className={cn('flex flex-col justify-center', photoLeft ? 'pl-6 text-left' : 'items-end pr-6 text-right')}>
                  <span className="text-sm font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: HEAD }}>
                    Day {d.day}
                  </span>
                  <h3 className="text-xl font-extrabold" style={{ fontFamily: HEAD }}>
                    {d.title}
                  </h3>
                  {stats.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs font-medium text-neutral-600">
                      {stats.map((s) => (
                        <li key={s.label}>
                          <span className="font-semibold">{s.label}:</span> {s.value}
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
                  {/* center line + diamond */}
                  <div className="relative flex h-full items-center justify-center">
                    <div className="absolute inset-y-0 w-px bg-neutral-300" />
                    <div className="relative z-10 size-4 rotate-45 border-2 border-white shadow" style={{ backgroundColor: ACCENT }} />
                  </div>
                  <div>{photoLeft ? Info : Photo}</div>
                </div>
              );
            })}
          </div>
        </Sheet>
      )}

      {/* ===================== 3 · DETAILED ITINERARY (one page per day) ===================== */}
      {pkg.itinerary.map((d) => {
        const cover = dayCover(d);
        const narrative = dayNarrative(d);
        const stats = dayStats(d);
        return (
          <Sheet key={`day-${d.day}`} style={{ backgroundColor: CREAM, color: INK }} className="flex flex-col px-12 py-12">
            {/* logo centered top */}
            <div className="flex justify-center">
              <Logo className="size-14" />
            </div>

            {/* dark rounded rectangle: full narrative */}
            {narrative.length > 0 && (
              <div className="mt-8 rounded-3xl px-9 py-8 text-white shadow-lg" style={{ backgroundColor: INK }}>
                <Eyebrow style={{ color: ACCENT }}>Day {d.day}</Eyebrow>
                <h3 className="mb-3 text-2xl font-extrabold" style={{ fontFamily: HEAD }}>
                  {d.title}
                </h3>
                <div className="space-y-3 text-[15px] leading-relaxed text-white/85">
                  {narrative.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>
            )}

            {/* full-width photo banner with overlays (or a charcoal bar if no photo).
                Fixed height keeps every day on exactly one A4 page (no print overflow). */}
            <div className="relative mt-8 h-[26rem] w-full overflow-hidden rounded-3xl" style={{ backgroundColor: '#2a2521' }}>
              {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
              {/* bottom-left: Day n + title */}
              <div className="absolute bottom-5 left-6 text-white">
                <span className="text-sm font-black uppercase tracking-widest" style={{ color: ACCENT, fontFamily: HEAD }}>
                  Day {d.day}
                </span>
                <p className="text-2xl font-extrabold leading-tight" style={{ fontFamily: HEAD }}>
                  {d.title}
                </p>
              </div>
              {/* bottom-right: white stat pills (only stats that exist) */}
              {stats.length > 0 && (
                <div className="absolute bottom-5 right-6 flex flex-col items-end gap-2">
                  {stats.map((s) => (
                    <span key={s.label} className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow" style={{ color: INK }}>
                      <span style={{ color: ACCENT }}>{s.label}:</span> {s.value}
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
        <Sheet style={{ backgroundColor: CREAM, color: INK }} className="flex flex-col px-12 py-10">
          <Scallop />
          <div className="flex-1 py-10">
            <PageHeading eyebrow="Your dream destination" title="Is Just One Ticket Away" align="center" />
            <div className="mt-10 grid grid-cols-[1.3fr_1fr] gap-10">
              <div className="space-y-8">
                {inclusions.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-lg font-extrabold" style={{ fontFamily: HEAD }}>
                      What&apos;s Included:
                    </h3>
                    <ul className="space-y-2">
                      {inclusions.map((l, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} /> {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {exclusions.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-lg font-extrabold" style={{ fontFamily: HEAD }}>
                      What&apos;s NOT Included:
                    </h3>
                    <ul className="space-y-2">
                      {exclusions.map((l, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-neutral-400" /> {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {inclusionsPhoto && (
                <div className="overflow-hidden rounded-3xl">
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
        <Sheet style={{ backgroundColor: CREAM, color: INK }} className="px-12 py-14">
          <PageHeading eyebrow="Good to" title="Know" align="center" />
          <div className="mx-auto mt-12 max-w-3xl space-y-6">
            {pkg.faqs.map((f, i) => (
              <div key={i} className="flex gap-4">
                <div className="mt-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: ACCENT }} />
                <div>
                  <p className="text-base font-extrabold" style={{ fontFamily: HEAD }}>
                    {f.question}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{f.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {/* ===================== 8 · CLOSING / BOOKING CTA ===================== */}
      <Sheet clip className="text-white" style={{ backgroundColor: INK }}>
        {heroPhoto && <img src={heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative flex min-h-[297mm] flex-col items-center justify-center px-12 text-center">
          <Logo className="size-20" />
          <Eyebrow className="mt-8 text-3xl">Let&apos;s plan your journey</Eyebrow>
          <h2 className="mt-2 text-5xl font-black uppercase leading-tight tracking-tight sm:text-6xl" style={{ fontFamily: HEAD }}>
            Book {title}
          </h2>
          <p className="mt-5 max-w-lg text-base text-white/85">
            Let our team craft your perfect trip — reach out and we&apos;ll take care of every detail from here.
          </p>
          <div className="mt-10">
            <ContactRow tone="dark" />
          </div>
          <p className="mt-16 text-xs uppercase tracking-[0.3em] text-white/50" style={{ fontFamily: HEAD }}>
            {orgName}
          </p>
        </div>
      </Sheet>
    </div>
  );
}
