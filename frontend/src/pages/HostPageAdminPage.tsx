import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Eye, FileText, Globe, Link2, MapPin, Send, Settings, Users2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { brochureUrl, copyToClipboard, packageWhatsAppUrl } from '@/lib/share';

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-bold', accent ? 'text-emerald-600' : 'text-foreground')}>{value}</p>
    </Card>
  );
}

export function HostPageAdminPage() {
  const { organization } = useAuth();
  const [copied, setCopied] = useState(false);

  const packagesQuery = useQuery({ queryKey: ['packages'], queryFn: () => api.get<TravelPackage[]>('/packages') });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

  const packages = packagesQuery.data ?? [];
  const visible = packages.filter((p) => p.isActive);
  const publicUrl = organization ? `${window.location.origin}/a/${organization.slug}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  return (
    <div>
      <PageHeader title="AirLink" description="Your smart bio link — share it in Instagram bio or WhatsApp. Packages you publish appear here for one-tap booking.">
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/settings/organization">
              <Settings /> Edit branding &amp; links
            </Link>
          </Button>
          <Button asChild>
            <a href={publicUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> Open live page
            </a>
          </Button>
        </div>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total packages" value={packages.length} />
        <Stat label="Visible packages" value={visible.length} accent />
        <Stat label="Hidden packages" value={packages.length - visible.length} />
        <Stat label="Team members" value={usersQuery.data?.length ?? '—'} />
      </div>

      <Card className="mb-6 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your AirLink</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={publicUrl} className="flex-1 font-medium" onFocus={(e) => e.currentTarget.select()} />
          <div className="flex gap-2">
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="text-emerald-600" /> : <Copy />} {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Open
              </a>
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Share this on Instagram bio, WhatsApp status or ads. Every enquiry from it lands in your Leads pipeline. Toggle a
          package's <b>Active</b> switch on the Packages page to show or hide it here.
        </p>
      </Card>

      {/* Shareable packages — auto-listed from what you create; each with a public link */}
      <div className="mb-6">
        <h2 className="mb-3 font-display text-base font-semibold text-foreground">Shareable packages</h2>
        {packages.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No packages yet — create one and it appears here automatically with its own shareable link.
          </Card>
        ) : (
          <Card className="divide-y divide-border p-0">
            {packages.map((pkg) => (
              <div key={pkg.id} className="flex flex-wrap items-center gap-3 p-3.5">
                {pkg.bannerImageUrl ? (
                  <img src={pkg.bannerImageUrl} alt="" className="size-12 rounded-lg object-cover" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <MapPin className="size-4" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {pkg.name}
                    {!pkg.isActive && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        Hidden
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {pkg.destination} · {pkg.days}D/{pkg.nights}N · {formatCurrency(pkg.priceAmount, pkg.priceCurrency)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => window.open(`/p/${pkg.id}`, '_blank')}>
                    <FileText /> Brochure
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label="Copy share link"
                    onClick={async () => {
                      const ok = await copyToClipboard(brochureUrl(pkg.id));
                      ok ? toast.success('Share link copied') : toast.error('Copy failed');
                    }}
                  >
                    <Link2 />
                  </Button>
                  <Button
                    size="icon-sm"
                    aria-label="Send on WhatsApp"
                    className="bg-emerald-500 text-white hover:bg-emerald-600"
                    onClick={() => window.open(packageWhatsAppUrl(pkg, pkg.contactNumber), '_blank')}
                  >
                    <Send />
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">Live preview</h2>
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <Globe className="size-3.5" /> {visible.length} package{visible.length === 1 ? '' : 's'} showing
        </span>
      </div>

      {/* Embedded preview of the actual public page */}
      <Card className="overflow-hidden p-0">
        {organization ? (
          <iframe
            key={publicUrl}
            title="Host page preview"
            src={`/a/${organization.slug}`}
            className="h-[640px] w-full border-0 bg-surface"
          />
        ) : null}
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" /> This is exactly what visitors see. Manage team access under{' '}
        <Link to="/team" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          <Users2 className="size-3" /> Team
        </Link>
        .
      </p>
    </div>
  );
}
