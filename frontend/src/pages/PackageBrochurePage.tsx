import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Instagram, MapPin, MessageCircle, Phone, Printer } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { HostReview, PackageItineraryDay, PricingOption, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

/**
 * JOINETRA — the single, fixed package brochure template (reference-matched
 * rebuild: cream/brown/yellow/blue palette, Anton/Baloo 2/Caveat/Poppins,
 * fixed 1280x720 "spread" pages — one per section, one per itinerary day).
 *
 * Presentation-only: renders existing package / itinerary / review data.
 * Adds no required data fields — every section is omitted gracefully when its
 * source data is empty, never shown blank or with a placeholder image.
 */

interface BrochureOrg {
  name: string;
  logoUrl: string | null;
  instagramUrl: string | null;
  whatsappNumber: string | null;
}
interface PublicBrochure {
  package: TravelPackage;
  organization: BrochureOrg | null;
  reviews: HostReview[];
}

// --- Fixed design tokens (not agency-editable) -------------------------------
const CREAM = '#f1eee7';
const CREAM_DARK = '#e7e2d8';
const BROWN = '#3a2a1b';
const TEXT = '#4a3826';
const YELLOW = '#f6c60f';
const BLUE = '#3f6fe0';
const BLUE_DARK = '#2c4fb0';
const RED = '#d92b2b';
const WHITE = '#ffffff';

const FONT_DISPLAY = "'Anton', sans-serif";
const FONT_SCRIPT = "'Caveat', cursive";
const FONT_HEADING = "'Baloo 2', sans-serif";
const FONT_BODY = "'Poppins', sans-serif";

// --- Small text/data helpers --------------------------------------------------
const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

const paragraphs = (s: string | null | undefined): string[] => {
  const text = (s ?? '').trim();
  if (!text) return [];
  const byBlank = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return byBlank.length > 1 ? byBlank : lines(text);
};

/** The day's narrative — description, else activity blocks (newer builder flow). */
const dayNarrative = (d: PackageItineraryDay): string[] => {
  if (d.description && d.description.trim()) return paragraphs(d.description);
  const blocks = d.activityBlocks ?? [];
  return blocks.map((b) => [b.name, b.description].filter(Boolean).join(' — ')).filter(Boolean);
};

/** Up to 4 photos for a day's polaroid stack — that day's own images only
 *  (never reused from other days or the general gallery, so each day's
 *  story stays honest to what was actually uploaded for it). */
const dayImages = (d: PackageItineraryDay): string[] => {
  const own = (d.images ?? []).filter(Boolean);
  if (own.length > 0) return own.slice(0, 4);
  return (d.activityBlocks ?? []).map((b) => b.imageUrl).filter((u): u is string => !!u).slice(0, 4);
};

/** A short, single-word script accent under the destination name (e.g. "Beauty",
 *  "Adventure") — only when a category tag is genuinely a single short word;
 *  multi-word tags never get force-fit into the decorative script line. */
const scriptAccent = (categories: string[]): string | null => {
  const first = categories.find((c) => c.trim() && !c.includes(' ') && c.length <= 14);
  return first ?? null;
};

/** "@handle" from an Instagram profile URL; falls back to the raw URL's path. */
const instagramHandle = (url: string): string => {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '').replace(/^\/+/, '');
    return path ? `@${path}` : url;
  } catch {
    return url;
  }
};

const digitsOnly = (s: string) => s.replace(/\D/g, '');

// --- Reusable presentational pieces ------------------------------------------

function BrandBadge({
  orgName,
  logoUrl,
  size = 'md',
  corner,
}: {
  orgName: string;
  logoUrl: string | null;
  size?: 'sm' | 'md';
  /** Pins the badge to the page's top-left corner — used on every page but the cover. */
  corner?: boolean;
}) {
  const small = size === 'sm';
  return (
    <div className={cn('pbx-badge', corner && 'pbx-badge--corner')}>
      <div className={cn('pbx-badge__icon', small && 'pbx-badge__icon--sm')}>
        {logoUrl ? (
          <img src={logoUrl} alt={orgName} className="pbx-badge__logo" />
        ) : (
          <svg viewBox="0 0 24 24" className={small ? 'pbx-icon-sm' : 'pbx-icon-md'} style={{ color: YELLOW }}>
            <path
              fill="currentColor"
              d="M14 3L9 12l3 3-4 6h16L14 3zM6 10L1 21h6l3-4.5L6 10z"
            />
          </svg>
        )}
      </div>
      {!small && <div className="pbx-badge__name">{orgName.toUpperCase()}</div>}
    </div>
  );
}

function Ornament() {
  return (
    <div className="pbx-ornament">
      <span>❖</span>
    </div>
  );
}

function HeadlineBlock({ display, script, dark }: { display: string; script?: string | null; dark?: boolean }) {
  return (
    <div className="pbx-headline">
      <span className={cn('pbx-headline__display', dark && 'pbx-headline__display--dark')}>{display}</span>
      {script && <span className="pbx-headline__script">{script}</span>}
    </div>
  );
}

function LocationTag({ text, flip }: { text: string; flip?: boolean }) {
  return (
    <div className={cn('pbx-location-tag', flip && 'pbx-location-tag--flip')}>
      <MapPin className="size-3.5 opacity-70" /> {text}
    </div>
  );
}

/** Polaroid photo stack — degrades gracefully from 1 to 4 photos, keeping the
 *  reference's exact positions for whichever slots have a real image. The
 *  location tag is nested INSIDE the stack (not the page) so it's positioned
 *  relative to the photo cluster, matching where the reference anchors it. */
function PhotoStack({ photos, reverse, locationText }: { photos: string[]; reverse?: boolean; locationText?: string }) {
  const [main, a, b, c] = photos;
  if (!main) return null;
  return (
    <div className={cn('pbx-photo-stack', reverse && 'pbx-photo-stack--reverse')}>
      <div className="pbx-polaroid pbx-polaroid--main">
        <img src={main} alt="" />
      </div>
      {a && (
        <div className="pbx-polaroid pbx-polaroid--a">
          <img src={a} alt="" />
        </div>
      )}
      {b && (
        <div className="pbx-polaroid pbx-polaroid--b">
          <img src={b} alt="" />
        </div>
      )}
      {c && (
        <div className="pbx-polaroid pbx-polaroid--c">
          <img src={c} alt="" />
        </div>
      )}
      {locationText && <LocationTag text={locationText} flip={reverse} />}
    </div>
  );
}

function ReviewCard({ review }: { review: HostReview }) {
  const stars = Math.max(0, Math.min(5, review.rating ?? 5));
  return (
    <div className="pbx-review-card">
      <div className="pbx-review-card__head">
        {review.photoUrl ? (
          <img src={review.photoUrl} alt="" className="pbx-review-avatar-img" />
        ) : (
          <div className="pbx-review-avatar">{review.reviewerName.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="pbx-review-name">{review.reviewerName}</div>
      </div>
      <div className="pbx-review-stars">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</div>
      <div className="pbx-review-text">{review.quote}</div>
    </div>
  );
}

function PriceCard({ option, currency, peak }: { option: PricingOption; currency: string; peak?: boolean }) {
  return (
    <div className="pbx-price-card">
      <div className={cn('pbx-price-card__tag', peak && 'pbx-price-card__tag--peak')}>{option.label.toUpperCase()}</div>
      <div className={cn('pbx-price-card__amount', peak && 'pbx-price-card__amount--peak')}>
        <span className="pbx-amt">{formatCurrency(option.price, currency)}</span>
        <span className="pbx-per">PER PERSON</span>
      </div>
    </div>
  );
}

/** One fixed 1280×720 page — the atomic unit of the brochure. */
function Page({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <section className={cn('pbx-page', className)}>
      <span className="pbx-page-label print:hidden">{label}</span>
      {children}
    </section>
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
  const reviews = pkgQuery.data?.reviews ?? [];

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
  const whatsappNumber = org?.whatsappNumber ?? null;
  const title = (pkg.bookingTitle || pkg.name).toUpperCase();
  const accentWord = scriptAccent(pkg.categories);
  const duration = `${pkg.nights}N/${pkg.days}D`;
  const price = formatCurrency(pkg.priceAmount, pkg.priceCurrency);
  const phone = pkg.contactNumber?.trim() || null;

  const heroPhoto = pkg.bannerImageUrl ?? pkg.galleryImages[0] ?? null;
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const whyChooseUs = pkg.highlights.filter(Boolean);

  const termsLines = [...paragraphs(pkg.cancellationPolicy), ...paragraphs(pkg.termsConditions)];
  const termsHalf = Math.ceil(termsLines.length / 2);
  const termsCol1 = termsLines.slice(0, termsHalf);
  const termsCol2 = termsLines.slice(termsHalf);

  const payInfo = paragraphs(pkg.paymentTerms);

  const standardPricing = pkg.pricingOptions.filter((p) => (p.season ?? 'STANDARD') === 'STANDARD');
  const peakPricing = pkg.pricingOptions.filter((p) => p.season === 'PEAK');
  // Never show an empty pricing page when a real price exists — synthesize one
  // card from the package's own base price if no explicit tiers were entered.
  const fallbackPricing: PricingOption[] =
    standardPricing.length === 0 && peakPricing.length === 0 && pkg.priceAmount > 0
      ? [{ label: 'Package Price', price: pkg.priceAmount }]
      : [];
  const pricingCards = standardPricing.length > 0 ? standardPricing : fallbackPricing;

  const hasContact = !!(phone || instagramUrl || whatsappNumber || heroPhoto);

  return (
    <div className="pbx-screen">
      <style>{`
        .pbx-screen { min-height:100dvh; background:#777; padding:36px 0 80px; }
        .pbx-toolbar { max-width:1280px; margin:0 auto 24px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; }
        @media print { .pbx-toolbar { display:none; } }

        .pbx-page { position:relative; width:1280px; height:720px; margin:0 auto 36px; overflow:hidden; background:${CREAM}; box-shadow:0 18px 46px rgba(0,0,0,.35); font-family:${FONT_BODY}; color:${TEXT}; }
        .pbx-page-label { position:absolute; top:-24px; left:0; font-family:${FONT_BODY}; font-size:12px; letter-spacing:.08em; color:#eee; opacity:.65; }

        .pbx-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .pbx-scrim-dark { position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,10,10,.55) 0%, rgba(10,10,10,.25) 38%, rgba(10,10,10,.65) 100%); }
        .pbx-scrim-soft { position:absolute; inset:0; background:rgba(255,255,255,.72); }

        .pbx-badge { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .pbx-badge__icon { width:96px; height:84px; background:${BROWN}; clip-path:polygon(50% 0%, 100% 30%, 100% 100%, 0% 100%, 0% 30%); display:flex; align-items:center; justify-content:center; border:2px solid ${YELLOW}; overflow:hidden; }
        .pbx-badge__icon--sm { width:60px; height:52px; }
        .pbx-icon-md { width:56px; height:56px; }
        .pbx-icon-sm { width:34px; height:34px; }
        .pbx-badge__logo { width:100%; height:100%; object-fit:cover; }
        .pbx-badge__name { background:${BROWN}; color:${CREAM}; font-family:${FONT_HEADING}; font-weight:700; font-size:11px; letter-spacing:.06em; padding:3px 12px; margin-top:-6px; text-align:center; line-height:1.25; max-width:180px; }
        .pbx-badge--corner { position:absolute; top:24px; left:24px; z-index:5; }

        .pbx-headline { text-align:center; }
        .pbx-headline__display { font-family:${FONT_DISPLAY}; font-size:80px; color:${WHITE}; letter-spacing:.03em; text-shadow:3px 3px 0 rgba(0,0,0,.25), 0 0 30px rgba(0,0,0,.2); line-height:1; }
        .pbx-headline__display--dark { color:${BROWN}; text-shadow:none; }
        .pbx-headline__script { font-family:${FONT_SCRIPT}; font-weight:700; font-size:58px; color:${YELLOW}; margin-top:-14px; display:block; transform:rotate(-3deg); }

        .pbx-price-pill { display:inline-block; background:${YELLOW}; color:${BROWN}; font-family:${FONT_HEADING}; font-weight:700; font-size:20px; padding:10px 26px; }

        .pbx-ornament { display:flex; align-items:center; gap:10px; color:${YELLOW}; margin:10px 0 22px; }
        .pbx-ornament::before, .pbx-ornament::after { content:""; flex:1; height:2px; background:linear-gradient(90deg, transparent, ${YELLOW} 30%, ${YELLOW} 70%, transparent); }
        .pbx-ornament span { font-size:14px; }

        .pbx-itinerary-grid { margin-top:30px; display:grid; grid-template-columns:repeat(3, 1fr); gap:24px 28px; }
        .pbx-day-card { text-align:center; }
        .pbx-day-card__head { background:${YELLOW}; color:${BLUE_DARK}; font-family:${FONT_HEADING}; font-weight:800; font-size:18px; letter-spacing:.04em; padding:9px 0; }
        .pbx-day-card__body { background:${BLUE}; color:${WHITE}; font-family:${FONT_HEADING}; font-weight:600; font-size:14px; line-height:1.5; padding:20px 14px; min-height:88px; display:flex; align-items:center; justify-content:center; }

        .pbx-day-detail { height:100%; display:flex; align-items:center; gap:50px; padding:0 60px; }
        .pbx-day-detail--reverse { flex-direction:row-reverse; }
        .pbx-day-detail__text { flex:1.05; }
        .pbx-day-detail__text h2 { font-family:${FONT_HEADING}; font-weight:800; font-size:25px; color:${BROWN}; letter-spacing:.02em; margin:0; }
        .pbx-day-detail__text p { font-family:${FONT_BODY}; font-weight:500; font-size:15.5px; line-height:1.7; color:${TEXT}; margin:0 0 14px; }

        .pbx-photo-stack { flex:1; position:relative; height:440px; }
        .pbx-polaroid { position:absolute; background:${WHITE}; padding:8px; box-shadow:0 10px 26px rgba(0,0,0,.28); }
        .pbx-polaroid img { display:block; width:100%; height:100%; object-fit:cover; }
        .pbx-polaroid--main { width:280px; height:320px; top:0; right:30px; transform:rotate(2deg); z-index:1; }
        .pbx-polaroid--a { width:140px; height:140px; top:220px; left:10px; transform:rotate(-8deg); z-index:2; }
        .pbx-polaroid--b { width:160px; height:180px; top:240px; left:120px; transform:rotate(-2deg); z-index:3; }
        .pbx-polaroid--c { width:140px; height:140px; top:240px; right:0; transform:rotate(7deg); z-index:2; }
        .pbx-photo-stack--reverse .pbx-polaroid--main { right:auto; left:30px; }
        .pbx-photo-stack--reverse .pbx-polaroid--a { left:auto; right:10px; }
        .pbx-photo-stack--reverse .pbx-polaroid--b { left:auto; right:120px; }
        .pbx-photo-stack--reverse .pbx-polaroid--c { right:auto; left:0; }

        .pbx-location-tag { position:absolute; bottom:4px; left:6px; background:${CREAM_DARK}; color:${BROWN}; font-family:${FONT_BODY}; font-weight:600; font-size:12.5px; padding:7px 16px; display:flex; align-items:center; gap:8px; box-shadow:0 6px 14px rgba(0,0,0,.18); z-index:5; }
        .pbx-location-tag--flip { left:auto; right:6px; }

        /* Always top-right — the brand badge owns top-left on every page, so this never collides with it regardless of layout direction. */
        .pbx-day-corner-badge { position:absolute; top:26px; right:32px; font-family:${FONT_HEADING}; font-weight:800; font-size:12px; color:${YELLOW}; background:${BROWN}; padding:5px 14px; letter-spacing:.12em; z-index:5; }

        .pbx-reviews-title { display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:30px; }
        .pbx-reviews-title h2 { font-family:${FONT_HEADING}; font-weight:800; font-size:30px; color:${BROWN}; margin:0; letter-spacing:.02em; }
        .pbx-stars { color:${YELLOW}; font-size:22px; letter-spacing:2px; }
        .pbx-review-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:18px; }
        .pbx-review-card { background:${WHITE}; padding:15px 16px; box-shadow:0 8px 20px rgba(0,0,0,.12); }
        .pbx-review-card__head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
        .pbx-review-avatar, .pbx-review-avatar-img { width:32px; height:32px; border-radius:50%; flex-shrink:0; object-fit:cover; }
        .pbx-review-avatar { background:${BLUE}; color:${WHITE}; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12.5px; }
        .pbx-review-name { font-weight:600; font-size:13px; color:${BROWN}; }
        .pbx-review-stars { color:${YELLOW}; font-size:12.5px; margin:2px 0 6px; }
        .pbx-review-text { font-size:12px; line-height:1.55; color:#5b5044; }

        .pbx-incl-half { flex:1; padding:44px 42px; }
        .pbx-incl-half--light { background:${CREAM}; }
        .pbx-incl-half--dark { background:#4a3a2a; color:${CREAM}; }
        .pbx-incl-half h3 { font-family:${FONT_HEADING}; font-weight:800; font-size:26px; letter-spacing:.03em; margin:0 0 6px; }
        .pbx-incl-half--light h3 { color:${BROWN}; }
        .pbx-incl-half--dark h3 { color:${WHITE}; }
        .pbx-incl-rule { width:100%; height:2px; background:${YELLOW}; opacity:.5; margin-bottom:20px; }
        .pbx-icon-row { display:flex; gap:9px; margin-bottom:22px; }
        .pbx-icon-chip { flex:1; background:${BROWN}; color:${CREAM}; text-align:center; padding:12px 3px 9px; font-size:9px; font-family:${FONT_BODY}; font-weight:600; }
        .pbx-incl-half--dark .pbx-icon-chip { background:#3a2c1e; }
        .pbx-icon-chip svg { width:20px; height:20px; margin-bottom:5px; }
        .pbx-incl-half ul { margin:0; padding-left:18px; }
        .pbx-incl-half li { font-family:${FONT_BODY}; font-weight:500; font-size:13.5px; line-height:1.65; margin-bottom:6px; }
        .pbx-incl-half--light li { color:${TEXT}; }
        .pbx-incl-half--dark li { color:#efe9e0; }

        .pbx-section-title-center { text-align:center; font-family:${FONT_HEADING}; font-weight:800; font-size:28px; color:${BROWN}; margin:0 0 8px; letter-spacing:.02em; }
        .pbx-section-title-center--left { text-align:left; }
        .pbx-two-col { display:grid; grid-template-columns:1fr 1fr; gap:0 42px; margin-top:18px; }
        .pbx-two-col ul { margin:0; padding-left:18px; }
        .pbx-two-col li { font-family:${FONT_BODY}; font-size:13px; line-height:1.65; color:${TEXT}; margin-bottom:13px; }

        .pbx-why-list ul { margin:16px 0 0; padding-left:18px; }
        .pbx-why-list li { font-family:${FONT_BODY}; font-weight:500; font-size:14px; line-height:1.7; color:${TEXT}; margin-bottom:7px; }

        .pbx-price-row { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin:24px 0 30px; }
        .pbx-price-card { background:${WHITE}; box-shadow:0 8px 20px rgba(0,0,0,.1); }
        .pbx-price-card__tag { background:${BROWN}; color:${CREAM}; font-family:${FONT_BODY}; font-weight:600; font-size:11px; letter-spacing:.08em; padding:9px 0; text-align:center; }
        .pbx-price-card__tag--peak { background:${RED}; }
        .pbx-price-card__amount { padding:18px 0 20px; text-align:center; }
        .pbx-amt { font-family:${FONT_HEADING}; font-weight:800; font-size:24px; color:${BROWN}; }
        .pbx-price-card__amount--peak .pbx-amt { color:${RED}; }
        .pbx-per { display:block; font-family:${FONT_BODY}; font-size:10px; color:#8a8072; margin-top:4px; letter-spacing:.05em; }
        .pbx-peak-banner { font-family:${FONT_HEADING}; font-weight:700; font-size:18px; color:${BROWN}; margin-bottom:4px; text-align:center; }
        .pbx-peak-banner span { color:${RED}; }
        .pbx-pay-info { font-family:${FONT_BODY}; font-size:12.5px; color:${TEXT}; line-height:1.7; text-align:center; }

        .pbx-contact-hero { position:relative; flex:1; display:flex; align-items:center; justify-content:center; }
        .pbx-contact-hero img { width:600px; height:320px; object-fit:cover; box-shadow:0 14px 30px rgba(0,0,0,.3); }
        .pbx-contact-footer { background:${CREAM_DARK}; display:flex; flex-wrap:wrap; justify-content:center; gap:60px; padding:20px 0; }
        .pbx-contact-item { display:flex; align-items:center; gap:9px; }
        .pbx-contact-icon { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; flex-shrink:0; }
        .pbx-contact-item a, .pbx-contact-item span { font-family:${FONT_HEADING}; font-weight:700; font-size:14px; color:${BROWN}; text-decoration:none; }

        @media print {
          .pbx-screen { background:none; padding:0; }
          @page { size: 13.333in 7.5in; margin:0; }
          .pbx-page { box-shadow:none; margin:0; break-after:page; }
          .pbx-page:last-child { break-after:auto; }
        }
      `}</style>

      {/* Toolbar (hidden in print) */}
      <div className="pbx-toolbar">
        <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Download PDF
        </Button>
      </div>

      {/* ===================== 1 · COVER ===================== */}
      <Page label="01 · cover">
        {heroPhoto && <img className="pbx-bg" src={heroPhoto} alt="" />}
        <div className="pbx-scrim-dark" />
        <div className="relative z-[2] flex h-full flex-col items-center justify-center gap-4">
          <BrandBadge orgName={orgName} logoUrl={logoUrl} />
          <div className="mt-2">
            <HeadlineBlock display={title} script={accentWord} />
          </div>
          <div className="pbx-price-pill">
            Starting @ {price} &nbsp;|&nbsp; {duration}
          </div>
        </div>
      </Page>

      {/* ===================== 2 · ITINERARY OVERVIEW ===================== */}
      {pkg.itinerary.length > 0 && (
        <Page label="02 · itinerary overview">
          {heroPhoto && <img className="pbx-bg" src={heroPhoto} alt="" />}
          <div className="pbx-scrim-soft" />
          <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
          <div className="relative z-[2] h-full px-16 py-12">
            <HeadlineBlock display="ITINERARY" script={pkg.destination} dark />
            <div className="pbx-itinerary-grid">
              {pkg.itinerary.map((d) => (
                <div key={d.day} className="pbx-day-card">
                  <div className="pbx-day-card__head">DAY {d.day}</div>
                  <div className="pbx-day-card__body">{d.title}</div>
                </div>
              ))}
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 3 · DAY DETAIL (one page per day) ===================== */}
      {pkg.itinerary.map((d, i) => {
        const photos = dayImages(d);
        const narrative = dayNarrative(d);
        const reverse = i % 2 === 1;
        return (
          <Page key={`day-${d.day}`} label={`day ${d.day} detail`}>
            <div className="pbx-day-corner-badge">DAY {d.day}</div>
            <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
            <div className={cn('pbx-day-detail', reverse && 'pbx-day-detail--reverse')}>
              <div className="pbx-day-detail__text">
                <h2>DAY {d.day} : {d.title.toUpperCase()}</h2>
                <Ornament />
                {narrative.length > 0 ? (
                  narrative.map((p, idx) => <p key={idx}>{p}</p>)
                ) : (
                  <p className="opacity-60">Details to be shared closer to departure.</p>
                )}
              </div>
              {photos.length > 0 && <PhotoStack photos={photos} reverse={reverse} locationText={d.title} />}
            </div>
          </Page>
        );
      })}

      {/* ===================== 4 · CUSTOMER REVIEWS ===================== */}
      {reviews.length > 0 && (
        <Page label="customer reviews">
          <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
          <div className="h-full px-14 py-12">
            <div className="pbx-reviews-title">
              <h2>CUSTOMER&apos;S REVIEWS</h2>
              <span className="pbx-stars">★★★★★</span>
            </div>
            <div className="pbx-review-grid">
              {reviews.slice(0, 6).map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 5 · INCLUSIONS / EXCLUSIONS ===================== */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Page label="inclusions & exclusions" className="flex">
          {inclusions.length > 0 && (
            <div className="pbx-incl-half pbx-incl-half--light">
              <h3>INCLUSIONS</h3>
              <div className="pbx-incl-rule" />
              <div className="pbx-icon-row">
                {['Transport', 'Meals', 'Stay', 'Trip Captain', 'Safe', 'Sightseeing'].map((label) => (
                  <IconChip key={label} label={label} />
                ))}
              </div>
              <ul>
                {inclusions.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
          {exclusions.length > 0 && (
            <div className="pbx-incl-half pbx-incl-half--dark">
              <h3>EXCLUSIONS</h3>
              <div className="pbx-incl-rule" />
              <div className="pbx-icon-row">
                {['Food/Bev.', 'Personal Exp.', 'Cost Rising', 'Anything Else'].map((label) => (
                  <IconChip key={label} label={label} />
                ))}
              </div>
              <ul>
                {exclusions.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          )}
        </Page>
      )}

      {/* ===================== 6 · TERMS & CONDITIONS ===================== */}
      {termsLines.length > 0 && (
        <Page label="terms & conditions">
          <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
          <div className="h-full px-14 py-11">
            <div className="pbx-section-title-center">TERMS &amp; CONDITIONS</div>
            <div className="mx-auto max-w-md">
              <Ornament />
            </div>
            <div className="pbx-two-col">
              <ul>
                {termsCol1.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <ul>
                {termsCol2.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 7 · WHY CHOOSE US ===================== */}
      {whyChooseUs.length > 0 && (
        <Page label="why choose us">
          <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
          <div className="flex h-full items-center gap-12 px-14 py-12">
            <div className="pbx-why-list flex-[1.1]">
              <div className="pbx-section-title-center pbx-section-title-center--left">WHY CHOOSE US</div>
              <div className="max-w-[220px]">
                <Ornament />
              </div>
              <ul>
                {whyChooseUs.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
            {pkg.galleryImages.length > 0 && (
              <div className="flex-1" style={{ height: 420, position: 'relative' }}>
                <PhotoStack photos={pkg.galleryImages.slice(0, 4)} />
              </div>
            )}
          </div>
        </Page>
      )}

      {/* ===================== 8 · SPECIAL PRICING ===================== */}
      {(pricingCards.length > 0 || peakPricing.length > 0) && (
        <Page label="special pricing">
          <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
          <div className="h-full px-14 py-11 text-center">
            <div className="pbx-section-title-center">SPECIAL PRICING</div>
            <div className="mx-auto max-w-xs">
              <Ornament />
            </div>

            {pricingCards.length > 0 && (
              <div className="pbx-price-row" style={{ gridTemplateColumns: `repeat(${Math.min(3, pricingCards.length)}, 1fr)` }}>
                {pricingCards.map((p, i) => (
                  <PriceCard key={i} option={p} currency={pkg.priceCurrency} />
                ))}
              </div>
            )}

            {peakPricing.length > 0 && (
              <>
                <div className="pbx-peak-banner">
                  PEAK SEASON <span>PRICING</span>
                </div>
                <div className="pbx-price-row" style={{ gridTemplateColumns: `repeat(${Math.min(3, peakPricing.length)}, 1fr)` }}>
                  {peakPricing.map((p, i) => (
                    <PriceCard key={i} option={p} currency={pkg.priceCurrency} peak />
                  ))}
                </div>
              </>
            )}

            {payInfo.length > 0 && (
              <div className="pbx-pay-info">
                {payInfo.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </div>
        </Page>
      )}

      {/* ===================== 9 · CONTACT ===================== */}
      {hasContact && (
        <Page label="contact us" className="flex flex-col">
          <BrandBadge orgName={orgName} logoUrl={logoUrl} size="sm" corner />
          <div className="pbx-section-title-center" style={{ marginTop: 34 }}>
            CONTACT US
          </div>
          <div className="pbx-contact-hero">{heroPhoto && <img src={heroPhoto} alt="" />}</div>
          <div className="pbx-contact-footer">
            {phone && (
              <div className="pbx-contact-item">
                <span className="pbx-contact-icon" style={{ background: '#3bb54a' }}>
                  <Phone className="size-4" />
                </span>
                <a href={`tel:${phone}`}>{phone}</a>
              </div>
            )}
            {instagramUrl && (
              <div className="pbx-contact-item">
                <span
                  className="pbx-contact-icon"
                  style={{ background: 'radial-gradient(circle at 30% 110%, #ffdb8c 0%, #ee2a7b 45%, #6228d7 100%)' }}
                >
                  <Instagram className="size-4" />
                </span>
                <a href={instagramUrl} target="_blank" rel="noreferrer">
                  {instagramHandle(instagramUrl)}
                </a>
              </div>
            )}
            {whatsappNumber && (
              <div className="pbx-contact-item">
                <span className="pbx-contact-icon" style={{ background: '#25d366' }}>
                  <MessageCircle className="size-4" />
                </span>
                <a href={`https://wa.me/${digitsOnly(whatsappNumber)}`} target="_blank" rel="noreferrer">
                  +{whatsappNumber}
                </a>
              </div>
            )}
          </div>
        </Page>
      )}
    </div>
  );
}

// Same icon set as the reference build's inline <symbol> defs, inlined per
// chip instead (simpler than a shared <defs> block for a handful of one-off uses).
const CHIP_ICON_PATHS: Record<string, string> = {
  Transport: 'M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1A1.5 1.5 0 119 15.5 1.5 1.5 0 017.5 17zm9 0A1.5 1.5 0 1118 15.5a1.5 1.5 0 01-1.5 1.5zM18 11H6V6h12v5z',
  Meals: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-7v9h2.5v9H21V2h-5z',
  Stay: 'M21 10.78V7a3 3 0 00-3-3H6a3 3 0 00-3 3v3.78A2 2 0 002 12.5v6a1 1 0 001 1h.5a1 1 0 001-1V17h15v1.5a1 1 0 001 1H21a1 1 0 001-1v-6a2 2 0 00-1-1.72zM6 6h5v4H5V7a1 1 0 011-1zm7 0h5a1 1 0 011 1v3h-6V6zM4.5 15v-2A.5.5 0 015 12.5h14a.5.5 0 01.5.5v2h-15z',
  'Trip Captain': 'M12 12a5 5 0 10-5-5 5 5 0 005 5zm0 2c-4 0-9 2-9 6v2h18v-2c0-4-5-6-9-6z',
  Safe: 'M12 2l8 3.5v6c0 5-3.4 8.7-8 10.5C7.4 20.2 4 16.5 4 11.5v-6L12 2z',
  Sightseeing: 'M9 3h2v3H9V3zm4 0h2v3h-2V3zM7 8a4 4 0 100 8 4 4 0 000-8zm10 0a4 4 0 100 8 4 4 0 000-8zM7 10a2 2 0 110 4 2 2 0 010-4zm10 0a2 2 0 110 4 2 2 0 010-4z',
  'Food/Bev.': 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm9-5.59L18.59 2 2 18.59 3.41 20 8 15.41V22h2v-8.59l8.59-8.59L20 3.41z',
  'Personal Exp.': 'M21 7h-1V6a2 2 0 00-2-2H5a3 3 0 00-3 3v10a3 3 0 003 3h14a2 2 0 002-2v-2h1a1 1 0 001-1V8a1 1 0 00-1-1zm-3 8h-2v-4h2v4z',
  'Cost Rising': 'M19 18H7a5 5 0 01-1-9.9 6 6 0 0111.6 1.7A4 4 0 0119 18z',
  'Anything Else': 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a7.9 7.9 0 014.5 1.4L5.4 16.5A8 8 0 0112 4zm0 16a7.9 7.9 0 01-4.5-1.4L18.6 7.5A8 8 0 0112 20z',
};

function IconChip({ label }: { label: string }) {
  const path = CHIP_ICON_PATHS[label];
  return (
    <div className="pbx-icon-chip">
      <svg viewBox="0 0 24 24" fill="none">
        {path ? (
          <path fill="currentColor" d={path} />
        ) : (
          <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.4" />
        )}
      </svg>
      {label}
    </div>
  );
}
