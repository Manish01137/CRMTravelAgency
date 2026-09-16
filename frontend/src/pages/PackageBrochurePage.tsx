import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BedDouble,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Moon,
  Phone,
  Printer,
  Sparkles,
  Sun,
  UtensilsCrossed,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { HostReview, PackageItineraryDay, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, initials } from '@/lib/format';
import { Banner, BulletList, BODY_FONT, DISPLAY_FONT, HAIRLINE, INK, MUTED, THEME_VARS } from '@/lib/signatureTheme';

/**
 * JOINETRA — the PDF download of a package, a *paginated* version of the same
 * public package page (/p/:id): same shared Signature design system (colors,
 * fonts, Banner/BulletList, brand mark, pill badges, pricing table) via
 * '@/lib/signatureTheme', same content and section order, just laid out as
 * fixed 1280×720 "spread" pages (one per section, one per itinerary day) that
 * print cleanly instead of one continuous scroll. The two pages previously
 * drifted into looking like unrelated designs because each had its own copy
 * of the styling — they now render from the same source of truth.
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

// --- Small text/data helpers --------------------------------------------------
const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** The day's narrative — description, else activity blocks (newer builder flow). */
const dayNarrative = (d: PackageItineraryDay): string[] => {
  if (d.description && d.description.trim()) return lines(d.description);
  const blocks = d.activityBlocks ?? [];
  return blocks.map((b) => [b.name, b.description].filter(Boolean).join(' — ')).filter(Boolean);
};

/** Up to 4 photos for a day — that day's own images only (never reused from
 *  other days or the general gallery, so each day's story stays honest to
 *  what was actually uploaded for it). */
const dayImages = (d: PackageItineraryDay): string[] => {
  const own = (d.images ?? []).filter(Boolean);
  if (own.length > 0) return own.slice(0, 4);
  return (d.activityBlocks ?? []).map((b) => b.imageUrl).filter((u): u is string => !!u).slice(0, 4);
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

/** The public page's circular brand mark, reused here (logo or initials). */
function BrandMark({ orgName, logoUrl, corner }: { orgName: string; logoUrl: string | null; corner?: boolean }) {
  return (
    <div className={cn('pbx-badge', corner && 'pbx-badge--corner')}>
      <span className={cn('pbx-badge__circle', corner && 'pbx-badge__circle--sm')}>
        {logoUrl ? (
          <img src={logoUrl} alt={orgName} className="pbx-badge__logo" />
        ) : (
          <span className="pbx-badge__initials">{initials(orgName)}</span>
        )}
      </span>
      <span className="pbx-badge__name">{orgName}</span>
    </div>
  );
}

function ChipList({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {items.map((h, i) => (
        <span key={i} className="pbx-chip">
          <Sparkles className="size-3.5" style={{ color: 'var(--orange)' }} /> {h}
        </span>
      ))}
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

  const vars = THEME_VARS[pkg.signatureTheme] ?? THEME_VARS.SUNRISE;

  // --- Derived, presentation-only values -----------------------------------
  const orgName = org?.name ?? 'Travel Agency';
  const logoUrl = org?.logoUrl ?? null;
  const instagramUrl = org?.instagramUrl ?? null;
  const whatsappNumber = org?.whatsappNumber ?? null;
  const title = pkg.bookingTitle || pkg.name;
  const price = formatCurrency(pkg.priceAmount, pkg.priceCurrency);
  const phone = pkg.contactNumber?.trim() || null;

  const heroPhoto = pkg.bannerImageUrl ?? pkg.galleryImages[0] ?? null;
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const highlights = pkg.highlights.filter(Boolean);
  const thingsToCarry = lines(pkg.thingsToCarry);
  const terms = lines(pkg.termsConditions);
  const payInfo = lines(pkg.paymentTerms);

  const hasOverviewPage = highlights.length > 0 || !!pkg.description || pkg.itinerary.length > 0;
  const hasContact = !!(phone || pkg.contactEmail || instagramUrl || whatsappNumber);

  return (
    <div className="pbx-screen" style={vars as React.CSSProperties}>
      <style>{`
        .pbx-screen { min-height:100dvh; background:#777; padding:36px 0 80px; }
        .pbx-toolbar { max-width:1280px; margin:0 auto 24px; display:flex; align-items:center; justify-content:space-between; padding:0 16px; }
        @media print { .pbx-toolbar { display:none; } }

        .pbx-page { position:relative; width:1280px; height:720px; margin:0 auto 36px; overflow:hidden; background:#fff; box-shadow:0 18px 46px rgba(0,0,0,.3); font-family:${BODY_FONT}; color:${INK}; }
        .pbx-page-label { position:absolute; top:-24px; left:0; font-family:${BODY_FONT}; font-size:12px; letter-spacing:.08em; color:#eee; opacity:.65; }
        .pbx-col { max-width:820px; margin:0 auto; padding:56px 40px; height:100%; box-sizing:border-box; overflow:hidden; }

        .pbx-badge { display:flex; align-items:center; gap:10px; }
        .pbx-badge__circle { width:80px; height:80px; border-radius:9999px; border:2px solid var(--blue); background:var(--blue-pale); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; }
        .pbx-badge__circle--sm { width:44px; height:44px; }
        .pbx-badge__logo { width:100%; height:100%; object-fit:cover; }
        .pbx-badge__initials { font-family:${DISPLAY_FONT}; font-weight:700; color:var(--blue); font-size:26px; }
        .pbx-badge__circle--sm .pbx-badge__initials { font-size:15px; }
        .pbx-badge__name { font-family:${DISPLAY_FONT}; font-weight:700; font-size:14px; color:var(--blue-dark); }
        .pbx-badge--corner { position:absolute; top:24px; left:28px; z-index:5; }
        .pbx-badge--corner .pbx-badge__name { font-size:12px; }
        .pbx-cover .pbx-badge { flex-direction:column; text-align:center; }

        .pbx-pill-dest { display:inline-flex; align-items:center; gap:5px; border-radius:8px; padding:5px 12px; font-size:12.5px; font-weight:600; background:var(--blue-pale); color:var(--blue-dark); }
        .pbx-title { font-family:${DISPLAY_FONT}; font-weight:800; text-transform:uppercase; font-size:52px; line-height:1; color:var(--blue-dark); text-align:center; margin:14px 0 0; }
        .pbx-pill-row { display:flex; align-items:center; justify-content:center; gap:10px; margin-top:16px; }
        .pbx-pill { display:inline-flex; align-items:center; gap:6px; border-radius:9999px; padding:7px 18px; font-size:13px; font-weight:700; }
        .pbx-pill--yellow { background:var(--yellow); color:${INK}; }
        .pbx-pill--blue { background:var(--blue); color:#fff; }

        .pbx-cover-photo { width:100%; height:200px; object-fit:cover; border-radius:18px; margin-top:20px; }
        .pbx-price-row { display:flex; align-items:center; justify-content:space-between; gap:12px; border:1.5px solid ${HAIRLINE}; border-radius:16px; padding:16px; margin-top:20px; }
        .pbx-price-amt { font-family:${DISPLAY_FONT}; font-weight:800; font-size:26px; color:var(--blue-dark); }
        .pbx-price-per { font-size:12px; color:${MUTED}; }
        .pbx-price-pill { background:var(--yellow); color:${INK}; font-family:${DISPLAY_FONT}; font-weight:700; font-size:15px; padding:9px 20px; border-radius:9999px; }

        .pbx-chip { display:inline-flex; align-items:center; gap:6px; border-radius:9999px; padding:6px 12px; font-size:13px; font-weight:500; background:var(--blue-pale); color:var(--blue-dark); }

        .pbx-day-row { display:flex; align-items:center; gap:12px; border-radius:10px; padding:9px 12px; background:var(--blue-pale); margin-bottom:6px; }
        .pbx-day-row__num { display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:9999px; background:var(--blue); color:#fff; font-family:${DISPLAY_FONT}; font-weight:700; font-size:12px; flex-shrink:0; }
        .pbx-day-row__title { font-size:13.5px; font-weight:600; color:var(--blue-dark); }

        .pbx-day-page { height:100%; display:flex; flex-direction:column; }
        .pbx-day-head { text-align:center; padding:48px 0 0; }
        .pbx-day-pill { display:inline-block; background:var(--blue); color:#fff; font-family:${DISPLAY_FONT}; font-weight:700; font-size:14px; padding:7px 22px; border-radius:12px; }
        .pbx-day-title { margin:12px 0 0; font-family:${DISPLAY_FONT}; font-weight:800; text-transform:uppercase; font-size:24px; color:${INK}; }
        .pbx-day-body { flex:1; display:flex; gap:36px; padding:28px 56px 40px; align-items:center; overflow:hidden; }
        .pbx-day-body--reverse { flex-direction:row-reverse; }
        .pbx-day-body__text { flex:1.1; max-height:100%; overflow:hidden; }
        .pbx-day-photos { flex:1; display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
        .pbx-day-photos img { width:100%; height:150px; object-fit:cover; border-radius:14px; }
        .pbx-day-meta { display:flex; flex-wrap:wrap; gap:14px; margin-top:16px; font-size:12px; font-weight:500; color:${MUTED}; }
        .pbx-day-meta span { display:flex; align-items:center; gap:6px; }

        .pbx-two-col { display:grid; grid-template-columns:1fr 1fr; gap:0 48px; }

        .pbx-table { width:100%; border-collapse:collapse; border:1.5px solid ${HAIRLINE}; border-radius:14px; overflow:hidden; font-size:14px; }
        .pbx-table th { background:var(--blue-pale); color:var(--blue-dark); font-family:${DISPLAY_FONT}; font-weight:700; text-align:left; padding:10px 16px; }
        .pbx-table td { padding:10px 16px; border-top:1px solid ${HAIRLINE}; font-weight:500; }
        .pbx-table td:last-child { font-weight:600; }

        .pbx-gallery { display:grid; grid-template-columns:repeat(3, 1fr); gap:14px; }
        .pbx-gallery img { width:100%; height:190px; object-fit:cover; border-radius:16px; }

        .pbx-reviews-grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; }
        .pbx-review-card { background:var(--blue-pale); border-radius:14px; padding:15px 16px; }
        .pbx-review-card__head { display:flex; align-items:center; gap:10px; margin-bottom:6px; }
        .pbx-review-avatar, .pbx-review-avatar-img { width:30px; height:30px; border-radius:50%; flex-shrink:0; object-fit:cover; }
        .pbx-review-avatar { background:var(--blue); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; }
        .pbx-review-name { font-weight:600; font-size:13px; color:var(--blue-dark); }
        .pbx-review-stars { color:var(--yellow); font-size:12px; margin:2px 0 6px; text-shadow:0 0 1px rgba(0,0,0,.35); }
        .pbx-review-text { font-size:12px; line-height:1.55; color:${INK}; }

        .pbx-contact-row { display:flex; align-items:center; gap:12px; border:1.5px solid var(--yellow); border-radius:14px; padding:13px 18px; font-weight:600; font-size:14.5px; color:${INK}; text-decoration:none; margin-bottom:10px; }
        .pbx-contact-icon { color:var(--blue); flex-shrink:0; }

        .pbx-footer { text-align:center; font-size:12px; color:${MUTED}; padding-top:18px; }

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
      <Page label="01 · cover" className="pbx-cover">
        <div className="pbx-col flex flex-col items-center justify-center">
          <BrandMark orgName={orgName} logoUrl={logoUrl} />
          <span className="pbx-pill-dest mt-5">
            <MapPin className="size-3.5" /> {pkg.destination}
          </span>
          <h1 className="pbx-title">{title}</h1>
          <div className="pbx-pill-row">
            <span className="pbx-pill pbx-pill--yellow">
              <Moon className="size-3.5" /> {pkg.nights} NIGHTS
            </span>
            <span className="pbx-pill pbx-pill--blue">
              <Sun className="size-3.5" /> {pkg.days} DAYS
            </span>
          </div>
          {heroPhoto && <img className="pbx-cover-photo" src={heroPhoto} alt="" />}
          <div className="pbx-price-row w-full">
            <div>
              <div className="pbx-price-amt">{price}</div>
              <div className="pbx-price-per">per person</div>
            </div>
            <span className="pbx-price-pill">Starting price</span>
          </div>
        </div>
      </Page>

      {/* ===================== 2 · OVERVIEW: highlights, description, brief itinerary ===================== */}
      {hasOverviewPage && (
        <Page label="02 · overview">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col">
            {highlights.length > 0 && <ChipList items={highlights} />}
            {pkg.description && (
              <p className="mt-5 text-[14px] leading-relaxed" style={{ color: INK }}>
                {pkg.description}
              </p>
            )}
            {pkg.itinerary.length > 0 && (
              <>
                <Banner>BRIEF ITINERARY</Banner>
                {pkg.itinerary.map((d) => (
                  <div key={d.day} className="pbx-day-row">
                    <span className="pbx-day-row__num">{d.day}</span>
                    <span className="pbx-day-row__title">{d.title}</span>
                  </div>
                ))}
              </>
            )}
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
            <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
            <div className="pbx-day-page">
              <div className="pbx-day-head">
                <span className="pbx-day-pill">DAY {d.day}</span>
                <h2 className="pbx-day-title">{d.title}</h2>
              </div>
              <div className={cn('pbx-day-body', reverse && photos.length > 0 && 'pbx-day-body--reverse')}>
                <div className="pbx-day-body__text">
                  {narrative.length > 0 ? (
                    <BulletList items={narrative} />
                  ) : (
                    <p className="text-sm opacity-60">Details to be shared closer to departure.</p>
                  )}
                  <div className="pbx-day-meta">
                    {d.stay && (
                      <span>
                        <BedDouble className="size-3.5" style={{ color: 'var(--blue)' }} /> {d.stay}
                      </span>
                    )}
                    {(d.activities?.length ?? 0) > 0 && (
                      <span>
                        <Sparkles className="size-3.5" style={{ color: 'var(--blue)' }} /> {d.activities!.join(' · ')}
                      </span>
                    )}
                    {d.meals && (
                      <span>
                        <UtensilsCrossed className="size-3.5" style={{ color: 'var(--blue)' }} /> {d.meals}
                      </span>
                    )}
                  </div>
                </div>
                {photos.length > 0 && (
                  <div className="pbx-day-photos">
                    {photos.map((src, k) => (
                      <img key={k} src={src} alt="" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Page>
        );
      })}

      {/* ===================== 4 · INCLUSIONS / EXCLUSIONS ===================== */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Page label="inclusions & exclusions">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col">
            <div className="pbx-two-col">
              {inclusions.length > 0 && (
                <div>
                  <Banner>INCLUSIONS</Banner>
                  <BulletList items={inclusions} />
                </div>
              )}
              {exclusions.length > 0 && (
                <div>
                  <Banner yellow>EXCLUSIONS</Banner>
                  <BulletList items={exclusions} dotColor="var(--orange)" />
                </div>
              )}
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 5 · PRICING ===================== */}
      {pkg.pricingOptions.length > 0 && (
        <Page label="pricing">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col">
            <Banner>PRICING</Banner>
            <table className="pbx-table">
              <thead>
                <tr>
                  <th>Option</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {pkg.pricingOptions.map((p, i) => (
                  <tr key={i}>
                    <td>
                      {p.label} {p.season === 'PEAK' && <span style={{ color: 'var(--orange)', fontSize: 12 }}>(Peak season)</span>}
                    </td>
                    <td>{formatCurrency(p.price, pkg.priceCurrency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {payInfo.length > 0 && (
              <div className="mt-5 text-[13px] leading-relaxed" style={{ color: MUTED }}>
                {payInfo.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </div>
        </Page>
      )}

      {/* ===================== 6 · GALLERY ===================== */}
      {pkg.galleryImages.length > 0 && (
        <Page label="gallery">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col" style={{ maxWidth: 1120, paddingTop: 90 }}>
            <div className="pbx-gallery">
              {pkg.galleryImages.slice(0, 9).map((src, i) => (
                <img key={i} src={src} alt="" />
              ))}
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 7 · THINGS TO CARRY / TERMS ===================== */}
      {(thingsToCarry.length > 0 || terms.length > 0) && (
        <Page label="things to carry & terms">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col">
            <div className="pbx-two-col">
              {thingsToCarry.length > 0 && (
                <div>
                  <Banner>THINGS TO CARRY</Banner>
                  <BulletList items={thingsToCarry} />
                </div>
              )}
              {terms.length > 0 && (
                <div>
                  <Banner yellow>TERMS &amp; CONDITIONS</Banner>
                  <BulletList items={terms} dotColor="var(--orange)" />
                </div>
              )}
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 8 · CUSTOMER REVIEWS ===================== */}
      {reviews.length > 0 && (
        <Page label="customer reviews">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col" style={{ maxWidth: 1120, paddingTop: 90 }}>
            <Banner>CUSTOMER REVIEWS</Banner>
            <div className="pbx-reviews-grid">
              {reviews.slice(0, 6).map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        </Page>
      )}

      {/* ===================== 9 · CONTACT ===================== */}
      {hasContact && (
        <Page label="contact us">
          <BrandMark orgName={orgName} logoUrl={logoUrl} corner />
          <div className="pbx-col flex flex-col items-center justify-center">
            <Banner>CONTACT US!</Banner>
            <div className="w-full max-w-sm">
              {phone && (
                <a className="pbx-contact-row" href={`tel:${phone}`}>
                  <Phone className="pbx-contact-icon size-4" /> {phone}
                </a>
              )}
              {pkg.contactEmail && (
                <a className="pbx-contact-row" href={`mailto:${pkg.contactEmail}`}>
                  <Mail className="pbx-contact-icon size-4" /> {pkg.contactEmail}
                </a>
              )}
              {instagramUrl && (
                <a className="pbx-contact-row" href={instagramUrl} target="_blank" rel="noreferrer">
                  <Instagram className="pbx-contact-icon size-4" /> {instagramHandle(instagramUrl)}
                </a>
              )}
              {whatsappNumber && (
                <a className="pbx-contact-row" href={`https://wa.me/${digitsOnly(whatsappNumber)}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="pbx-contact-icon size-4" /> +{whatsappNumber}
                </a>
              )}
            </div>
            <p className="pbx-footer">
              Powered by <span style={{ fontWeight: 600, color: INK }}>{orgName}</span> ✈
            </p>
          </div>
        </Page>
      )}
    </div>
  );
}
