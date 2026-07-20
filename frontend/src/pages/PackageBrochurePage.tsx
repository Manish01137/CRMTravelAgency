import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, HelpCircle, MapPin, Phone, Printer, Send, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { PackageItineraryDay, TravelPackage } from '@/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';
import { PDF_TEMPLATES, type PdfTemplate } from '@/lib/pdfTemplates';

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

const lines = (s: string | null | undefined) =>
  (s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);

/** One print page — breaks onto its own A4 sheet. */
function Page({ t, children, className }: { t: PdfTemplate; children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        'brochure-page relative mx-auto mb-6 w-full max-w-5xl overflow-hidden rounded-xl shadow-card',
        'print:mb-0 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none',
        t.page,
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Section heading with the template's rule treatment. */
function Heading({ t, children }: { t: PdfTemplate; children: ReactNode }) {
  return (
    <div className="text-center">
      <h2
        className={cn('text-3xl font-extrabold sm:text-4xl', t.uppercaseHeadings && 'uppercase tracking-wide')}
        style={{ fontFamily: t.headingFont, color: t.accent }}
      >
        {children}
      </h2>
      {t.rule === 'line' && <div className="mx-auto mt-3 h-1 w-24 rounded-full" style={{ backgroundColor: t.accent2 }} />}
      {t.rule === 'ornament' && (
        <div className="mx-auto mt-3 flex w-56 items-center gap-2" style={{ color: t.accent2 }}>
          <span className="h-px flex-1 bg-current" /> <span className="text-sm">❖</span>{' '}
          <span className="h-px flex-1 bg-current" />
        </div>
      )}
    </div>
  );
}

/** Day activity blocks (copied from Sightseeing), with a sensible legacy fallback. */
function dayBlocks(d: PackageItineraryDay): { name?: string; description?: string; imageUrl?: string }[] {
  if (d.activityBlocks && d.activityBlocks.length > 0) return d.activityBlocks;
  // Fallback for older packages: derive a single block from day description + first image.
  if (d.description || (d.images && d.images.length)) {
    return [{ description: d.description, imageUrl: d.images?.[0] }];
  }
  return [];
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

  const t = PDF_TEMPLATES[pkg.pdfTemplateId] ?? PDF_TEMPLATES.alpine;
  const orgName = org?.name ?? 'Travel Agency';
  const logoUrl = org?.logoUrl;
  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const payment = lines(pkg.paymentTerms);
  const cancellation = lines(pkg.cancellationPolicy);
  const duration = `${pkg.nights}N / ${pkg.days}D`;
  const startPrice = formatCurrency(pkg.priceAmount, pkg.priceCurrency);
  const waDigits = (pkg.contactNumber ?? '').replace(/\D/g, '');

  const Logo = () =>
    logoUrl ? (
      <img src={logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
    ) : (
      <span
        className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white"
        style={{ backgroundColor: t.accent }}
      >
        {orgName.slice(0, 1)}
      </span>
    );

  return (
    <div className="min-h-dvh bg-neutral-800 py-6 print:bg-white print:py-0">
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          html, body { background: #fff !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .brochure-page { break-after: page; min-height: 190mm; box-shadow: none !important; }
          .brochure-page:last-child { break-after: auto; }
        }
      `}</style>

      {/* Toolbar (hidden in print) */}
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <span className="text-sm font-medium text-white/70">Template: {t.name}</span>
        <Button onClick={() => window.print()}>
          <Printer /> Download PDF
        </Button>
      </div>

      {/* ---------- COVER (variant per template) ---------- */}
      {t.cover === 'fullbleed' && (
        <Page t={t} className="aspect-[297/200] bg-slate-950 text-white print:aspect-auto">
          {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/40" />
          <div className="relative flex h-full flex-col justify-between p-10">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="font-display text-sm font-bold uppercase tracking-widest">{orgName}</span>
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: t.accent2 }}>
                {pkg.destination}
              </p>
              <h1 className="mt-2 text-6xl font-black uppercase leading-none tracking-tight sm:text-7xl" style={{ fontFamily: t.headingFont }}>
                {pkg.bookingTitle || pkg.name}
              </h1>
              <div className="mt-4 flex items-center gap-4 text-lg font-bold">
                <span className="rounded-md px-4 py-1.5" style={{ backgroundColor: t.accent2, color: '#0b1220' }}>
                  {duration}
                </span>
                <span>From {startPrice}</span>
              </div>
            </div>
          </div>
        </Page>
      )}
      {t.cover === 'framed' && (
        <Page t={t} className="aspect-[297/200] print:aspect-auto">
          <div className="relative h-full p-6">
            <div className="flex h-full flex-col items-center justify-center border-4 p-8 text-center" style={{ borderColor: t.accent2 }}>
              <Logo />
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em]" style={{ color: t.accent }}>
                {pkg.destination}
              </p>
              <h1 className="mt-3 text-5xl font-bold leading-tight sm:text-6xl" style={{ fontFamily: t.headingFont, color: t.accent }}>
                {pkg.bookingTitle || pkg.name}
              </h1>
              <div className="mx-auto mt-4 flex w-40 items-center gap-2" style={{ color: t.accent2 }}>
                <span className="h-px flex-1 bg-current" /> ❖ <span className="h-px flex-1 bg-current" />
              </div>
              <p className="mt-3 text-lg font-semibold">{duration} · from {startPrice}</p>
              {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="mt-5 h-40 w-full max-w-xl rounded-md object-cover" />}
            </div>
          </div>
        </Page>
      )}
      {t.cover === 'airy' && (
        <Page t={t} className="aspect-[297/200] print:aspect-auto">
          <div className="grid h-full grid-cols-2">
            <div className="flex flex-col justify-center p-10">
              <Logo />
              <p className="mt-6 text-sm font-semibold uppercase tracking-widest" style={{ color: t.accent }}>
                {pkg.destination}
              </p>
              <h1 className="mt-2 text-5xl font-bold leading-tight" style={{ fontFamily: t.headingFont, color: t.accent }}>
                {pkg.bookingTitle || pkg.name}
              </h1>
              <p className="mt-4 text-lg text-slate-500">{duration}</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: t.accent2 }}>From {startPrice}</p>
            </div>
            <div className="relative">
              {pkg.bannerImageUrl ? (
                <img src={pkg.bannerImageUrl} alt="" className="h-full w-full rounded-l-[3rem] object-cover" />
              ) : (
                <div className="h-full w-full rounded-l-[3rem]" style={{ backgroundColor: t.accent }} />
              )}
            </div>
          </div>
        </Page>
      )}
      {t.cover === 'band' && (
        <Page t={t} className="aspect-[297/200] print:aspect-auto">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-10 py-6" style={{ backgroundColor: t.accent }}>
              <div className="flex items-center gap-3 text-white">
                <Logo />
                <span className="font-display text-sm font-bold">{orgName}</span>
              </div>
              <span className="rounded px-3 py-1 text-sm font-bold text-white" style={{ backgroundColor: t.accent2 }}>{duration}</span>
            </div>
            {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="h-full w-full flex-1 object-cover" />}
            <div className="px-10 py-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{pkg.destination}</p>
              <div className="flex items-end justify-between">
                <h1 className="text-4xl font-bold" style={{ fontFamily: t.headingFont, color: t.accent }}>
                  {pkg.bookingTitle || pkg.name}
                </h1>
                <p className="text-xl font-bold" style={{ color: t.accent }}>From {startPrice}</p>
              </div>
            </div>
          </div>
        </Page>
      )}
      {t.cover === 'blocks' && (
        <Page t={t} className="aspect-[297/200] bg-slate-900 text-white print:aspect-auto">
          <div className="grid h-full grid-rows-[1fr_auto]">
            <div className="relative">
              {pkg.bannerImageUrl && <img src={pkg.bannerImageUrl} alt="" className="h-full w-full object-cover" />}
              <div className="absolute left-8 top-8 flex items-center gap-3">
                <Logo />
                <span className="font-display text-sm font-bold uppercase tracking-widest">{orgName}</span>
              </div>
            </div>
            <div className="grid grid-cols-3">
              <div className="flex items-center justify-center p-6 text-center" style={{ backgroundColor: t.accent }}>
                <span className="text-2xl font-black" style={{ fontFamily: t.headingFont }}>{duration}</span>
              </div>
              <div className="col-span-2 flex flex-col justify-center p-6" style={{ backgroundColor: t.accent2 }}>
                <p className="text-xs font-bold uppercase tracking-widest text-white/80">{pkg.destination}</p>
                <h1 className="text-4xl font-black uppercase leading-none" style={{ fontFamily: t.headingFont }}>
                  {pkg.bookingTitle || pkg.name}
                </h1>
                <p className="mt-1 text-lg font-bold">From {startPrice}</p>
              </div>
            </div>
          </div>
        </Page>
      )}

      {/* ---------- ITINERARY OVERVIEW ---------- */}
      {pkg.itinerary.length > 0 && (
        <Page t={t} className="p-10">
          <Heading t={t}>Itinerary</Heading>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {pkg.itinerary.map((d) => (
              <div key={d.day} className={cn('overflow-hidden shadow-card', t.cardRadius)}>
                <p className="px-4 py-2 text-center text-sm font-bold text-white" style={{ backgroundColor: t.accent }}>
                  DAY {d.day}
                </p>
                <div className="px-4 py-3 text-center text-sm font-semibold" style={{ backgroundColor: `${t.accent2}22` }}>
                  {d.title}
                </div>
              </div>
            ))}
          </div>
        </Page>
      )}

      {/* ---------- PER-DAY PAGES (activity image + description) ---------- */}
      {pkg.itinerary.map((d) => {
        const blocks = dayBlocks(d);
        return (
          <Page key={d.day} t={t} className="p-10">
            <div className="flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-full text-lg font-bold text-white" style={{ backgroundColor: t.accent }}>
                {d.day}
              </span>
              <h2 className={cn('text-2xl font-extrabold', t.uppercaseHeadings && 'uppercase tracking-wide')} style={{ fontFamily: t.headingFont, color: t.accent }}>
                {d.title}
              </h2>
            </div>
            {d.description && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{d.description}</p>}

            <div className="mt-5 space-y-4">
              {blocks.map((b, i) => (
                <div key={i} className={cn('flex items-start gap-4 border p-4', t.cardRadius)} style={{ borderColor: `${t.accent2}55` }}>
                  {b.imageUrl && <img src={b.imageUrl} alt="" className="h-28 w-40 shrink-0 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    {b.name && (
                      <p className="font-bold" style={{ fontFamily: t.headingFont, color: t.accent }}>
                        {b.name}
                      </p>
                    )}
                    {b.description && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{b.description}</p>}
                  </div>
                </div>
              ))}
            </div>

            {(d.stay || d.meals) && (
              <p className="mt-5 text-sm font-semibold" style={{ color: t.accent2 }}>
                {d.stay ? `Stay: ${d.stay}` : ''} {d.stay && d.meals ? ' · ' : ''} {d.meals ? `Meals: ${d.meals}` : ''}
              </p>
            )}
          </Page>
        );
      })}

      {/* ---------- INCLUSIONS / EXCLUSIONS ---------- */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Page t={t} className="p-10">
          <Heading t={t}>Inclusions &amp; Exclusions</Heading>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className={cn('border p-6', t.cardRadius)} style={{ borderColor: `${t.accent2}55` }}>
              <h3 className="mb-3 font-bold text-emerald-600" style={{ fontFamily: t.headingFont }}>What's included</h3>
              <ul className="space-y-2">
                {inclusions.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {l}
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn('border p-6', t.cardRadius)} style={{ borderColor: `${t.accent2}55` }}>
              <h3 className="mb-3 font-bold text-red-500" style={{ fontFamily: t.headingFont }}>Not included</h3>
              <ul className="space-y-2">
                {exclusions.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <X className="mt-0.5 size-4 shrink-0 text-red-500" /> {l}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Page>
      )}

      {/* ---------- PRICING & PAYMENT ---------- */}
      <Page t={t} className="p-10">
        <Heading t={t}>Pricing &amp; Payment</Heading>
        <div className="mx-auto mt-8 max-w-3xl">
          <div className={cn('grid gap-4', (pkg.pricingOptions?.length ?? 0) > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-1')}>
            {(pkg.pricingOptions?.length ? pkg.pricingOptions : [{ label: 'Per person', price: pkg.priceAmount }]).map((o, i) => (
              <div key={i} className={cn('overflow-hidden text-center shadow-card', t.cardRadius)}>
                <p className="px-4 py-2 text-sm font-bold uppercase tracking-wide text-white" style={{ backgroundColor: t.accent }}>{o.label}</p>
                <p className="px-4 py-5 text-2xl font-extrabold" style={{ color: t.accent }}>{formatCurrency(o.price, pkg.priceCurrency)}</p>
              </div>
            ))}
          </div>
          {payment.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-2 font-bold" style={{ fontFamily: t.headingFont, color: t.accent }}>Payment terms</h3>
              <ul className="space-y-1.5">
                {payment.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.accent2 }} /> {l}</li>
                ))}
              </ul>
            </div>
          )}
          {cancellation.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 font-bold" style={{ fontFamily: t.headingFont, color: t.accent }}>Cancellation policy</h3>
              <ul className="space-y-1.5">
                {cancellation.map((l, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm"><span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ backgroundColor: t.accent2 }} /> {l}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Page>

      {/* ---------- FAQs (if present) ---------- */}
      {pkg.faqs.length > 0 && (
        <Page t={t} className="p-10">
          <Heading t={t}>FAQs</Heading>
          <div className="mx-auto mt-8 max-w-3xl space-y-4">
            {pkg.faqs.map((f, i) => (
              <div key={i} className={cn('border p-5', t.cardRadius)} style={{ borderColor: `${t.accent2}55` }}>
                <p className="flex items-start gap-2 font-bold" style={{ color: t.accent }}>
                  <HelpCircle className="mt-0.5 size-4 shrink-0" /> {f.question}
                </p>
                <p className="mt-1.5 pl-6 text-sm leading-relaxed">{f.answer}</p>
              </div>
            ))}
          </div>
        </Page>
      )}

      {/* ---------- CONTACT / BOOKING CTA ---------- */}
      <Page t={t} className="flex flex-col p-10">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Logo />
          <h2 className={cn('mt-5 text-4xl font-extrabold', t.uppercaseHeadings && 'uppercase tracking-wide')} style={{ fontFamily: t.headingFont, color: t.accent }}>
            Book your trip
          </h2>
          <p className="mt-2 text-lg">{pkg.bookingTitle || pkg.name} · {duration} · from {startPrice}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {pkg.contactNumber && (
              <span className="flex items-center gap-2 text-lg font-bold" style={{ color: t.accent }}>
                <Phone className="size-5" /> {pkg.contactNumber}
              </span>
            )}
            {waDigits && (
              <span className="flex items-center gap-2 rounded-full px-5 py-2.5 text-lg font-bold text-white" style={{ backgroundColor: '#22c55e' }}>
                <Send className="size-5" /> WhatsApp {pkg.contactNumber}
              </span>
            )}
          </div>
          <p className="mt-6 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="size-4" /> {pkg.destination}
          </p>
        </div>
        <p className="text-center text-xs text-slate-400">Prepared by {orgName}</p>
      </Page>
    </div>
  );
}
