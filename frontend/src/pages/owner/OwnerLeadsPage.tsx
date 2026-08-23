import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency, fromNow } from '@/lib/format';
import { leadStatusStyle, leadSourceLabel } from '@/lib/leadMeta';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { cn } from '@/lib/utils';
import { OwnerShell } from './OwnerShell';
import type { OwnerLeadRow, Paginated } from './types';

export function OwnerLeadsPage() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'leads', search],
    queryFn: () =>
      api.get<Paginated<OwnerLeadRow>>(`/platform-admin/leads?${new URLSearchParams({ ...(search ? { search } : {}), pageSize: '50' })}`),
  });

  return (
    <OwnerShell>
      <PageHeader title="Leads" description="Every enquiry across every organization.">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, or phone…" className="pl-9" />
        </div>
      </PageHeader>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : !data || data.items.length === 0 ? (
          <EmptyState title="No leads found" className="border-none" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium">Organization</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Destination</th>
                <th className="px-4 py-3 font-medium">Budget</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((lead) => {
                const style = leadStatusStyle(lead.status);
                return (
                  <tr key={lead.id} className="transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{lead.name}</p>
                      <p className="text-xs text-muted-foreground">{lead.phone ?? lead.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/owner/organizations/${lead.organization.id}`} className="text-foreground hover:text-primary">
                        {lead.organization.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{leadSourceLabel(lead.source)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{lead.destination ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground">
                      {lead.budgetAmount != null ? formatCurrency(lead.budgetAmount, lead.budgetCurrency ?? 'USD') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', style.pill)}>
                        <span className={cn('size-1.5 rounded-full', style.dot)} />
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fromNow(lead.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </OwnerShell>
  );
}
