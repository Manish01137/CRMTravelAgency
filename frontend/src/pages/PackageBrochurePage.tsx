import { useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PackageItineraryDay, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { BODY_FONT, DISPLAY_FONT, HAIRLINE, INK, MUTED, THEME_VARS } from '@/lib/signatureTheme';

/**
 * JOINETRA — the PDF download of a package: fixed 800×1130 "book" pages with
 * a heavy yellow border and hex-pattern watermark, one page per section, one
 * page per itinerary day, terms auto-paginated 8-per-page — a direct port of
 * the agency-supplied Signature brochure reference (same page sizes, same
 * banner/bullet/photo-slot/footer-contact treatment), rendering real package
 * data through the same 3-variant Signature color system as the public page
 * (imported from '@/lib/signatureTheme') rather than the reference's static
 * single palette.
 *
 * Presentation-only: renders existing package / org data. Every section is
 * omitted gracefully when its source data is empty — never shown blank or
 * with a "click to add" placeholder, since this is a read-only customer-
 * facing document, not the builder.
 */

const SCRIPT_FONT = "'Caveat', cursive";

interface BrochureOrg {
  name: string;
  logoUrl: string | null;
  instagramUrl: string | null;
  whatsappNumber: string | null;
  /** Same bank fields already printed on invoices — reused for the PDF's
   *  bank-transfer payment box. All optional; the box is omitted without them. */
  bankName: string | null;
  bankAccountNumber: string | null;
  ifscCode: string | null;
}
interface PublicBrochure {
  package: TravelPackage;
  organization: BrochureOrg | null;
}

// --- Small text/data helpers --------------------------------------------------
const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** The day's narrative — description, else activity blocks (newer builder flow). */
const dayBullets = (d: PackageItineraryDay): string[] => {
  if (d.description && d.description.trim()) return lines(d.description);
  const blocks = d.activityBlocks ?? [];
  return blocks.map((b) => [b.name, b.description].filter(Boolean).join(' — ')).filter(Boolean);
};

const dayPhoto = (d: PackageItineraryDay): string | null => {
  const own = (d.images ?? []).filter(Boolean);
  if (own.length > 0) return own[0];
  return d.activityBlocks?.find((b) => b.imageUrl)?.imageUrl ?? null;
};

/** A short, single-word decorative accent under the destination headline
 *  (e.g. "beauty", "heritage") — only when a category tag is genuinely a
 *  single short word; multi-word tags never get force-fit into the script line. */
const scriptAccent = (categories: string[]): string | null => {
  const first = categories.find((c) => c.trim() && !c.includes(' ') && c.length <= 14);
  return first?.toLowerCase() ?? null;
};

/** "@handle" from an Instagram profile URL; falls back to the raw URL. */
const instagramHandle = (url: string): string => {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '').replace(/^\/+/, '');
    return path ? `@${path}` : url;
  } catch {
    return url;
  }
};

const digitsOnly = (s: string) => s.replace(/\D/g, '');

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

// --- Reusable presentational pieces ------------------------------------------

function BrandRow({ orgName, logoUrl }: { orgName: string; logoUrl: string | null }) {
  return (
    <div className="pbx-brand-row">
      <span className="pbx-brand-mark">
        {logoUrl ? (
          <img src={logoUrl} alt={orgName} />
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="1.8">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
            <circle cx="12" cy="10" r="2.4" />
          </svg>
        )}
      </span>
      <span className="pbx-brand-name">{orgName}</span>
    </div>
  );
}

function Banner({ children, yellow }: { children: ReactNode; yellow?: boolean }) {
  return (
    <div className="pbx-banner-wrap">
      <span className={cn('pbx-banner', yellow && 'pbx-banner--yellow')}>{children}</span>
    </div>
  );
}

function Bullets({ items, yellow }: { items: string[]; yellow?: boolean }) {
  return (
    <ul className={cn('pbx-bullets', yellow && 'pbx-bullets--yellow')}>
      {items.map((l, i) => (
        <li key={i}>{l}</li>
      ))}
    </ul>
  );
}

function Photo({ url, className }: { url: string | null; className: string }) {
  if (!url) return null;
  return <div className={cn('pbx-photo', className)} style={{ backgroundImage: `url('${url}')` }} />;
}

/** One fixed 800×1130 page — the atomic unit of the brochure. */
function Page({ children, className, label, flow }: { children: ReactNode; className?: string; label: string; flow?: boolean }) {
  return (
    <section className={cn('pbx-page', flow && 'pbx-page--flow', className)}>
      <span className="pbx-page-label print:hidden">{label}</span>
      <div className="pbx-hex-wash" />
      <div className="pbx-page-inner">{children}</div>
    </section>
  );
}

/** Turns "Nagpur Getaway ✈ 2026" into a safe download filename. */
function toFileName(name: string): string {
  const safe = name.replace(/[^\w\- ]+/g, '').trim();
  return `${safe || 'package'}.pdf`;
}

export function PackageBrochurePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const pkgQuery = useQuery({
    queryKey: ['public-package', id],
    queryFn: () => api.get<PublicBrochure>(`/public/package/${id}`),
    enabled: !!id,
  });

  const pkg = pkgQuery.data?.package;
  const org = pkgQuery.data?.organization;

  /**
   * Renders every fixed-size page as a real PDF file the browser saves to disk
   * — NOT window.print(), which only opens the OS print dialog and depends on
   * the user manually choosing "Save as PDF" as the destination. That dialog
   * is also unsupported inside most in-app browsers (e.g. a link opened from
   * inside WhatsApp/Instagram itself), where clicking it used to do nothing
   * at all. Captures each .pbx-page as a canvas (at 2x scale for crisp text)
   * and stacks them into one multi-page PDF sized to match each page's own
   * rendered dimensions (terms pages auto-paginate to a variable height).
   */
  async function downloadPdf() {
    const container = pagesRef.current;
    if (!container || !pkg) return;
    const pages = Array.from(container.querySelectorAll<HTMLElement>('.pbx-page'));
    if (pages.length === 0) return;

    setExporting(true);
    setProgress({ done: 0, total: pages.length });
    const skipped: string[] = [];
    try {
      let doc: jsPDF | null = null;
      for (let i = 0; i < pages.length; i += 1) {
        const page = pages[i];
        const label = page.querySelector('.pbx-page-label')?.textContent || `page ${i + 1}`;
        const width = page.offsetWidth;
        const height = page.offsetHeight;
        try {
          const canvas = await html2canvas(page, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          if (!doc) {
            doc = new jsPDF({ unit: 'px', format: [width, height], hotfixes: ['px_scaling'] });
          } else {
            doc.addPage([width, height]);
          }
          doc.addImage(imgData, 'JPEG', 0, 0, width, height);
        } catch (pageErr) {
          // One broken page (e.g. an image that fails to render to canvas)
          // must never sink the whole export — skip it and keep going, so a
          // problem on one page still leaves a downloadable PDF for the rest.
          console.error(`Brochure PDF export — page "${label}" failed, skipping:`, pageErr);
          skipped.push(label);
        }
        setProgress({ done: i + 1, total: pages.length });
      }
      if (!doc) throw new Error('Every page failed to render');
      doc.save(toFileName(pkg.bookingTitle || pkg.name));
      if (skipped.length > 0) {
        toast.warning(`Downloaded, but ${skipped.length} page(s) failed to render and were skipped: ${skipped.join(', ')}`);
      }
    } catch (err) {
      // Surfaced directly (not just console) so a failure is diagnosable
      // from the toast alone, without needing to open devtools.
      console.error('Brochure PDF export failed:', err);
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Could not generate the PDF — ${detail}`);
    } finally {
      setExporting(false);
    }
  }

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

  const vars = THEME_VARS[pkg.signatureTheme] ?? THEME_VARS.SUNRISE;

  // --- Derived, presentation-only values -----------------------------------
  const orgName = org?.name ?? 'Travel Agency';
  const logoUrl = org?.logoUrl ?? null;
  const instagramUrl = org?.instagramUrl ?? null;
  const whatsappNumber = org?.whatsappNumber ?? null;
  const phone = pkg.contactNumber?.trim() || null;
  const accentWord = scriptAccent(pkg.categories);

  const heroPhoto = pkg.bannerImageUrl ?? pkg.galleryImages[0] ?? null;
  const pickupPoints = lines(pkg.pickupPoints);
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const highlights = pkg.highlights.filter(Boolean);
  const thingsToCarry = lines(pkg.thingsToCarry);
  const bookingSteps = lines(pkg.paymentTerms);
  const termsPages = chunk([...lines(pkg.cancellationPolicy), ...lines(pkg.termsConditions)], 8);

  const standardTiers = pkg.pricingOptions.filter((p) => (p.season ?? 'STANDARD') === 'STANDARD');
  const peakTiers = pkg.pricingOptions.filter((p) => p.season === 'PEAK');
  const priceTiers =
    standardTiers.length > 0 || peakTiers.length > 0
      ? pkg.pricingOptions
      : pkg.priceAmount > 0
        ? [{ label: 'Package Price', price: pkg.priceAmount }]
        : [];

  const hasBankDetails = !!(org?.bankName || org?.bankAccountNumber || org?.ifscCode);
  const hasContact = !!(phone || pkg.contactEmail || instagramUrl || whatsappNumber);

  return (
    <div className="pbx-screen" style={vars as React.CSSProperties}>
      <style>{`
        .pbx-screen { min-height:100dvh; background:#3A3F47; padding:36px 0 80px; }
        .pbx-toolbar { max-width:800px; margin:0 auto 24px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; }
        @media print { .pbx-toolbar { display:none; } }

        .pbx-page { position:relative; width:800px; min-height:1130px; margin:0 auto 34px; background:#fff; border:14px solid var(--yellow); border-radius:6px; overflow:hidden; box-shadow:0 18px 44px rgba(0,0,0,.28); font-family:${BODY_FONT}; color:${INK}; }
        .pbx-page--flow { height:auto; }
        .pbx-page-label { position:absolute; top:-24px; left:0; font-family:${BODY_FONT}; font-size:12px; letter-spacing:.08em; color:#eee; opacity:.7; }
        .pbx-page-inner { position:relative; z-index:2; padding:34px 40px 40px; min-height:1102px; box-sizing:border-box; }
        .pbx-hex-wash { position:absolute; inset:0 0 auto 0; height:380px; z-index:1; pointer-events:none; opacity:.6;
          background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='110' viewBox='0 0 64 110'><path d='M32 0 L64 18.3 L64 54.9 L32 73.2 L0 54.9 L0 18.3 Z' fill='none' stroke='%23BFD8EF' stroke-width='1.4'/></svg>");
          background-size:64px 110px; }

        .pbx-brand-row { display:flex; flex-direction:column; align-items:center; gap:10px; margin-bottom:6px; }
        .pbx-brand-mark { width:66px; height:66px; border-radius:50%; background:var(--blue-pale); border:2px solid var(--blue); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; }
        .pbx-brand-mark img { width:100%; height:100%; object-fit:cover; }
        .pbx-brand-mark svg { width:34px; height:34px; }
        .pbx-brand-name { font-family:${DISPLAY_FONT}; font-weight:700; font-size:13px; color:var(--blue-dark); text-align:center; line-height:1.3; }

        .pbx-banner-wrap { text-align:center; margin:14px 0 22px; }
        .pbx-banner { display:inline-block; background:var(--blue); color:#fff; font-family:${DISPLAY_FONT}; font-weight:700; font-size:22px; letter-spacing:.02em; padding:11px 26px; border-radius:14px; }
        .pbx-banner--yellow { background:var(--yellow); color:${INK}; }

        .pbx-bullets { list-style:none; margin:0; padding:0; }
        .pbx-bullets li { position:relative; padding-left:24px; margin-bottom:10px; font-size:15px; line-height:1.5; color:${INK}; }
        .pbx-bullets li::before { content:''; position:absolute; left:2px; top:8px; width:8px; height:8px; border-radius:50%; background:var(--blue); }
        .pbx-bullets--yellow li::before { background:var(--yellow); border:2px solid var(--orange); width:6px; height:6px; }

        .pbx-photo { width:100%; border-radius:16px; background-size:cover; background-position:center; background-color:#EEF2F6; }

        .pbx-callout { border:1.5px solid var(--orange); background:var(--yellow-pale); border-radius:12px; padding:12px 16px; font-size:13.5px; line-height:1.5; margin-top:10px; }
        .pbx-callout b { color:var(--orange); }

        .pbx-footer-contact { position:absolute; left:24px; right:24px; bottom:20px; z-index:3; }
        .pbx-fc-top { background:#fff; border-radius:999px; padding:11px 20px; display:flex; justify-content:center; gap:26px; font-size:13.5px; font-weight:600; color:${INK}; box-shadow:0 6px 18px rgba(0,0,0,.12); flex-wrap:wrap; }
        .pbx-fc-bottom { margin-top:8px; background:var(--blue); color:#fff; border-radius:999px; padding:11px 20px; text-align:center; font-weight:700; font-size:15px; letter-spacing:.02em; }
        .pbx-fc-item { display:flex; align-items:center; gap:7px; }

        .pbx-cover-title { text-align:center; margin:2px 0 14px; }
        .pbx-cover-title .main { font-family:${DISPLAY_FONT}; font-weight:800; font-size:56px; line-height:1; color:var(--blue-dark); text-transform:uppercase; letter-spacing:.01em; }
        .pbx-cover-title .accent { font-family:${SCRIPT_FONT}; font-weight:700; font-size:38px; color:var(--orange); margin-top:-6px; display:block; }
        .pbx-pill-row { display:flex; justify-content:center; gap:12px; margin-bottom:20px; }
        .pbx-pill { display:flex; align-items:center; gap:8px; border-radius:999px; padding:9px 18px; font-weight:700; font-size:14px; }
        .pbx-pill--yellow { background:var(--yellow); color:${INK}; }
        .pbx-pill--blue { background:var(--blue); color:#fff; }
        .pbx-cover-photo { height:520px; margin-top:6px; }

        .pbx-timeline { display:flex; flex-direction:column; align-items:center; padding:10px 0 26px; }
        .pbx-tl-icon { font-size:26px; }
        .pbx-tl-line { width:2px; flex:1; background:repeating-linear-gradient(to bottom, var(--blue) 0 6px, transparent 6px 12px); min-height:210px; position:relative; margin:6px 0; }
        .pbx-tl-rows { position:absolute; left:50%; transform:translateX(-50%); top:0; width:560px; }
        .pbx-tl-row { display:flex; align-items:center; gap:16px; padding:14px 0; }
        .pbx-tl-dot { width:12px; height:12px; border-radius:50%; background:#fff; border:3px solid var(--blue); flex-shrink:0; }
        .pbx-tl-day { font-family:${DISPLAY_FONT}; font-weight:700; color:${INK}; font-size:15px; width:70px; flex-shrink:0; }
        .pbx-tl-label { font-weight:600; font-size:15px; color:${INK}; }
        .pbx-pickup-box { background:var(--yellow); border-radius:16px; padding:16px 24px; text-align:center; margin:18px 40px 0; }
        .pbx-pickup-box .title { font-family:${DISPLAY_FONT}; font-weight:700; font-size:19px; margin-bottom:8px; }
        .pbx-pickup-box .item { color:var(--blue-dark); font-family:${DISPLAY_FONT}; font-weight:700; font-size:17px; }

        .pbx-day-badge { display:inline-block; background:var(--blue); color:#fff; font-family:${DISPLAY_FONT}; font-weight:700; font-size:20px; padding:8px 26px; border-radius:12px; }
        .pbx-day-title { font-family:${DISPLAY_FONT}; font-weight:800; font-size:27px; margin:16px 0 16px; text-transform:uppercase; color:${INK}; }
        .pbx-day-photo { height:400px; margin-top:16px; }

        table.pbx-price-table { width:100%; border-collapse:collapse; margin:8px 0 16px; }
        table.pbx-price-table th { background:var(--blue-pale); color:var(--blue-dark); font-family:${DISPLAY_FONT}; font-size:14px; text-align:left; padding:12px 16px; }
        table.pbx-price-table td { padding:12px 16px; border-top:1px solid ${HAIRLINE}; font-weight:600; font-size:14.5px; }
        .pbx-steps { display:flex; flex-direction:column; gap:8px; margin-bottom:18px; }
        .pbx-steps .step { font-size:14px; line-height:1.55; }
        .pbx-steps b { color:var(--blue-dark); }
        .pbx-pay-box { border:1.5px solid ${HAIRLINE}; border-radius:16px; padding:18px; }
        .pbx-pay-box .head { text-align:center; font-family:${DISPLAY_FONT}; font-weight:700; font-size:13px; color:${MUTED}; text-transform:uppercase; margin-bottom:14px; }
        .pbx-bank-lines { font-size:13.5px; line-height:2; }
        .pbx-bank-lines b { display:inline-block; width:90px; color:${MUTED}; font-weight:600; }

        .pbx-contact-row { border:1.5px solid var(--yellow); border-radius:14px; padding:14px 20px; display:flex; align-items:center; gap:12px; font-weight:700; font-size:16px; margin-bottom:14px; color:${INK}; text-decoration:none; }
        .pbx-contact-row .ic { font-size:20px; }
        .pbx-ig-block { text-align:center; margin-top:30px; }
        .pbx-ig-block .title { font-family:${DISPLAY_FONT}; font-weight:700; font-size:17px; margin-bottom:2px; }
        .pbx-ig-block .sub { font-size:11px; color:${MUTED}; letter-spacing:.08em; margin-bottom:16px; }
        .pbx-ig-circle { width:74px; height:74px; border-radius:50%; margin:0 auto 10px; background:linear-gradient(135deg,#F58529,#DD2A7B,#8134AF,#515BD4); display:flex; align-items:center; justify-content:center; }
        .pbx-ig-circle svg { width:34px; height:34px; }

        @media print {
          .pbx-screen { background:none; padding:0; }
          @page { size: A4; margin:0; }
          .pbx-page { box-shadow:none; margin:0; break-after:page; }
          .pbx-page:last-child { break-after:auto; }
        }
      `}</style>

      {/* Toolbar (hidden in print) */}
      <div className="pbx-toolbar">
        <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" disabled={exporting} onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={downloadPdf} disabled={exporting}>
          {exporting ? (
            <>
              <Loader2 className="animate-spin" /> Preparing… {progress.done}/{progress.total}
            </>
          ) : (
            <>
              <Download /> Download PDF
            </>
          )}
        </Button>
      </div>

      <div ref={pagesRef}>
      {/* ===================== 1 · COVER ===================== */}
      <Page label="01 · cover">
        <BrandRow orgName={orgName} logoUrl={logoUrl} />
        <div className="pbx-cover-title">
          <span className="main">{pkg.destination}</span>
          {accentWord && <span className="accent">{accentWord}</span>}
        </div>
        <div className="pbx-pill-row">
          <span className="pbx-pill pbx-pill--yellow">🌙 {pkg.nights} NIGHTS</span>
          <span className="pbx-pill pbx-pill--blue">☀️ {pkg.days} DAYS</span>
        </div>
        <Photo url={heroPhoto} className="pbx-cover-photo" />
        <div className="pbx-footer-contact">
          <div className="pbx-fc-top">
            {instagramUrl && (
              <span className="pbx-fc-item">
                📷 <b>{instagramHandle(instagramUrl)}</b>
              </span>
            )}
            {pkg.contactEmail && (
              <span className="pbx-fc-item">
                ✉️ <b>{pkg.contactEmail}</b>
              </span>
            )}
          </div>
          {(phone || whatsappNumber) && <div className="pbx-fc-bottom">📞 {phone ?? `+${whatsappNumber}`}</div>}
        </div>
      </Page>

      {/* ===================== 2 · BRIEF ITINERARY MAP ===================== */}
      {pkg.itinerary.length > 0 && (
        <Page label="02 · itinerary map">
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <Banner>BRIEF ITINERARY</Banner>
          <div className="pbx-timeline">
            <span className="pbx-tl-icon">🚌</span>
            <div className="pbx-tl-line">
              <div className="pbx-tl-rows">
                {pkg.itinerary.map((it) => (
                  <div key={it.day} className="pbx-tl-row">
                    <span className="pbx-tl-dot" />
                    <span className="pbx-tl-day">DAY {it.day}</span>
                    <span className="pbx-tl-label">{it.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <span className="pbx-tl-icon">🚌</span>
          </div>
          {pickupPoints.length > 0 && (
            <div className="pbx-pickup-box">
              <div className="title">📍 PICKUP POINTS</div>
              {pickupPoints.map((p, i) => (
                <div key={i} className="item">
                  {p}
                </div>
              ))}
            </div>
          )}
        </Page>
      )}

      {/* ===================== 3 · DAY PAGES ===================== */}
      {pkg.itinerary.map((d) => (
        <Page key={d.day} label={`day ${d.day}`}>
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <div style={{ textAlign: 'center' }}>
            <span className="pbx-day-badge">DAY {d.day}</span>
          </div>
          <div className="pbx-day-title" style={{ textAlign: 'center' }}>
            {d.title}
          </div>
          <Bullets items={dayBullets(d)} />
          <Photo url={dayPhoto(d)} className="pbx-day-photo" />
        </Page>
      ))}

      {/* ===================== 4 · INCLUSIONS / EXCLUSIONS ===================== */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Page label="inclusions & exclusions">
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          {inclusions.length > 0 && (
            <>
              <Banner>INCLUSIONS</Banner>
              <Bullets items={inclusions} />
            </>
          )}
          {exclusions.length > 0 && (
            <>
              <Banner yellow>EXCLUSIONS</Banner>
              <Bullets items={exclusions} yellow />
            </>
          )}
        </Page>
      )}

      {/* ===================== 5 · PRICING & BOOKING PROCESS ===================== */}
      {(priceTiers.length > 0 || bookingSteps.length > 0 || hasBankDetails) && (
        <Page label="pricing & booking">
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <Banner>PRICING &amp; BOOKING PROCESS</Banner>
          {priceTiers.length > 0 && (
            <table className="pbx-price-table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Pricing</th>
                </tr>
              </thead>
              <tbody>
                {priceTiers.map((t, i) => (
                  <tr key={i}>
                    <td>
                      {t.label} {t.season === 'PEAK' && <span style={{ color: 'var(--orange)', fontSize: 12 }}>(Peak season)</span>}
                    </td>
                    <td>{formatCurrency(t.price, pkg.priceCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {bookingSteps.length > 0 && (
            <div className="pbx-steps">
              {bookingSteps.map((s, i) => (
                <div key={i} className="step">
                  <b>Step {i + 1}:</b> {s}
                </div>
              ))}
            </div>
          )}
          {hasBankDetails && (
            <div className="pbx-pay-box">
              <div className="head">Payment Method</div>
              <div className="pbx-bank-lines">
                {org?.bankName && (
                  <div>
                    <b>Name</b>
                    <span>{org.bankName}</span>
                  </div>
                )}
                {org?.bankAccountNumber && (
                  <div>
                    <b>A/C No</b>
                    <span>{org.bankAccountNumber}</span>
                  </div>
                )}
                {org?.ifscCode && (
                  <div>
                    <b>IFSC</b>
                    <span>{org.ifscCode}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Page>
      )}

      {/* ===================== 6 · WHY CHOOSE US ===================== */}
      {highlights.length > 0 && (
        <Page label="why choose us">
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <Banner>WHY CHOOSE US</Banner>
          <Bullets items={highlights} />
          <Photo url={pkg.galleryImages[0] ?? heroPhoto} className="pbx-day-photo" />
        </Page>
      )}

      {/* ===================== 7 · THINGS TO CARRY ===================== */}
      {thingsToCarry.length > 0 && (
        <Page label="things to carry">
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <Banner>ADVISABLE THINGS TO CARRY</Banner>
          <Bullets items={thingsToCarry} />
          <Photo url={pkg.galleryImages[1] ?? pkg.galleryImages[0] ?? null} className="pbx-day-photo" />
        </Page>
      )}

      {/* ===================== 8 · TERMS & CONDITIONS (auto-paginated) ===================== */}
      {termsPages.map((group, i) => (
        <Page key={`terms-${i}`} label={`terms & conditions ${i + 1}`} flow>
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <Banner>TERMS &amp; CONDITIONS</Banner>
          <Bullets items={group} />
        </Page>
      ))}

      {/* ===================== 9 · CONTACT ===================== */}
      {hasContact && (
        <Page label="contact us">
          <BrandRow orgName={orgName} logoUrl={logoUrl} />
          <div className="pbx-banner-wrap" style={{ marginTop: 30 }}>
            <span className="pbx-banner">CONTACT US!</span>
          </div>
          <div style={{ maxWidth: 420, margin: '26px auto 0' }}>
            {phone && (
              <a className="pbx-contact-row" href={`tel:${phone}`}>
                <span className="ic">📞</span> {phone}
              </a>
            )}
            {pkg.contactEmail && (
              <a className="pbx-contact-row" href={`mailto:${pkg.contactEmail}`}>
                <span className="ic">✉️</span> {pkg.contactEmail}
              </a>
            )}
            {whatsappNumber && (
              <a className="pbx-contact-row" href={`https://wa.me/${digitsOnly(whatsappNumber)}`} target="_blank" rel="noreferrer">
                <span className="ic">💬</span> +{whatsappNumber}
              </a>
            )}
          </div>
          {instagramUrl && (
            <div className="pbx-ig-block">
              <div className="title">Check our Instagram</div>
              <div className="sub">TAP ON THE LOGO TO SEE</div>
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="pbx-ig-circle">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" />
                </svg>
              </a>
              <div style={{ fontWeight: 700 }}>{instagramHandle(instagramUrl)}</div>
            </div>
          )}
        </Page>
      )}
      </div>
    </div>
  );
}
