import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Copy, ExternalLink, Eye, Globe, Settings, Users2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TravelPackage, User } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';

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
      <PageHeader title="Host Page" description="Share your public page and manage which packages appear on it.">
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
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Public host link</p>
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
