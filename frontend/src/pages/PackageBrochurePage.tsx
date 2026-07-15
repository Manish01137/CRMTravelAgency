import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, MapPin, Phone, Mail, Moon, Printer, Sun, X } from 'lucide-react';
import { api } from '@/lib/api';
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

/** Print-ready package brochure. Rendered outside the app shell; "Download PDF" = print. */
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
  const brand2 = organization?.brandSecondaryColor ?? '#0D9488';

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

  const discounted = pkg.originalPrice != null && pkg.originalPrice > pkg.priceAmount;

  return (
    <div className="min-h-dvh bg-surface py-6 print:bg-white print:py-0">
      {/* Toolbar (hidden when printing) */}
      <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 print:hidden">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Download PDF
        </Button>
      </div>

      <div className="mx-auto max-w-3xl overflow-hidden bg-white shadow-card print:max-w-none print:shadow-none sm:rounded-xl">
        {/* Banner */}
        {pkg.bannerImageUrl ? (
          <div className="relative h-52 w-full">
            <img src={pkg.bannerImageUrl} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-6 right-6 text-white">
              <p className="flex items-center gap-1 text-sm opacity-90">
                <MapPin className="size-4" /> {pkg.destination}
              </p>
              <h1 className="font-display text-3xl font-bold">{pkg.bookingTitle || pkg.name}</h1>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 text-white" style={{ background: `linear-gradient(120deg, ${brand}, ${brand2})` }}>
            <p className="flex items-center gap-1 text-sm opacity-90">
              <MapPin className="size-4" /> {pkg.destination}
            </p>
            <h1 className="mt-1 font-display text-3xl font-bold">{pkg.bookingTitle || pkg.name}</h1>
          </div>
        )}

        <div className="space-y-7 px-6 py-7 sm:px-9">
          {/* Header row: agency + price */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
            <div className="flex items-center gap-2.5">
              {organization?.logoUrl ? (
                <img src={organization.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg font-display text-sm font-bold text-white" style={{ backgroundColor: brand }}>
                  {(organization?.name ?? 'T').slice(0, 1)}
                </span>
              )}
              <div>
                <p className="font-display text-sm font-bold text-foreground">{organization?.name ?? 'Travel Agency'}</p>
                <p className="text-xs text-muted-foreground">
                  {pkg.nights}N / {pkg.days}D
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-display text-2xl font-bold" style={{ color: brand }}>
                {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
                {discounted && (
                  <span className="ml-2 text-sm font-medium text-muted-foreground line-through">
                    {formatCurrency(pkg.originalPrice!, pkg.priceCurrency)}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">per person</p>
            </div>
          </div>

          {pkg.description && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{pkg.description}</p>
          )}

          {/* Highlights */}
          {pkg.highlights.length > 0 && (
            <div>
              <h2 className="mb-2 font-display text-lg font-bold text-foreground">Highlights</h2>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {pkg.highlights.map((h, i) => (
                  <p key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 size-4 shrink-0" style={{ color: brand }} /> {h}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Itinerary */}
          {pkg.itinerary.length > 0 && (
            <div className="break-inside-avoid">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">Day-by-day itinerary</h2>
              <div className="space-y-3">
                {pkg.itinerary.map((d, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg font-display text-xs font-bold text-white" style={{ backgroundColor: brand }}>
                      {d.day}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{d.title}</p>
                      {d.description && <p className="mt-0.5 text-sm text-muted-foreground">{d.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inclusions / Exclusions */}
          {(lines(pkg.inclusions).length > 0 || lines(pkg.exclusions).length > 0) && (
            <div className="grid gap-6 sm:grid-cols-2">
              {lines(pkg.inclusions).length > 0 && (
                <div>
                  <h2 className="mb-2 font-display text-base font-bold text-emerald-700">Inclusions</h2>
                  {lines(pkg.inclusions).map((l, i) => (
                    <p key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" /> {l}
                    </p>
                  ))}
                </div>
              )}
              {lines(pkg.exclusions).length > 0 && (
                <div>
                  <h2 className="mb-2 font-display text-base font-bold text-destructive">Exclusions</h2>
                  {lines(pkg.exclusions).map((l, i) => (
                    <p key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" /> {l}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FAQs */}
          {pkg.faqs.length > 0 && (
            <div className="break-inside-avoid">
              <h2 className="mb-3 font-display text-lg font-bold text-foreground">FAQs</h2>
              <div className="space-y-3">
                {pkg.faqs.map((f, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold text-foreground">{f.question}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gallery */}
          {pkg.galleryImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {pkg.galleryImages.slice(0, 6).map((src, i) => (
                <img key={i} src={src} alt="" className="h-24 w-full rounded-lg object-cover" />
              ))}
            </div>
          )}

          {/* Contact */}
          <div className="rounded-xl border border-border bg-surface p-4 text-sm print:border">
            <p className="mb-1 font-display font-bold text-foreground">Book this trip</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-muted-foreground">
              {pkg.contactNumber && (
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" /> {pkg.contactNumber}
                </span>
              )}
              {pkg.contactEmail && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" /> {pkg.contactEmail}
                </span>
              )}
              {!pkg.contactNumber && !pkg.contactEmail && organization?.name && (
                <span>Contact {organization.name} to book.</span>
              )}
            </div>
          </div>

          <p className="flex items-center justify-center gap-2 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            <Moon className="size-3" /> {pkg.nights} nights · <Sun className="size-3" /> {pkg.days} days · Prepared by{' '}
            {organization?.name ?? 'Voyage CRM'}
          </p>
        </div>
      </div>
    </div>
  );
}
