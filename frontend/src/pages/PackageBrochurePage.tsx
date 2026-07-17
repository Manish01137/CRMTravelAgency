import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Bus,
  Check,
  Instagram,
  MapPin,
  Phone,
  Printer,
  ShieldCheck,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/format';

const lines = (s: string | null | undefined) =>
  (s ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/* Brochure palette (reference deck style): warm paper, deep brown ink, gold rule. */
const PAPER = '#f6f4f0';
const INK = '#4a3a28';
const GOLD = '#b8963e';

/** One landscape brochure page; breaks onto its own sheet when printing. */
function Page({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <section
      className={cn(
        'relative mx-auto mb-6 w-full max-w-5xl overflow-hidden rounded-xl shadow-card print:mb-0 print:aspect-[297/210] print:max-w-none print:rounded-none print:shadow-none print:[break-after:page]',
        className,
      )}
      style={{ backgroundColor: dark ? '#171310' : PAPER, color: dark ? '#f5efe4' : INK }}
    >
      {children}
    </section>
  );
}

function AgencyMark({ logoUrl, name, brand, light }: { logoUrl: string | null | undefined; name: string; brand: string; light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl object-cover shadow-soft" />
      ) : (
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl font-display text-lg font-bold text-white shadow-soft"
          style={{ backgroundColor: brand }}
        >
          {name.slice(0, 1)}
        </span>
      )}
      <p className={cn('font-display text-sm font-bold uppercase tracking-widest', light ? 'text-white' : '')}>{name}</p>
    </div>
  );
}

/** Gold ornament rule under section titles (reference style). */
function PageTitle({ children, sub, light }: { children: ReactNode; sub?: string; light?: boolean }) {
  return (
    <div className="text-center">
      <h2 className={cn('font-display text-3xl font-extrabold uppercase tracking-wide sm:text-4xl', light && 'text-white')}>
        {children}
      </h2>
      {sub && (
        <p className="-mt-1 font-hand text-3xl" style={{ color: '#eab308' }}>
          {sub}
        </p>
      )}
      <div className="mx-auto mt-3 flex w-64 items-center gap-2" aria-hidden>
        <span className="h-px flex-1" style={{ backgroundColor: GOLD }} />
        <span className="text-xs" style={{ color: GOLD }}>
          ❖
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: GOLD }} />
      </div>
    </div>
  );
}

/** Polaroid-style photo collage for a day page. */
function Collage({ images, tag }: { images: string[]; tag?: string }) {
  const [main, ...rest] = images;
  return (
    <div className="relative">
      <img src={main} alt="" className="aspect-[4/3] w-full rounded-sm border-8 border-white object-cover shadow-card" />
      {rest.length > 0 && (
        <div className="-mt-10 flex justify-center gap-3 px-6">
          {rest.slice(0, 3).map((src, i) => (
            <img
              key={i}
              src={src}
              alt=""
              className={cn(
                'aspect-square w-1/4 rounded-sm border-[6px] border-white object-cover shadow-card',
                i % 2 === 0 ? '-rotate-3' : 'rotate-2',
              )}
            />
          ))}
        </div>
      )}
      {tag && (
        <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl bg-white/80 px-4 py-2 text-sm font-medium shadow-sm" style={{ color: INK }}>
          <MapPin className="size-3.5" /> {tag}
        </p>
      )}
    </div>
  );
}

/** Print-ready multi-page package brochure. "Download PDF" = print (A4 landscape). */
export function PackageBrochurePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organization } = useAuth();

  const pkgQuery = useQuery({
    queryKey: ['package', id],
    queryFn: () => api.get<TravelPackage>(`/packages/${id}`),
    enabled: !!id,
  });

  const pkg = pkgQuery.data;
  const brand = organization?.brandPrimaryColor ?? '#4F46E5';
  const orgName = organization?.name ?? 'Travel Agency';
  const logoUrl = organization?.logoUrl;

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

  const inclusions = lines(pkg.inclusions);
  const exclusions = lines(pkg.exclusions);
  const terms = lines(pkg.termsConditions);
  const paymentTerms = lines(pkg.paymentTerms);
  const cancellation = lines(pkg.cancellationPolicy);
  const instagram = pkg.contactEmail; // shown on contact page alongside phone

  return (
    <div className="min-h-dvh bg-neutral-800 py-6 print:bg-white print:py-0">
      <style>{'@media print { @page { size: A4 landscape; margin: 0; } }'}</style>

      {/* Toolbar (hidden when printing) */}
      <div className="mx-auto mb-4 flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Download PDF
        </Button>
      </div>

      {/* ---------- 1. COVER ---------- */}
      <Page dark className="aspect-[297/195]">
        {pkg.bannerImageUrl && (
          <img src={pkg.bannerImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/60" />
        <div className="relative flex h-full flex-col items-center justify-between p-8 text-center sm:p-10">
          <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} light />
          <div>
            <h1 className="font-display text-5xl font-extrabold uppercase tracking-wider text-white drop-shadow-lg sm:text-7xl">
              {pkg.destination}
            </h1>
            <p className="-mt-2 font-hand text-4xl text-yellow-300 drop-shadow sm:text-5xl">{pkg.bookingTitle || pkg.name}</p>
          </div>
          <p className="rounded-lg bg-yellow-300 px-5 py-2.5 font-display text-lg font-extrabold text-neutral-900 shadow-pop">
            Starting @ {formatCurrency(pkg.priceAmount, pkg.priceCurrency)} | {pkg.nights}N/{pkg.days}D
          </p>
        </div>
      </Page>

      {/* ---------- 2. ITINERARY OVERVIEW ---------- */}
      {pkg.itinerary.length > 0 && (
        <Page className="p-8 sm:p-10">
          <div className="absolute left-6 top-6">
            <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} />
          </div>
          <div className="pt-10">
            <PageTitle sub={pkg.destination}>Itinerary</PageTitle>
            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {pkg.itinerary.map((d) => (
                <div key={d.day} className="overflow-hidden rounded-xl shadow-card">
                  <p className="bg-yellow-300 px-4 py-2.5 text-center font-display text-lg font-extrabold text-neutral-900">
                    DAY {d.day}
                  </p>
                  <div className="px-4 py-4 text-center text-sm font-semibold text-white" style={{ backgroundColor: brand }}>
                    {d.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Page>
      )}

      {/* ---------- 3. ONE PAGE PER DAY ---------- */}
      {pkg.itinerary.map((d, i) => {
        const photos = d.images ?? [];
        const flip = i % 2 === 1; // alternate photo side like the reference deck
        return (
          <Page key={d.day} className="p-8 sm:p-10">
            <div className="absolute left-6 top-6">
              <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} />
            </div>
            <div className={cn('grid items-center gap-8 pt-12 sm:grid-cols-2', photos.length === 0 && 'sm:grid-cols-1')}>
              <div className={cn(flip && photos.length > 0 && 'sm:order-2')}>
                <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">
                  Day {d.day} : {d.title}
                </h2>
                <div className="mt-3 flex w-72 max-w-full items-center gap-2" aria-hidden>
                  <span className="h-px flex-1" style={{ backgroundColor: GOLD }} />
                  <span className="text-xs" style={{ color: GOLD }}>
                    ❖
                  </span>
                  <span className="h-px flex-1" style={{ backgroundColor: GOLD }} />
                </div>
                {d.description && (
                  <p className="mt-5 whitespace-pre-line text-justify text-[15px] font-medium leading-relaxed">{d.description}</p>
                )}
                <div className="mt-5 space-y-1.5 text-sm font-semibold">
                  {d.stay && (
                    <p>
                      <span style={{ color: GOLD }}>Stay:</span> {d.stay}
                    </p>
                  )}
                  {(d.activities?.length ?? 0) > 0 && (
                    <p>
                      <span style={{ color: GOLD }}>Activities:</span> {d.activities!.join(' · ')}
                    </p>
                  )}
                  {d.meals && (
                    <p>
                      <span style={{ color: GOLD }}>Meals:</span> {d.meals}
                    </p>
                  )}
                </div>
              </div>
              {photos.length > 0 && (
                <div className={cn(flip && 'sm:order-1')}>
                  <Collage images={photos} tag={d.stay || `${d.title} | ${pkg.destination}`} />
                </div>
              )}
            </div>
          </Page>
        );
      })}

      {/* ---------- 4. INCLUSIONS / EXCLUSIONS ---------- */}
      {(inclusions.length > 0 || exclusions.length > 0) && (
        <Page className="grid sm:grid-cols-2">
          <div className="p-8 sm:p-10">
            <PageTitle>Inclusions</PageTitle>
            <div className="mx-auto mt-6 flex w-fit gap-5 rounded-xl px-6 py-3 text-white" style={{ backgroundColor: '#6b5636' }}>
              {[Bus, UtensilsCrossed, ShieldCheck, BadgeCheck].map((Icon, i) => (
                <Icon key={i} className="size-5" />
              ))}
            </div>
            <ul className="mt-6 space-y-2.5 text-[15px] font-semibold">
              {inclusions.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" style={{ color: GOLD }} /> {l}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-neutral-500/90 p-8 text-white sm:p-10">
            <PageTitle light>Exclusions</PageTitle>
            <ul className="mt-8 space-y-2.5 text-[15px] font-semibold">
              {exclusions.map((l, i) => (
                <li key={i} className="flex items-start gap-2">
                  <X className="mt-0.5 size-4 shrink-0 text-white/70" /> {l}
                </li>
              ))}
            </ul>
          </div>
        </Page>
      )}

      {/* ---------- 5. WHY CHOOSE US ---------- */}
      {pkg.highlights.length > 0 && (
        <Page className="p-8 sm:p-10">
          <div className="absolute left-6 top-6">
            <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} />
          </div>
          <div className="pt-10">
            <PageTitle>Why choose us</PageTitle>
            <div className="mt-8 grid items-center gap-8 sm:grid-cols-2">
              <ul className="space-y-3 text-[15px] font-semibold">
                {pkg.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ backgroundColor: GOLD }} />
                    {h}
                  </li>
                ))}
              </ul>
              {pkg.galleryImages.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {pkg.galleryImages.slice(0, 4).map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      className={cn('aspect-[4/3] w-full rounded-sm border-8 border-white object-cover shadow-card', i % 2 === 0 ? '-rotate-1' : 'rotate-1')}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Page>
      )}

      {/* ---------- 6. TERMS & CONDITIONS ---------- */}
      {(terms.length > 0 || paymentTerms.length > 0 || cancellation.length > 0) && (
        <Page className="p-8 sm:p-10">
          <div className="absolute left-6 top-6">
            <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} />
          </div>
          <div className="pt-10">
            <PageTitle>Terms &amp; Conditions</PageTitle>
            <div className="mt-8 columns-1 gap-10 text-[13.5px] font-semibold leading-relaxed sm:columns-2">
              {[...paymentTerms, ...terms, ...cancellation].map((l, i) => (
                <p key={i} className="mb-2.5 flex break-inside-avoid items-start gap-2">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ backgroundColor: INK }} />
                  {l}
                </p>
              ))}
            </div>
          </div>
        </Page>
      )}

      {/* ---------- 7. PRICING ---------- */}
      <Page className="p-8 sm:p-10">
        <div className="absolute left-6 top-6">
          <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} />
        </div>
        <div className="pt-10 text-center">
          <PageTitle>Special pricing</PageTitle>
          <div className={cn('mx-auto mt-8 grid max-w-3xl gap-5', pkg.pricingOptions.length > 1 ? 'sm:grid-cols-3' : 'sm:grid-cols-1')}>
            {(pkg.pricingOptions.length > 0 ? pkg.pricingOptions : [{ label: 'Per person', price: pkg.priceAmount }]).map(
              (opt, i) => (
                <div key={i} className="overflow-hidden rounded-xl bg-white shadow-card">
                  <p className="px-4 py-2 font-display text-sm font-extrabold uppercase tracking-wide text-white" style={{ backgroundColor: '#6b5636' }}>
                    {opt.label}
                  </p>
                  <div className="px-4 py-5">
                    <p className="font-display text-2xl font-extrabold">{formatCurrency(opt.price, pkg.priceCurrency)}</p>
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide opacity-60">per person</p>
                  </div>
                </div>
              ),
            )}
          </div>
          {pkg.originalPrice != null && pkg.originalPrice > pkg.priceAmount && (
            <p className="mt-5 text-sm font-semibold">
              Regular price <span className="line-through opacity-60">{formatCurrency(pkg.originalPrice, pkg.priceCurrency)}</span>{' '}
              — now from <b style={{ color: GOLD }}>{formatCurrency(pkg.priceAmount, pkg.priceCurrency)}</b>
            </p>
          )}
          {pkg.pickupPoints && (
            <p className="mt-4 font-display text-sm font-extrabold uppercase tracking-wide">Package available from {pkg.pickupPoints}</p>
          )}
          {paymentTerms.length > 0 && <p className="mx-auto mt-2 max-w-2xl text-sm font-semibold">{paymentTerms[0]}</p>}
          {pkg.contactNumber && (
            <p className="mt-3 font-display text-lg font-extrabold">
              Gpay/PhonePe/Paytm — {pkg.contactNumber} ({orgName})
            </p>
          )}
        </div>
      </Page>

      {/* ---------- 8. CONTACT ---------- */}
      <Page className="flex flex-col">
        <div className="flex-1 p-8 text-center sm:p-10">
          <div className="absolute left-6 top-6">
            <AgencyMark logoUrl={logoUrl} name={orgName} brand={brand} />
          </div>
          <div className="pt-10">
            <PageTitle>Contact us</PageTitle>
            {(pkg.galleryImages[0] || pkg.bannerImageUrl) && (
              <img
                src={pkg.galleryImages[0] || pkg.bannerImageUrl!}
                alt=""
                className="mx-auto mt-8 aspect-[16/8] w-full max-w-2xl rounded-sm border-8 border-white object-cover shadow-card"
              />
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 px-8 py-5" style={{ backgroundColor: '#d9d2c5' }}>
          {pkg.contactNumber && (
            <span className="flex items-center gap-2 font-display text-lg font-extrabold">
              <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Phone className="size-4" />
              </span>
              {pkg.contactNumber}
            </span>
          )}
          {instagram && (
            <span className="flex items-center gap-2 font-display text-lg font-extrabold">
              <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-500 text-white">
                <Instagram className="size-4" />
              </span>
              {instagram}
            </span>
          )}
          <span className="text-sm font-semibold opacity-70">{orgName}</span>
        </div>
      </Page>
    </div>
  );
}
